import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import {
  buildTransactionSearchQuery,
  buildTransactionSearchTerms,
  buildTransactionSearchText,
} from "../utils/transactionSearch.js"

const BATCH_SIZE = 1000
const ATLAS_SEARCH_INDEX_NAME = String(process.env.MONGODB_ATLAS_SEARCH_INDEX_NAME || "transactions_autocomplete").trim()
const ATLAS_SEARCH_ENABLED = String(process.env.MONGODB_ATLAS_SEARCH_ENABLED || "true").trim().toLowerCase() !== "false"

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildLegacySearchCondition(regex) {
  return {
    $or: [
      { description: regex },
      { accountName: regex },
      { category: regex },
      { "splits.category": regex },
      { date: regex },
    ],
  }
}

function encodeTransactionsCursor(item = {}) {
  const date = String(item?.date || "").trim()
  const id = String(item?._id || "").trim()
  if (!date || !id) return null

  return Buffer.from(JSON.stringify({ date, id })).toString("base64url")
}

function decodeTransactionsCursor(cursor = "") {
  const safeCursor = String(cursor || "").trim()
  if (!safeCursor) return null

  try {
    const parsed = JSON.parse(Buffer.from(safeCursor, "base64url").toString("utf8"))
    const date = String(parsed?.date || "").trim()
    const id = String(parsed?.id || "").trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    if (!ObjectId.isValid(id)) return null

    return {
      date,
      id,
    }
  } catch {
    return null
  }
}

const TRANSACTION_LIST_PROJECTION = {
  _id: 1,
  accountId: 1,
  accountName: 1,
  date: 1,
  description: 1,
  amount: 1,
  categoryId: 1,
  category: 1,
  isSplit: 1,
  llmProcessed: 1,
  llmStatus: 1,
  llmProcessedAt: 1,
  categorizedSource: 1,
  llmCategorySuggestionId: 1,
  llmCategorySuggestionName: 1,
  searchText: 1,
  splits: 1,
}

function buildTransactionsSearchIndexDefinition() {
  const searchableStringField = [
    { type: "token" },
    { type: "string" },
    {
      type: "autocomplete",
      tokenization: "edgeGram",
      minGrams: 2,
      maxGrams: 15,
      foldDiacritics: true,
    },
  ]

  return {
    mappings: {
      dynamic: false,
      fields: {
        clientId: { type: "token" },
        accountId: { type: "token" },
        categoryId: { type: "token" },
        categorizedSource: { type: "token" },
        llmStatus: { type: "token" },
        date: { type: "token" },
        amount: { type: "number" },
        llmProcessed: { type: "boolean" },
        isSplit: { type: "boolean" },
        description: searchableStringField,
        accountName: searchableStringField,
        category: searchableStringField,
      },
    },
  }
}

function isAtlasSearchUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase()
  const errorCode = Number(error?.code || error?.errorResponse?.code || 0)

  return (
    errorCode === 20 ||
    message.includes("unrecognized pipeline stage name: '$search'") ||
    message.includes("search index commands are only supported with atlas") ||
    message.includes("command not found") ||
    message.includes("mongot") ||
    message.includes("maximum number of fts indexes") ||
    message.includes("maximum number of search indexes") ||
    message.includes("fts indexes has been reached") ||
    message.includes("search index") ||
    message.includes("index not found for search") ||
    message.includes("query requires a search index")
  )
}

function buildAtlasAutocompleteClause(path, query, boost, fuzzy = null) {
  const autocomplete = {
    path,
    query,
    tokenOrder: "any",
    score: { boost: { value: boost } },
  }

  if (fuzzy) {
    autocomplete.fuzzy = fuzzy
  }

  return { autocomplete }
}

function buildTransactionsAtlasSearchStage({ clientId, search = "" }) {
  const safeClientId = String(clientId || "").trim()
  const safeSearch = String(search || "").trim()
  if (!ATLAS_SEARCH_ENABLED || !ATLAS_SEARCH_INDEX_NAME || !safeClientId || !safeSearch) {
    return null
  }

  const should = [
    buildAtlasAutocompleteClause(
      "description",
      safeSearch,
      6,
      safeSearch.length >= 5
        ? {
            maxEdits: 1,
            prefixLength: 2,
            maxExpansions: 64,
          }
        : null
    ),
    buildAtlasAutocompleteClause("accountName", safeSearch, 3),
    buildAtlasAutocompleteClause("category", safeSearch, 2),
    {
      text: {
        path: "description",
        query: safeSearch,
        score: { boost: { value: 4 } },
      },
    },
    {
      text: {
        path: "accountName",
        query: safeSearch,
        score: { boost: { value: 2 } },
      },
    },
    {
      text: {
        path: "category",
        query: safeSearch,
        score: { boost: { value: 1 } },
      },
    },
  ]

  return {
    $search: {
      index: ATLAS_SEARCH_INDEX_NAME,
      compound: {
        filter: [
          {
            equals: {
              path: "clientId",
              value: safeClientId,
            },
          },
        ],
        should,
        minimumShouldMatch: 1,
      },
    },
  }
}

async function ensureTransactionsSearchIndex() {
  if (!ATLAS_SEARCH_ENABLED || !ATLAS_SEARCH_INDEX_NAME) return

  const db = getDB()
  const collection = db.collection("transactions")
  const definition = buildTransactionsSearchIndexDefinition()

  try {
    const existingIndexes = await collection.listSearchIndexes(ATLAS_SEARCH_INDEX_NAME).toArray()
    if (existingIndexes.length === 0) {
      await collection.createSearchIndex({
        name: ATLAS_SEARCH_INDEX_NAME,
        definition,
      })
      return
    }

    const currentDefinition = existingIndexes[0]?.latestDefinition || existingIndexes[0]?.definition || null
    if (JSON.stringify(currentDefinition) === JSON.stringify(definition)) {
      return
    }

    await collection.updateSearchIndex(ATLAS_SEARCH_INDEX_NAME, definition)
  } catch (error) {
    if (isAtlasSearchUnavailableError(error)) {
      console.warn(`[transactions.repository] Atlas Search unavailable, keeping fallback search path: ${error.message}`)
      return
    }

    throw error
  }
}

async function runTransactionsAtlasSearchAggregate(collection, pipeline = []) {
  try {
    return await collection.aggregate(pipeline).toArray()
  } catch (error) {
    if (isAtlasSearchUnavailableError(error)) {
      return null
    }

    throw error
  }
}

// cria índice uma vez (chame no startup ou antes do primeiro uso)
export async function ensureTransactionsIndexes() {
  const db = getDB()
  const collection = db.collection("transactions")
  await Promise.all([
    collection.createIndex({ clientId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, searchTerms: 1 }),
    collection.createIndex({ clientId: 1, accountId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, categoryId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, createdAt: -1 }),
    collection.createIndex({ clientId: 1, updatedAt: -1 }),
    collection.createIndex({ clientId: 1, llmProcessedAt: -1 }),
    collection.createIndex({ clientId: 1, llmStatus: 1, llmProcessedAt: -1 }),
    collection.createIndex({ clientId: 1, categorizedAt: -1 }),
    collection.createIndex({ accountId: 1 }),
    collection.createIndex({ categoryId: 1 }),
    collection.createIndex({ "splits.categoryId": 1 }),
  ])

  await ensureTransactionsSearchIndex()
}

// salva transações em lote (batch)
export async function insertTransactionsInBatches(transactions) {
  const db = getDB()
  const collection = db.collection("transactions")

  let insertedCount = 0

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const chunk = transactions.slice(i, i + BATCH_SIZE)
    if (chunk.length === 0) continue

    const docs = chunk.map((t) => ({
      clientId: t.clientId,
      accountId: t.accountId ?? null,
      accountName: t.accountName ?? null,
      date: t.date, // YYYY-MM-DD
      description: t.description,
      amount: t.amount,
      categoryId: t.categoryId ?? null,
      category: t.category ?? null,
      llmProcessed: t.llmProcessed ?? false,
      llmStatus: t.llmStatus ?? "not_processed",
      llmProcessedAt: t.llmProcessedAt ?? null,
      llmConfidence: t.llmConfidence ?? null,
      llmAmbiguous: t.llmAmbiguous ?? null,
      llmCategorySuggestionId: t.llmCategorySuggestionId ?? null,
      llmCategorySuggestionName: t.llmCategorySuggestionName ?? null,
      categorizedAt: t.categorizedAt ?? null,
      categorizedSource: t.categorizedSource ?? null,
      searchTerms: buildTransactionSearchTerms(t),
      searchText: buildTransactionSearchText(t),
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const result = await collection.insertMany(docs, { ordered: false })
    insertedCount += result.insertedCount
  }

  return { insertedCount }
}

// atualizar 

export async function updateTransactionById(id, patch) {
    const db = getDB()

    // atualiza somente campos enviados no patch
    const allowed = {
      accountId: patch.accountId,
      accountName: patch.accountName,
      date: patch.date,
      description: patch.description,
      amount: patch.amount,
      categoryId: patch.categoryId,
      category: patch.category,
      splits: patch.splits,
      isSplit: patch.isSplit,
      llmProcessed: patch.llmProcessed,
      llmStatus: patch.llmStatus,
      llmProcessedAt: patch.llmProcessedAt,
      llmConfidence: patch.llmConfidence,
      llmAmbiguous: patch.llmAmbiguous,
      llmCategorySuggestionId: patch.llmCategorySuggestionId,
      llmCategorySuggestionName: patch.llmCategorySuggestionName,
      searchTerms: patch.searchTerms,
      searchText: patch.searchText,
      categorizedAt: patch.categorizedAt,
      categorizedSource: patch.categorizedSource,
      updatedAt: new Date(),
    }

    const $set = Object.fromEntries(
      Object.entries(allowed).filter(([, value]) => value !== undefined)
    )

    return db.collection("transactions").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
        { returnDocument: "after" }
    )
}

export async function updateTransactionsByIds(updates = []) {
  const db = getDB()
  const collection = db.collection("transactions")

  if (!Array.isArray(updates) || updates.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  const operations = updates
    .map((item) => {
      const patch = item?.patch || {}
      const allowed = {
        accountId: patch.accountId,
        accountName: patch.accountName,
        date: patch.date,
        description: patch.description,
        amount: patch.amount,
        categoryId: patch.categoryId,
        category: patch.category,
        searchTerms: patch.searchTerms,
        searchText: patch.searchText,
        categorizedAt: patch.categorizedAt,
        categorizedSource: patch.categorizedSource,
        updatedAt: new Date(),
      }

      const $set = Object.fromEntries(
        Object.entries(allowed).filter(([, value]) => value !== undefined)
      )

      if (Object.keys($set).length <= 1) return null

      return {
        updateOne: {
          filter: { _id: new ObjectId(item.id) },
          update: { $set },
        },
      }
    })
    .filter(Boolean)

  if (operations.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  const result = await collection.bulkWrite(operations, { ordered: false })
  return {
    matchedCount: Number(result?.matchedCount || 0),
    modifiedCount: Number(result?.modifiedCount || 0),
  }
}

export async function getTransactionById(id) {
  const db = getDB()
  return db.collection("transactions").findOne({ _id: new ObjectId(id) })
}

export async function listTransactionsByIds(ids = []) {
  const db = getDB()
  const objectIds = Array.isArray(ids)
    ? ids
        .map((id) => String(id || "").trim())
        .filter((id) => id && ObjectId.isValid(id))
        .map((id) => new ObjectId(id))
    : []

  if (objectIds.length === 0) return []

  return db.collection("transactions").find({ _id: { $in: objectIds } }).toArray()
}

export async function deleteTransactionById(id) {
  const db = getDB()
  return db.collection("transactions").deleteOne({ _id: new ObjectId(id) })
}

export async function deleteTransactionsByIds(ids = []) {
  const db = getDB()
  const objectIds = ids.map((id) => new ObjectId(id))
  return db.collection("transactions").deleteMany({ _id: { $in: objectIds } })
}

export async function deleteTransactionsByClientId(clientId) {
  const db = getDB()
  return db.collection("transactions").deleteMany({ clientId })
}

export async function countTransactionsByAccountId(accountId) {
  const db = getDB()
  return db.collection("transactions").countDocuments({ accountId })
}

export async function listLinkedAccountIds(accountIds = []) {
  const db = getDB()
  const safeAccountIds = Array.isArray(accountIds)
    ? [...new Set(accountIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : []

  if (safeAccountIds.length === 0) return []

  return db.collection("transactions").distinct("accountId", {
    accountId: { $in: safeAccountIds },
  })
}

export async function countTransactionsByCategoryId(categoryId) {
  const db = getDB()
  return db.collection("transactions").countDocuments({
    $or: [
      { categoryId },
      { "splits.categoryId": categoryId },
    ],
  })
}

export async function listLinkedCategoryIds(categoryIds = []) {
  const db = getDB()
  const collection = db.collection("transactions")
  const safeCategoryIds = Array.isArray(categoryIds)
    ? [...new Set(categoryIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : []

  if (safeCategoryIds.length === 0) return []

  const [directCategoryIds, splitCategoryIds] = await Promise.all([
    collection.distinct("categoryId", {
      categoryId: { $in: safeCategoryIds },
    }),
    collection.distinct("splits.categoryId", {
      "splits.categoryId": { $in: safeCategoryIds },
    }),
  ])

  return [...new Set([...directCategoryIds, ...splitCategoryIds].filter(Boolean))]
}

export async function listUsedCategoryIdsByClientId(clientId) {
  const db = getDB()
  const collection = db.collection("transactions")

  const [directCategoryIds, splitCategoryIds] = await Promise.all([
    collection.distinct("categoryId", {
      clientId,
      categoryId: {
        $type: "string",
        $nin: ["", null],
      },
    }),
    collection.distinct("splits.categoryId", {
      clientId,
      "splits.categoryId": {
        $type: "string",
        $nin: ["", null],
      },
    }),
  ])

  return Array.from(
    new Set(
      [...directCategoryIds, ...splitCategoryIds]
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  )
}

export async function listEligibleTransactionsForLlmByIds(clientId, transactionIds = []) {
  const db = getDB()
  const collection = db.collection("transactions")
  const objectIds = transactionIds.map((id) => new ObjectId(id))

  return collection
    .find({
      clientId,
      _id: { $in: objectIds },
      description: { $not: ZELLE_DESCRIPTION_REGEX },
      $nor: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
      $or: [
        { categoryId: null },
        { categoryId: "" },
        { category: null },
        { category: "" },
      ],
    })
    .toArray()
}

export async function listEligibleTransactionsForLlmByClientId(clientId) {
  const db = getDB()
  const collection = db.collection("transactions")

  return collection
    .find({
      clientId,
      description: { $not: ZELLE_DESCRIPTION_REGEX },
      $nor: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
      $or: [
        { categoryId: null },
        { categoryId: "" },
        { category: null },
        { category: "" },
      ],
    })
    .sort({ date: -1, _id: -1 })
    .toArray()
}

export async function applyLlmCategorizationUpdates(updates = []) {
  const db = getDB()
  const collection = db.collection("transactions")

  if (!Array.isArray(updates) || updates.length === 0) {
    return { modifiedCount: 0 }
  }

  const operations = updates.map((item) => ({
    updateOne: {
      filter: { _id: new ObjectId(item.id) },
      update: {
        $set: {
          categoryId: item.categoryId ?? null,
          category: item.category ?? null,
          llmProcessed: true,
          llmStatus: item.llmStatus,
          llmProcessedAt: item.llmProcessedAt,
          llmConfidence: item.llmConfidence ?? null,
          llmAmbiguous: item.llmAmbiguous ?? null,
          llmCategorySuggestionId: item.llmCategorySuggestionId ?? null,
          llmCategorySuggestionName: item.llmCategorySuggestionName ?? null,
          categorizedAt: item.categorizedAt ?? null,
          categorizedSource: item.categorizedSource ?? null,
          updatedAt: new Date(),
        },
      },
    },
  }))

  const result = await collection.bulkWrite(operations, { ordered: false })
  return { modifiedCount: result.modifiedCount || 0 }
}

export async function listEligibleTransactionsForZelleByIds(clientId, transactionIds = []) {
  const db = getDB()
  const collection = db.collection("transactions")
  const objectIds = transactionIds.map((id) => new ObjectId(id))

  return collection
    .find({
      clientId,
      _id: { $in: objectIds },
      description: ZELLE_DESCRIPTION_REGEX,
      $nor: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
      $or: [
        { categoryId: null },
        { categoryId: "" },
        { category: null },
        { category: "" },
        { category: "Uncategorized income" },
        { category: "Uncategorized expenses" },
      ],
    })
    .toArray()
}

export async function listEligibleTransactionsForZelleByClientId(clientId) {
  const db = getDB()
  const collection = db.collection("transactions")

  return collection
    .find({
      clientId,
      description: ZELLE_DESCRIPTION_REGEX,
      $nor: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
      $or: [
        { categoryId: null },
        { categoryId: "" },
        { category: null },
        { category: "" },
        { category: "Uncategorized income" },
        { category: "Uncategorized expenses" },
      ],
    })
    .sort({ date: -1, _id: -1 })
    .toArray()
}

export async function applyCategoryUpdates(updates = []) {
  const db = getDB()
  const collection = db.collection("transactions")

  if (!Array.isArray(updates) || updates.length === 0) {
    return { modifiedCount: 0 }
  }

  const operations = updates.map((item) => ({
    updateOne: {
      filter: { _id: new ObjectId(item.id) },
      update: {
        $set: {
          categoryId: item.categoryId ?? null,
          category: item.category ?? null,
          categorizedAt: item.categorizedAt ?? null,
          categorizedSource: item.categorizedSource ?? null,
          updatedAt: new Date(),
        },
      },
    },
  }))

  const result = await collection.bulkWrite(operations, { ordered: false })
  return { modifiedCount: result.modifiedCount || 0 }
}

export async function listTransactionPeriodOptions(clientId) {
  const db = getDB()
  const collection = db.collection("transactions")

  const [result] = await collection
    .aggregate([
      {
        $match: {
          clientId,
          date: { $regex: /^\d{4}-\d{2}-\d{2}$/ },
        },
      },
      {
        $project: {
          year: { $substrBytes: ["$date", 0, 4] },
          month: { $substrBytes: ["$date", 5, 2] },
        },
      },
      {
        $group: {
          _id: null,
          years: { $addToSet: "$year" },
          months: { $addToSet: "$month" },
        },
      },
    ])
    .toArray()

  const years = Array.isArray(result?.years)
    ? [...result.years].sort((a, b) => Number(b) - Number(a))
    : []
  const months = Array.isArray(result?.months)
    ? [...result.months].sort((a, b) => Number(a) - Number(b))
    : []

  return { years, months }
}

function buildTransactionsFilter({
  clientId,
  search = "",
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const conditions = [{ clientId }]
  const safeSearch = String(search || "").trim()

  if (safeSearch) {
    const { normalizedSearchText, tokens, hasOnlyIndexableTokens } = buildTransactionSearchQuery(safeSearch)

    if (hasOnlyIndexableTokens) {
      const regex = new RegExp(escapeRegex(normalizedSearchText), "i")
      conditions.push({
        $or: [
          { searchTerms: { $all: tokens } },
          { searchText: regex },
          buildLegacySearchCondition(regex),
        ],
      })
    } else if (normalizedSearchText) {
      const regex = new RegExp(escapeRegex(normalizedSearchText), "i")
      conditions.push({
        $or: [
          { searchText: regex },
          buildLegacySearchCondition(regex),
        ],
      })
    }
  }

  const safeAccountIds = Array.isArray(accountIds) ? accountIds.filter(Boolean) : []
  if (safeAccountIds.length > 0) {
    conditions.push({ accountId: { $in: safeAccountIds } })
  }

  if (splitMode === "split") {
    conditions.push({
      $or: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
    })
  } else if (splitMode === "regular") {
    conditions.push({
      $nor: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
    })
  }

  if (amountSign === "positive") {
    conditions.push({ amount: { $gt: 0 } })
  } else if (amountSign === "negative") {
    conditions.push({ amount: { $lt: 0 } })
  }

  const safeCategoryIds = Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : []
  if (safeCategoryIds.length > 0 || includeUncategorizedIncome || includeUncategorizedExpenses) {
    const categoryConditions = []
    const uncategorizedIncomeCondition = {
      $or: [
        {
          $and: [
            { amount: { $gt: 0 } },
            {
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized income" },
              ],
            },
          ],
        },
        {
          splits: {
            $elemMatch: {
              amount: { $gt: 0 },
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized income" },
              ],
            },
          },
        },
      ],
    }
    const uncategorizedExpensesCondition = {
      $or: [
        {
          $and: [
            { amount: { $lt: 0 } },
            {
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized expenses" },
              ],
            },
          ],
        },
        {
          splits: {
            $elemMatch: {
              amount: { $lt: 0 },
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized expenses" },
              ],
            },
          },
        },
      ],
    }

    if (safeCategoryIds.length > 0) {
      categoryConditions.push({
        $or: [
          { categoryId: { $in: safeCategoryIds } },
          { "splits.categoryId": { $in: safeCategoryIds } },
        ],
      })
    }

    if (includeUncategorizedIncome) {
      categoryConditions.push(uncategorizedIncomeCondition)
    }

    if (includeUncategorizedExpenses) {
      categoryConditions.push(uncategorizedExpensesCondition)
    }

    if (categoryConditions.length === 1) {
      conditions.push(categoryConditions[0])
    } else {
      conditions.push({ $or: categoryConditions })
    }
  }

  if (fromDate || toDate) {
    const dateQuery = {}
    if (fromDate) dateQuery.$gte = fromDate
    if (toDate) dateQuery.$lte = toDate
    conditions.push({ date: dateQuery })
  }

  const safeYears = Array.isArray(years)
    ? years
      .map((item) => String(item || "").trim())
      .filter((item) => /^\d{4}$/.test(item))
    : []
  const safeMonths = Array.isArray(months)
    ? months
      .map((item) => String(item || "").trim())
      .filter((item) => /^(0[1-9]|1[0-2])$/.test(item))
    : []

  if (safeYears.length > 0 || safeMonths.length > 0) {
    if (safeYears.length > 0 && safeMonths.length > 0) {
      const monthRangeConditions = []
      safeYears.forEach((year) => {
        safeMonths.forEach((month) => {
          monthRangeConditions.push({
            date: {
              $gte: `${year}-${month}-01`,
              $lte: `${year}-${month}-31`,
            },
          })
        })
      })

      if (monthRangeConditions.length === 1) {
        conditions.push(monthRangeConditions[0])
      } else if (monthRangeConditions.length > 1) {
        conditions.push({ $or: monthRangeConditions })
      }
    } else if (safeYears.length > 0) {
      const yearRangeConditions = []
      safeYears.forEach((year) => {
        yearRangeConditions.push({
          date: {
            $gte: `${year}-01-01`,
            $lte: `${year}-12-31`,
          },
        })
      })

      if (yearRangeConditions.length === 1) {
        conditions.push(yearRangeConditions[0])
      } else if (yearRangeConditions.length > 1) {
        conditions.push({ $or: yearRangeConditions })
      }
    } else {
      const dateRegexConditions = []
      safeMonths.forEach((month) => {
        dateRegexConditions.push({ date: new RegExp(`^\\d{4}-${month}-`) })
      })

      if (dateRegexConditions.length === 1) {
        conditions.push(dateRegexConditions[0])
      } else if (dateRegexConditions.length > 1) {
        conditions.push({ $or: dateRegexConditions })
      }
    }
  }

  if (typeof minAmount === "number" || typeof maxAmount === "number") {
    const amountQuery = {}
    if (typeof minAmount === "number") amountQuery.$gte = minAmount
    if (typeof maxAmount === "number") amountQuery.$lte = maxAmount
    conditions.push({ amount: amountQuery })
  }

  if (llmProcessed === "processed") {
    conditions.push({
      $or: [
        { llmProcessed: true },
        { llmProcessedAt: { $ne: null } },
        { llmStatus: { $in: ["suggested", "empty", "error"] } },
      ],
    })
  } else if (llmProcessed === "not_processed") {
    conditions.push({
      $and: [
        {
          $or: [
            { llmProcessed: false },
            { llmProcessed: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmProcessedAt: null },
            { llmProcessedAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmStatus: "not_processed" },
            { llmStatus: null },
            { llmStatus: "" },
            { llmStatus: { $exists: false } },
          ],
        },
      ],
    })
  }

  if (iconType === "ai") {
    conditions.push({
      $and: [
        {
          $or: [
            { categorizedSource: null },
            { categorizedSource: "" },
            { categorizedSource: { $exists: false } },
            { categorizedSource: { $nin: ["memory"] } },
          ],
        },
        {
          $or: [
            { llmProcessed: true },
            { llmProcessedAt: { $ne: null } },
            { llmStatus: { $in: ["suggested", "empty", "error"] } },
          ],
        },
      ],
    })
  } else if (iconType === "memory") {
    conditions.push({ categorizedSource: "memory" })
  } else if (iconType === "none") {
    conditions.push({
      $and: [
        {
          $or: [
            { categorizedSource: null },
            { categorizedSource: "" },
            { categorizedSource: { $exists: false } },
            { categorizedSource: { $nin: ["memory"] } },
          ],
        },
        {
          $or: [
            { llmProcessed: false },
            { llmProcessed: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmProcessedAt: null },
            { llmProcessedAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmStatus: "not_processed" },
            { llmStatus: null },
            { llmStatus: "" },
            { llmStatus: { $exists: false } },
          ],
        },
      ],
    })
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions }
}

// busca paginada
export async function listTransactionsPaginated({
  clientId,
  page = 1,
  limit = 50,
  paginationMode = "page",
  cursor = "",
  search = "",
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const db = getDB()
  const collection = db.collection("transactions")

  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const skip = (safePage - 1) * safeLimit
  const safePaginationMode = String(paginationMode || "page").trim().toLowerCase() === "cursor"
    ? "cursor"
    : "page"

  const filter = buildTransactionsFilter({
    clientId,
    search,
    accountIds,
    categoryIds,
    includeUncategorizedIncome,
    includeUncategorizedExpenses,
    splitMode,
    amountSign,
    years,
    months,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
    llmProcessed,
    iconType,
  })
  const atlasSearchStage = buildTransactionsAtlasSearchStage({ clientId, search })
  const filterWithoutSearch = buildTransactionsFilter({
    clientId,
    search: "",
    accountIds,
    categoryIds,
    includeUncategorizedIncome,
    includeUncategorizedExpenses,
    splitMode,
    amountSign,
    years,
    months,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
    llmProcessed,
    iconType,
  })

  if (safePaginationMode === "cursor") {
    const parsedCursor = decodeTransactionsCursor(cursor)
    const cursorFilter = parsedCursor
      ? {
          $or: [
            { date: { $lt: parsedCursor.date } },
            { date: parsedCursor.date, _id: { $lt: new ObjectId(parsedCursor.id) } },
          ],
        }
      : null

    const finalFilter = cursorFilter ? { $and: [filter, cursorFilter] } : filter
    const finalFilterWithoutSearch = cursorFilter
      ? { $and: [filterWithoutSearch, cursorFilter] }
      : filterWithoutSearch

    if (atlasSearchStage) {
      const rawItems = await runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        { $match: finalFilterWithoutSearch },
        { $sort: { date: -1, _id: -1 } },
        { $limit: safeLimit + 1 },
        { $project: TRANSACTION_LIST_PROJECTION },
      ])

      if (rawItems) {
        const hasMore = rawItems.length > safeLimit
        const items = hasMore ? rawItems.slice(0, safeLimit) : rawItems
        const lastItem = items.length > 0 ? items[items.length - 1] : null

        return {
          items,
          limit: safeLimit,
          hasMore,
          nextCursor: hasMore && lastItem ? encodeTransactionsCursor(lastItem) : null,
          paginationMode: "cursor",
        }
      }
    }

    const rawItems = await collection
      .find(finalFilter, { projection: TRANSACTION_LIST_PROJECTION })
      .sort({ date: -1, _id: -1 })
      .limit(safeLimit + 1)
      .toArray()

    const hasMore = rawItems.length > safeLimit
    const items = hasMore ? rawItems.slice(0, safeLimit) : rawItems
    const lastItem = items.length > 0 ? items[items.length - 1] : null

    return {
      items,
      limit: safeLimit,
      hasMore,
      nextCursor: hasMore && lastItem ? encodeTransactionsCursor(lastItem) : null,
      paginationMode: "cursor",
    }
  }

  if (atlasSearchStage) {
    const [items, totalResult] = await Promise.all([
      runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        { $match: filterWithoutSearch },
        { $sort: { date: -1, _id: -1 } },
        { $skip: skip },
        { $limit: safeLimit },
        { $project: TRANSACTION_LIST_PROJECTION },
      ]),
      runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        { $match: filterWithoutSearch },
        { $count: "total" },
      ]),
    ])

    if (items && totalResult) {
      const total = Number(totalResult?.[0]?.total || 0)
      return {
        items,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      }
    }
  }

  const [items, total] = await Promise.all([
    collection
      .find(filter, { projection: TRANSACTION_LIST_PROJECTION })
      .sort({ date: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    collection.countDocuments(filter),
  ])

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  }
}

export async function summarizeTransactions({
  clientId,
  search = "",
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const db = getDB()
  const collection = db.collection("transactions")

  const filter = buildTransactionsFilter({
    clientId,
    search,
    accountIds,
    categoryIds,
    includeUncategorizedIncome,
    includeUncategorizedExpenses,
    splitMode,
    amountSign,
    years,
    months,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
    llmProcessed,
    iconType,
  })

  const [result] = await collection
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalCount: { $sum: 1 },
        },
      },
    ])
    .toArray()

  return {
    totalAmount: Number(result?.totalAmount || 0),
    totalCount: Number(result?.totalCount || 0),
  }
}
