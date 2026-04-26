import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import {
  buildTransactionDerivedFields,
  buildTransactionSearchQuery,
  buildTransactionSearchTerms,
  buildTransactionSearchText,
} from "../utils/transactionSearch.js"

const BATCH_SIZE = 1000
const ATLAS_SEARCH_INDEX_NAME = String(process.env.MONGODB_ATLAS_SEARCH_INDEX_NAME || "transactions_autocomplete").trim()
const ATLAS_SEARCH_ENABLED = String(process.env.MONGODB_ATLAS_SEARCH_ENABLED || "true").trim().toLowerCase() !== "false"
const TRANSACTIONS_SEARCH_ENGINE = String(process.env.TRANSACTIONS_SEARCH_ENGINE || "mongo").trim().toLowerCase()
const ATLAS_SEARCH_QUERY_TIMEOUT_MS = Math.max(0, Number(process.env.MONGODB_ATLAS_SEARCH_QUERY_TIMEOUT_MS || 2000))
const ATLAS_SEARCH_COOLDOWN_MS = Math.max(0, Number(process.env.MONGODB_ATLAS_SEARCH_COOLDOWN_MS || 120000))
const TRANSACTIONS_BACKFILL_BATCH_SIZE = Math.max(100, Number(process.env.TRANSACTIONS_BACKFILL_BATCH_SIZE || 500))
const TRANSACTIONS_LEGACY_SEARCH_MAX_TIME_MS = Math.max(0, Number(process.env.TRANSACTIONS_LEGACY_SEARCH_MAX_TIME_MS || 1200))
const TRANSACTIONS_QUERY_DEBUG = String(process.env.TRANSACTIONS_QUERY_DEBUG || "false").trim().toLowerCase() === "true"
const TRANSACTIONS_QUERY_SLOW_MS = Math.max(0, Number(process.env.TRANSACTIONS_QUERY_SLOW_MS || 750))
let atlasSearchDisabledUntil = 0

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6
}

function roundMs(value) {
  return Math.round(Number(value || 0))
}

function countActiveFilters({
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
} = {}) {
  return [
    Array.isArray(accountIds) && accountIds.length > 0,
    Array.isArray(categoryIds) && categoryIds.length > 0,
    includeUncategorizedIncome,
    includeUncategorizedExpenses,
    splitMode !== "all",
    amountSign !== "all",
    Array.isArray(years) && years.length > 0,
    Array.isArray(months) && months.length > 0,
    Boolean(fromDate),
    Boolean(toDate),
    typeof minAmount === "number",
    typeof maxAmount === "number",
    llmProcessed !== "all",
    iconType !== "all",
  ].filter(Boolean).length
}

function shouldLogTransactionsQuery(totalMs) {
  return TRANSACTIONS_QUERY_DEBUG || (TRANSACTIONS_QUERY_SLOW_MS > 0 && totalMs >= TRANSACTIONS_QUERY_SLOW_MS)
}

function logTransactionsQueryMetric(metric = {}) {
  const totalMs = roundMs(metric.totalMs)
  if (!shouldLogTransactionsQuery(totalMs)) return

  console.info("[transactions.query]", JSON.stringify({
    totalMs,
    path: metric.path || "unknown",
    paginationMode: metric.paginationMode || "unknown",
    page: metric.page,
    limit: metric.limit,
    returnedCount: metric.returnedCount,
    hasMore: metric.hasMore,
    searchLength: metric.searchLength,
    activeFilterCount: metric.activeFilterCount,
    accountFilterCount: metric.accountFilterCount,
    categoryFilterCount: metric.categoryFilterCount,
    yearFilterCount: metric.yearFilterCount,
    monthFilterCount: metric.monthFilterCount,
    hasCursor: metric.hasCursor,
    atlasMs: metric.atlasMs,
    fastMs: metric.fastMs,
    legacyMs: metric.legacyMs,
    legacyAttempted: Boolean(metric.legacyAttempted),
    legacyTimedOut: Boolean(metric.legacyTimedOut),
    atlasAttempted: Boolean(metric.atlasAttempted),
    atlasReturned: Boolean(metric.atlasReturned),
  }))
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildCategoryFilterValues(categoryIds = []) {
  const stringValues = []
  const objectIdValues = []
  const seenStrings = new Set()
  const seenObjectIds = new Set()

  for (const rawValue of Array.isArray(categoryIds) ? categoryIds : []) {
    const safeValue = String(rawValue || "").trim()
    if (!safeValue) continue

    if (!seenStrings.has(safeValue)) {
      seenStrings.add(safeValue)
      stringValues.push(safeValue)
    }

    if (ObjectId.isValid(safeValue) && !seenObjectIds.has(safeValue)) {
      seenObjectIds.add(safeValue)
      objectIdValues.push(new ObjectId(safeValue))
    }
  }

  return {
    stringValues,
    objectIdValues,
  }
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

function buildMongoSearchCondition(search = "", mode = "fast") {
  const safeMode = String(mode || "fast").trim().toLowerCase()
  if (safeMode === "none") return null

  const { normalizedSearchText, tokens, hasOnlyIndexableTokens } = buildTransactionSearchQuery(search)
  if (!normalizedSearchText) return null

  if (safeMode === "fast" && hasOnlyIndexableTokens) {
    return { searchTerms: { $all: tokens } }
  }

  const regex = new RegExp(escapeRegex(normalizedSearchText), "i")
  if (safeMode === "legacy") {
    return buildLegacySearchCondition(regex)
  }

  if (safeMode === "full" && hasOnlyIndexableTokens) {
    return {
      $or: [
        { searchTerms: { $all: tokens } },
        { searchText: regex },
        buildLegacySearchCondition(regex),
      ],
    }
  }

  return { searchText: regex }
}

function isLegacySearchTimeout(error) {
  return Number(error?.code || error?.errorResponse?.code || 0) === 50
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

const TRANSACTION_SEARCH_STORED_SOURCE_FIELDS = [
  "_id",
  "clientId",
  "accountId",
  "accountName",
  "date",
  "description",
  "amount",
  "categoryId",
  "category",
  "isSplit",
  "llmProcessed",
  "llmStatus",
  "llmProcessedAt",
  "categorizedSource",
  "llmCategorySuggestionId",
  "llmCategorySuggestionName",
  "searchText",
  "splits",
]

const TRANSACTION_DERIVED_FIELD_NAMES = [
  "dateValue",
  "year",
  "month",
  "hasSplit",
  "allCategoryIds",
  "hasUncategorizedIncome",
  "hasUncategorizedExpense",
  "llmProcessedState",
  "iconType",
]

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
    storedSource: {
      include: TRANSACTION_SEARCH_STORED_SOURCE_FIELDS,
    },
    mappings: {
      dynamic: false,
      fields: {
        clientId: { type: "token" },
        accountId: { type: "token" },
        categoryId: { type: "token" },
        allCategoryIds: { type: "token" },
        categorizedSource: { type: "token" },
        iconType: { type: "token" },
        llmStatus: { type: "token" },
        llmProcessedState: { type: "token" },
        date: { type: "token" },
        year: { type: "token" },
        month: { type: "token" },
        dateValue: { type: "date" },
        amount: { type: "number" },
        llmProcessed: { type: "boolean" },
        isSplit: { type: "boolean" },
        hasSplit: { type: "boolean" },
        hasUncategorizedIncome: { type: "boolean" },
        hasUncategorizedExpense: { type: "boolean" },
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
    message.includes("query requires a search index") ||
    message.includes("returnstoredsource") ||
    message.includes("storedsource")
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

function parseDateAtUtcStart(value = "") {
  const safe = String(value || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return null
  const [yearString, monthString, dayString] = safe.split("-")
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

function parseDateAtUtcEnd(value = "") {
  const start = parseDateAtUtcStart(value)
  if (!start) return null
  return new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    23,
    59,
    59,
    999
  ))
}

function buildTransactionsAtlasFilterClauses({
  clientId,
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
  const clauses = [
    {
      equals: {
        path: "clientId",
        value: String(clientId || "").trim(),
      },
    },
  ]

  const safeAccountIds = Array.isArray(accountIds) ? accountIds.filter(Boolean) : []
  if (safeAccountIds.length > 0) {
    clauses.push({
      in: {
        path: "accountId",
        value: safeAccountIds,
      },
    })
  }

  if (splitMode === "split") {
    clauses.push({
      equals: {
        path: "hasSplit",
        value: true,
      },
    })
  } else if (splitMode === "regular") {
    clauses.push({
      equals: {
        path: "hasSplit",
        value: false,
      },
    })
  }

  if (amountSign === "positive") {
    clauses.push({
      range: {
        path: "amount",
        gt: 0,
      },
    })
  } else if (amountSign === "negative") {
    clauses.push({
      range: {
        path: "amount",
        lt: 0,
      },
    })
  }

  if (typeof minAmount === "number" || typeof maxAmount === "number") {
    const range = { path: "amount" }
    if (typeof minAmount === "number") range.gte = minAmount
    if (typeof maxAmount === "number") range.lte = maxAmount
    clauses.push({ range })
  }

  const categoryFilterValues = buildCategoryFilterValues(categoryIds)
  const safeCategoryIds = categoryFilterValues.stringValues
  if (safeCategoryIds.length > 0 || includeUncategorizedIncome || includeUncategorizedExpenses) {
    const should = []

    if (safeCategoryIds.length > 0) {
      should.push({
        in: {
          path: "allCategoryIds",
          value: safeCategoryIds,
        },
      })
    }

    if (includeUncategorizedIncome) {
      should.push({
        equals: {
          path: "hasUncategorizedIncome",
          value: true,
        },
      })
    }

    if (includeUncategorizedExpenses) {
      should.push({
        equals: {
          path: "hasUncategorizedExpense",
          value: true,
        },
      })
    }

    if (should.length > 0) {
      clauses.push({
        compound: {
          should,
          minimumShouldMatch: 1,
        },
      })
    }
  }

  const fromDateValue = parseDateAtUtcStart(fromDate)
  const toDateValue = parseDateAtUtcEnd(toDate)
  if (fromDateValue || toDateValue) {
    const range = { path: "dateValue" }
    if (fromDateValue) range.gte = fromDateValue
    if (toDateValue) range.lte = toDateValue
    clauses.push({ range })
  }

  const safeYears = Array.isArray(years)
    ? years.map((item) => String(item || "").trim()).filter((item) => /^\d{4}$/.test(item))
    : []
  const safeMonths = Array.isArray(months)
    ? months.map((item) => String(item || "").trim()).filter((item) => /^(0[1-9]|1[0-2])$/.test(item))
    : []

  if (safeYears.length > 0 || safeMonths.length > 0) {
    if (safeYears.length > 0 && safeMonths.length > 0) {
      clauses.push({
        compound: {
          should: safeYears.flatMap((year) =>
            safeMonths.map((month) => ({
              compound: {
                filter: [
                  { equals: { path: "year", value: year } },
                  { equals: { path: "month", value: month } },
                ],
              },
            }))
          ),
          minimumShouldMatch: 1,
        },
      })
    } else if (safeYears.length > 0) {
      clauses.push({
        in: {
          path: "year",
          value: safeYears,
        },
      })
    } else if (safeMonths.length > 0) {
      clauses.push({
        in: {
          path: "month",
          value: safeMonths,
        },
      })
    }
  }

  if (llmProcessed === "processed" || llmProcessed === "not_processed") {
    clauses.push({
      equals: {
        path: "llmProcessedState",
        value: llmProcessed,
      },
    })
  }

  if (iconType === "ai" || iconType === "memory" || iconType === "none") {
    clauses.push({
      equals: {
        path: "iconType",
        value: iconType,
      },
    })
  }

  return clauses
}

function buildTransactionsAtlasSearchStage({
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
  const safeClientId = String(clientId || "").trim()
  const safeSearch = String(search || "").trim()
  if (
    TRANSACTIONS_SEARCH_ENGINE !== "atlas" ||
    !ATLAS_SEARCH_ENABLED ||
    !ATLAS_SEARCH_INDEX_NAME ||
    !safeClientId ||
    !safeSearch
  ) {
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
      returnStoredSource: true,
      compound: {
        filter: buildTransactionsAtlasFilterClauses({
          clientId: safeClientId,
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
        }),
        should,
        minimumShouldMatch: 1,
      },
    },
  }
}

function buildAtlasSearchTimeoutError(timeoutMs) {
  const error = new Error(`Atlas Search timed out after ${timeoutMs}ms`)
  error.code = "ATLAS_SEARCH_TIMEOUT"
  return error
}

async function ensureTransactionsSearchIndex() {
  if (TRANSACTIONS_SEARCH_ENGINE !== "atlas" || !ATLAS_SEARCH_ENABLED || !ATLAS_SEARCH_INDEX_NAME) return

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
  if (atlasSearchDisabledUntil > Date.now()) {
    return null
  }

  try {
    if (ATLAS_SEARCH_QUERY_TIMEOUT_MS <= 0) {
      return await collection.aggregate(pipeline).toArray()
    }

    return await Promise.race([
      collection.aggregate(pipeline).toArray(),
      new Promise((_, reject) => {
        setTimeout(() => reject(buildAtlasSearchTimeoutError(ATLAS_SEARCH_QUERY_TIMEOUT_MS)), ATLAS_SEARCH_QUERY_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    if (error?.code === "ATLAS_SEARCH_TIMEOUT" || isAtlasSearchUnavailableError(error)) {
      atlasSearchDisabledUntil = Date.now() + ATLAS_SEARCH_COOLDOWN_MS
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
    collection.createIndex({ clientId: 1, searchTerms: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, accountId: 1, searchTerms: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, year: 1, month: 1, searchTerms: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, dateValue: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, year: 1, month: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, accountId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, categoryId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, allCategoryIds: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, hasSplit: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, llmProcessedState: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, iconType: 1, date: -1, _id: -1 }),
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

function buildTransactionsBackfillFilter() {
  return {
    $or: [
      { searchTerms: { $exists: false } },
      { searchText: { $exists: false } },
      ...TRANSACTION_DERIVED_FIELD_NAMES.map((field) => ({ [field]: { $exists: false } })),
    ],
  }
}

export async function backfillTransactionsSearchAndDerivedFields() {
  const db = getDB()
  const collection = db.collection("transactions")

  while (true) {
    const transactions = await collection
      .find(buildTransactionsBackfillFilter())
      .project({
        _id: 1,
        date: 1,
        description: 1,
        accountName: 1,
        amount: 1,
        categoryId: 1,
        category: 1,
        splits: 1,
        isSplit: 1,
        llmProcessed: 1,
        llmStatus: 1,
        llmProcessedAt: 1,
        categorizedSource: 1,
      })
      .limit(TRANSACTIONS_BACKFILL_BATCH_SIZE)
      .toArray()

    if (transactions.length === 0) return

    const operations = transactions.map((transaction) => ({
      updateOne: {
        filter: { _id: transaction._id },
        update: {
          $set: {
            searchTerms: buildTransactionSearchTerms(transaction),
            searchText: buildTransactionSearchText(transaction),
            ...buildTransactionDerivedFields(transaction),
            updatedAt: new Date(),
          },
        },
      },
    }))

    await collection.bulkWrite(operations, { ordered: false })
  }
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
      ...buildTransactionDerivedFields(t),
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
      dateValue: patch.dateValue,
      year: patch.year,
      month: patch.month,
      hasSplit: patch.hasSplit,
      allCategoryIds: patch.allCategoryIds,
      hasUncategorizedIncome: patch.hasUncategorizedIncome,
      hasUncategorizedExpense: patch.hasUncategorizedExpense,
      llmProcessedState: patch.llmProcessedState,
      iconType: patch.iconType,
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
        dateValue: patch.dateValue,
        year: patch.year,
        month: patch.month,
        hasSplit: patch.hasSplit,
        allCategoryIds: patch.allCategoryIds,
        hasUncategorizedIncome: patch.hasUncategorizedIncome,
        hasUncategorizedExpense: patch.hasUncategorizedExpense,
        llmProcessedState: patch.llmProcessedState,
        iconType: patch.iconType,
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
  const categoryFilterValues = buildCategoryFilterValues([categoryId])
  const directConditions = []
  const splitConditions = []

  if (categoryFilterValues.stringValues.length > 0) {
    directConditions.push({ categoryId: { $in: categoryFilterValues.stringValues } })
    splitConditions.push({ "splits.categoryId": { $in: categoryFilterValues.stringValues } })
  }

  if (categoryFilterValues.objectIdValues.length > 0) {
    directConditions.push({ categoryId: { $in: categoryFilterValues.objectIdValues } })
    splitConditions.push({ "splits.categoryId": { $in: categoryFilterValues.objectIdValues } })
  }

  if (directConditions.length === 0 && splitConditions.length === 0) {
    return 0
  }

  return db.collection("transactions").countDocuments({
    $or: [...directConditions, ...splitConditions],
  })
}

export async function listLinkedCategoryIds(categoryIds = []) {
  const db = getDB()
  const collection = db.collection("transactions")
  const categoryFilterValues = buildCategoryFilterValues(categoryIds)
  const safeCategoryIds = categoryFilterValues.stringValues

  if (safeCategoryIds.length === 0) return []

  const [directCategoryIds, splitCategoryIds] = await Promise.all([
    collection.distinct("categoryId", {
      $or: [
        { categoryId: { $in: categoryFilterValues.stringValues } },
        ...(categoryFilterValues.objectIdValues.length > 0
          ? [{ categoryId: { $in: categoryFilterValues.objectIdValues } }]
          : []),
      ],
    }),
    collection.distinct("splits.categoryId", {
      $or: [
        { "splits.categoryId": { $in: categoryFilterValues.stringValues } },
        ...(categoryFilterValues.objectIdValues.length > 0
          ? [{ "splits.categoryId": { $in: categoryFilterValues.objectIdValues } }]
          : []),
      ],
    }),
  ])

  return [
    ...new Set(
      [...directCategoryIds, ...splitCategoryIds]
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ]
}

export async function listUsedCategoryIdsByClientId(clientId) {
  const db = getDB()
  const collection = db.collection("transactions")

  const [directCategoryIds, splitCategoryIds] = await Promise.all([
    collection.distinct("categoryId", {
      clientId,
      categoryId: {
        $nin: ["", null],
      },
    }),
    collection.distinct("splits.categoryId", {
      clientId,
      "splits.categoryId": {
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
          searchTerms: item.searchTerms,
          searchText: item.searchText,
          dateValue: item.dateValue,
          year: item.year,
          month: item.month,
          hasSplit: item.hasSplit,
          allCategoryIds: item.allCategoryIds,
          hasUncategorizedIncome: item.hasUncategorizedIncome,
          hasUncategorizedExpense: item.hasUncategorizedExpense,
          llmProcessedState: item.llmProcessedState,
          iconType: item.iconType,
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
          searchTerms: item.searchTerms,
          searchText: item.searchText,
          dateValue: item.dateValue,
          year: item.year,
          month: item.month,
          hasSplit: item.hasSplit,
          allCategoryIds: item.allCategoryIds,
          hasUncategorizedIncome: item.hasUncategorizedIncome,
          hasUncategorizedExpense: item.hasUncategorizedExpense,
          llmProcessedState: item.llmProcessedState,
          iconType: item.iconType,
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
  searchMode = "fast",
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

  const searchCondition = buildMongoSearchCondition(search, searchMode)
  if (searchCondition) {
    conditions.push(searchCondition)
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

  const categoryFilterValues = buildCategoryFilterValues(categoryIds)
  const safeCategoryIds = categoryFilterValues.stringValues
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
      const directCategoryConditions = []
      const splitCategoryConditions = []
      const derivedCategoryConditions = []

      if (categoryFilterValues.stringValues.length > 0) {
        derivedCategoryConditions.push({ allCategoryIds: { $in: categoryFilterValues.stringValues } })
        directCategoryConditions.push({ categoryId: { $in: categoryFilterValues.stringValues } })
        splitCategoryConditions.push({ "splits.categoryId": { $in: categoryFilterValues.stringValues } })
      }

      if (categoryFilterValues.objectIdValues.length > 0) {
        directCategoryConditions.push({ categoryId: { $in: categoryFilterValues.objectIdValues } })
        splitCategoryConditions.push({ "splits.categoryId": { $in: categoryFilterValues.objectIdValues } })
      }

      categoryConditions.push({
        $or: [
          ...derivedCategoryConditions,
          ...directCategoryConditions,
          ...splitCategoryConditions,
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

function buildCursorFilterFromCursor(cursor = "") {
  const parsedCursor = decodeTransactionsCursor(cursor)
  if (!parsedCursor) return null

  return {
    $or: [
      { date: { $lt: parsedCursor.date } },
      { date: parsedCursor.date, _id: { $lt: new ObjectId(parsedCursor.id) } },
    ],
  }
}

function combineMongoFilters(...filters) {
  const safeFilters = filters.filter(Boolean)
  if (safeFilters.length === 0) return {}
  if (safeFilters.length === 1) return safeFilters[0]
  return { $and: safeFilters }
}

function buildCursorPagePayload(rawItems = [], safeLimit) {
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

async function findTransactionsCursorPage(collection, filter, safeLimit, options = {}) {
  let cursor = collection
    .find(filter, { projection: TRANSACTION_LIST_PROJECTION })
    .sort({ date: -1, _id: -1 })
    .limit(safeLimit + 1)

  const maxTimeMS = Math.max(0, Number(options?.maxTimeMS || 0))
  if (maxTimeMS > 0) {
    cursor = cursor.maxTimeMS(maxTimeMS)
  }

  const rawItems = await cursor.toArray()
  return buildCursorPagePayload(rawItems, safeLimit)
}

async function findTransactionsPage(collection, filter, safePage, safeLimit, options = {}) {
  const skip = (safePage - 1) * safeLimit
  let itemsCursor = collection
    .find(filter, { projection: TRANSACTION_LIST_PROJECTION })
    .sort({ date: -1, _id: -1 })
    .skip(skip)
    .limit(safeLimit)

  let countCursor = collection.countDocuments(filter)
  const maxTimeMS = Math.max(0, Number(options?.maxTimeMS || 0))
  if (maxTimeMS > 0) {
    itemsCursor = itemsCursor.maxTimeMS(maxTimeMS)
    countCursor = collection.countDocuments(filter, { maxTimeMS })
  }

  const [items, total] = await Promise.all([
    itemsCursor.toArray(),
    countCursor,
  ])

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  }
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
  const queryStartMs = nowMs()
  const metric = {
    path: "mongo-fast",
    paginationMode,
    page: Number(page) || 1,
    limit: Number(limit) || 50,
    searchLength: String(search || "").trim().length,
    accountFilterCount: Array.isArray(accountIds) ? accountIds.length : 0,
    categoryFilterCount: Array.isArray(categoryIds) ? categoryIds.length : 0,
    yearFilterCount: Array.isArray(years) ? years.length : 0,
    monthFilterCount: Array.isArray(months) ? months.length : 0,
    activeFilterCount: countActiveFilters({
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
    }),
    hasCursor: Boolean(String(cursor || "").trim()),
    atlasAttempted: false,
    atlasReturned: false,
    legacyAttempted: false,
    legacyTimedOut: false,
  }

  const db = getDB()
  const collection = db.collection("transactions")

  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const safePaginationMode = String(paginationMode || "page").trim().toLowerCase() === "cursor"
    ? "cursor"
    : "page"
  const safeSearch = String(search || "").trim()

  const filter = buildTransactionsFilter({
    clientId,
    search,
    searchMode: "fast",
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
  const legacySearchFilter = safeSearch
    ? buildTransactionsFilter({
        clientId,
        search,
        searchMode: "legacy",
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
    : null
  const atlasSearchStage = buildTransactionsAtlasSearchStage({
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
  if (safePaginationMode === "cursor") {
    const cursorFilter = buildCursorFilterFromCursor(cursor)
    const finalFilter = combineMongoFilters(filter, cursorFilter)

    if (atlasSearchStage) {
      metric.atlasAttempted = true
      const atlasStartMs = nowMs()
      const rawItems = await runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        ...(cursorFilter ? [{ $match: cursorFilter }] : []),
        { $sort: { date: -1, _id: -1 } },
        { $limit: safeLimit + 1 },
        { $project: TRANSACTION_LIST_PROJECTION },
      ])
      metric.atlasMs = roundMs(nowMs() - atlasStartMs)

      if (rawItems && rawItems.length > 0) {
        const hasMore = rawItems.length > safeLimit
        const items = hasMore ? rawItems.slice(0, safeLimit) : rawItems
        const lastItem = items.length > 0 ? items[items.length - 1] : null
        const result = {
          items,
          limit: safeLimit,
          hasMore,
          nextCursor: hasMore && lastItem ? encodeTransactionsCursor(lastItem) : null,
          paginationMode: "cursor",
        }

        metric.path = "atlas"
        metric.atlasReturned = true
        metric.returnedCount = items.length
        metric.hasMore = hasMore
        metric.totalMs = nowMs() - queryStartMs
        logTransactionsQueryMetric(metric)
        return result
      }
    }

    const fastStartMs = nowMs()
    const fastResult = await findTransactionsCursorPage(collection, finalFilter, safeLimit)
    metric.fastMs = roundMs(nowMs() - fastStartMs)
    if (!safeSearch || fastResult.items.length > 0 || !legacySearchFilter) {
      metric.path = "mongo-fast"
      metric.returnedCount = fastResult.items.length
      metric.hasMore = Boolean(fastResult.hasMore)
      metric.totalMs = nowMs() - queryStartMs
      logTransactionsQueryMetric(metric)
      return fastResult
    }

    try {
      metric.legacyAttempted = true
      const legacyStartMs = nowMs()
      const legacyResult = await findTransactionsCursorPage(
        collection,
        combineMongoFilters(legacySearchFilter, cursorFilter),
        safeLimit,
        { maxTimeMS: TRANSACTIONS_LEGACY_SEARCH_MAX_TIME_MS }
      )
      metric.path = "mongo-legacy"
      metric.legacyMs = roundMs(nowMs() - legacyStartMs)
      metric.returnedCount = legacyResult.items.length
      metric.hasMore = Boolean(legacyResult.hasMore)
      metric.totalMs = nowMs() - queryStartMs
      logTransactionsQueryMetric(metric)
      return legacyResult
    } catch (error) {
      if (isLegacySearchTimeout(error)) {
        metric.path = "mongo-fast-legacy-timeout"
        metric.legacyAttempted = true
        metric.legacyTimedOut = true
        metric.legacyMs = TRANSACTIONS_LEGACY_SEARCH_MAX_TIME_MS
        metric.returnedCount = fastResult.items.length
        metric.hasMore = Boolean(fastResult.hasMore)
        metric.totalMs = nowMs() - queryStartMs
        logTransactionsQueryMetric(metric)
        return fastResult
      }
      throw error
    }
  }

  if (atlasSearchStage) {
    metric.atlasAttempted = true
    const atlasStartMs = nowMs()
    const [items, totalResult] = await Promise.all([
      runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        { $sort: { date: -1, _id: -1 } },
        { $skip: (safePage - 1) * safeLimit },
        { $limit: safeLimit },
        { $project: TRANSACTION_LIST_PROJECTION },
      ]),
      runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        { $count: "total" },
      ]),
    ])
    metric.atlasMs = roundMs(nowMs() - atlasStartMs)

    if (items && totalResult && items.length > 0) {
      const total = Number(totalResult?.[0]?.total || 0)
      const result = {
        items,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      }
      metric.path = "atlas"
      metric.atlasReturned = true
      metric.returnedCount = items.length
      metric.hasMore = safePage < result.totalPages
      metric.totalMs = nowMs() - queryStartMs
      logTransactionsQueryMetric(metric)
      return result
    }
  }

  const fastStartMs = nowMs()
  const fastResult = await findTransactionsPage(collection, filter, safePage, safeLimit)
  metric.fastMs = roundMs(nowMs() - fastStartMs)
  if (!safeSearch || fastResult.items.length > 0 || !legacySearchFilter) {
    metric.path = "mongo-fast"
    metric.returnedCount = fastResult.items.length
    metric.hasMore = safePage < fastResult.totalPages
    metric.totalMs = nowMs() - queryStartMs
    logTransactionsQueryMetric(metric)
    return fastResult
  }

  try {
    metric.legacyAttempted = true
    const legacyStartMs = nowMs()
    const legacyResult = await findTransactionsPage(collection, legacySearchFilter, safePage, safeLimit, {
      maxTimeMS: TRANSACTIONS_LEGACY_SEARCH_MAX_TIME_MS,
    })
    metric.path = "mongo-legacy"
    metric.legacyMs = roundMs(nowMs() - legacyStartMs)
    metric.returnedCount = legacyResult.items.length
    metric.hasMore = safePage < legacyResult.totalPages
    metric.totalMs = nowMs() - queryStartMs
    logTransactionsQueryMetric(metric)
    return legacyResult
  } catch (error) {
    if (isLegacySearchTimeout(error)) {
      metric.path = "mongo-fast-legacy-timeout"
      metric.legacyAttempted = true
      metric.legacyTimedOut = true
      metric.legacyMs = TRANSACTIONS_LEGACY_SEARCH_MAX_TIME_MS
      metric.returnedCount = fastResult.items.length
      metric.hasMore = safePage < fastResult.totalPages
      metric.totalMs = nowMs() - queryStartMs
      logTransactionsQueryMetric(metric)
      return fastResult
    }
    throw error
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
