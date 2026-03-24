import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const BATCH_SIZE = 1000

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

export async function deleteTransactionById(id) {
  const db = getDB()
  return db.collection("transactions").deleteOne({ _id: new ObjectId(id) })
}

// busca paginada
export async function listTransactionsPaginated({
  clientId,
  page = 1,
  limit = 50,
  search = "",
  accountIds = [],
  categoryIds = [],
  includeUncategorized = false,
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
}) {
  const db = getDB()
  const collection = db.collection("transactions")

  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const skip = (safePage - 1) * safeLimit

  const conditions = [{ clientId }]
  const safeSearch = String(search || "").trim()

  if (safeSearch) {
    const regex = new RegExp(escapeRegex(safeSearch), "i")
    conditions.push({
      $or: [
      { description: regex },
      { accountName: regex },
      { category: regex },
      { date: regex },
      ],
    })
  }

  const safeAccountIds = Array.isArray(accountIds) ? accountIds.filter(Boolean) : []
  if (safeAccountIds.length > 0) {
    conditions.push({ accountId: { $in: safeAccountIds } })
  }

  const safeCategoryIds = Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : []
  if (safeCategoryIds.length > 0 || includeUncategorized) {
    const categoryConditions = []

    if (safeCategoryIds.length > 0) {
      categoryConditions.push({ categoryId: { $in: safeCategoryIds } })
    }

    if (includeUncategorized) {
      categoryConditions.push({
        $or: [
          { categoryId: null },
          { categoryId: "" },
          { category: null },
          { category: "" },
        ],
      })
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

  if (typeof minAmount === "number" || typeof maxAmount === "number") {
    const amountQuery = {}
    if (typeof minAmount === "number") amountQuery.$gte = minAmount
    if (typeof maxAmount === "number") amountQuery.$lte = maxAmount
    conditions.push({ amount: amountQuery })
  }

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions }

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
