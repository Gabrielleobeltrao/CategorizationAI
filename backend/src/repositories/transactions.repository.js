import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const BATCH_SIZE = 1000

// cria índice uma vez (chame no startup ou antes do primeiro uso)
export async function ensureTransactionsIndexes() {
  const db = getDB()
  await db
    .collection("transactions")
    .createIndex({ officeId: 1, clientId: 1, date: -1 })
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
      officeId: t.officeId,
      clientId: t.clientId,
      accountId: t.accountId ?? null,
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

    // informacoes que podem ser alteradas
    const { date, description, amount, categoryId, category } = patch

    return db.collection("transactions").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { date, description, amount, categoryId, category, updatedAt: new Date() } },
        { returnDocument: "after" }
    )
}

// busca paginada
export async function listTransactionsPaginated({
  officeId,
  clientId,
  page = 1,
  limit = 50,
}) {
  const db = getDB()
  const collection = db.collection("transactions")

  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const skip = (safePage - 1) * safeLimit

  const filter = {
    officeId,
    ...(clientId ? { clientId } : {}),
  }

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