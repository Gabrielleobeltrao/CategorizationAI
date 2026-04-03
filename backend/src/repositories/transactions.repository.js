import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const BATCH_SIZE = 1000
const ZELLE_DESCRIPTION_REGEX = /(^|[^a-z])(zel|zelle)([^a-z]|$)/i

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// cria índice uma vez (chame no startup ou antes do primeiro uso)
export async function ensureTransactionsIndexes() {
  const db = getDB()
  await db
    .collection("transactions")
    .createIndex({ clientId: 1, date: -1 })
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
      llmCategorySuggestionId: t.llmCategorySuggestionId ?? null,
      llmCategorySuggestionName: t.llmCategorySuggestionName ?? null,
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
      llmCategorySuggestionId: patch.llmCategorySuggestionId,
      llmCategorySuggestionName: patch.llmCategorySuggestionName,
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

export async function deleteTransactionById(id) {
  const db = getDB()
  return db.collection("transactions").deleteOne({ _id: new ObjectId(id) })
}

export async function deleteTransactionsByIds(ids = []) {
  const db = getDB()
  const objectIds = ids.map((id) => new ObjectId(id))
  return db.collection("transactions").deleteMany({ _id: { $in: objectIds } })
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
          llmCategorySuggestionId: item.llmCategorySuggestionId ?? null,
          llmCategorySuggestionName: item.llmCategorySuggestionName ?? null,
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
}) {
  const conditions = [{ clientId }]
  const safeSearch = String(search || "").trim()

  if (safeSearch) {
    const regex = new RegExp(escapeRegex(safeSearch), "i")
    conditions.push({
      $or: [
      { description: regex },
      { accountName: regex },
      { category: regex },
      { "splits.category": regex },
      { date: regex },
      ],
    })
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
    const dateRegexConditions = []

    if (safeYears.length > 0 && safeMonths.length > 0) {
      safeYears.forEach((year) => {
        safeMonths.forEach((month) => {
          dateRegexConditions.push({ date: new RegExp(`^${year}-${month}-`) })
        })
      })
    } else if (safeYears.length > 0) {
      safeYears.forEach((year) => {
        dateRegexConditions.push({ date: new RegExp(`^${year}-`) })
      })
    } else {
      safeMonths.forEach((month) => {
        dateRegexConditions.push({ date: new RegExp(`^\\d{4}-${month}-`) })
      })
    }

    if (dateRegexConditions.length === 1) {
      conditions.push(dateRegexConditions[0])
    } else if (dateRegexConditions.length > 1) {
      conditions.push({ $or: dateRegexConditions })
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

  return conditions.length === 1 ? conditions[0] : { $and: conditions }
}

// busca paginada
export async function listTransactionsPaginated({
  clientId,
  page = 1,
  limit = 50,
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
}) {
  const db = getDB()
  const collection = db.collection("transactions")

  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const skip = (safePage - 1) * safeLimit

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
  })

  const [items, total] = await Promise.all([
    collection
      .find(filter)
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
