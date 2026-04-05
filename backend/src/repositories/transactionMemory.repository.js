import { getDB } from "../db.js"

function normalizeKeys(keys = []) {
  return Array.isArray(keys)
    ? keys.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

export async function ensureTransactionMemoryIndexes() {
  const db = getDB()
  const collection = db.collection("transaction_memory")

  try {
    await collection.dropIndex("client_fingerprint_unique")
  } catch {}

  await collection.createIndex(
    { clientId: 1, memoryType: 1, fingerprint: 1 },
    { unique: true, name: "client_memoryType_fingerprint_unique" }
  )

  await collection.createIndex(
    { clientId: 1, memoryType: 1, updatedAt: -1 },
    { name: "client_memoryType_updatedAt_desc" }
  )
}

export async function listTransactionMemoriesByKeys(clientId, memoryType, keys = []) {
  const db = getDB()
  const collection = db.collection("transaction_memory")
  const safeKeys = normalizeKeys(keys)
  const safeMemoryType = String(memoryType || "").trim()

  if (!clientId || !safeMemoryType || safeKeys.length === 0) return []

  return collection.find({
    clientId,
    memoryType: safeMemoryType,
    fingerprint: { $in: safeKeys },
  }).toArray()
}

export async function bulkUpsertTransactionMemories(entries = []) {
  const db = getDB()
  const collection = db.collection("transaction_memory")
  const now = new Date()

  const operations = (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const clientId = String(entry?.clientId || "").trim()
      const memoryType = String(entry?.memoryType || "").trim()
      const fingerprint = String(entry?.fingerprint || "").trim()

      if (!clientId || !memoryType || !fingerprint) return null

      return {
        updateOne: {
          filter: { clientId, memoryType, fingerprint },
          update: {
            $set: {
              accountId: entry?.accountId ?? null,
              direction: entry?.direction ?? null,
              channel: entry?.channel ?? null,
              normalizedDescription: entry?.normalizedDescription ?? "",
              merchantCandidate: entry?.merchantCandidate ?? null,
              exactFingerprint: entry?.exactFingerprint ?? null,
              semanticFingerprint: entry?.semanticFingerprint ?? null,
              categoryId: entry?.categoryId ?? null,
              categoryName: entry?.categoryName ?? null,
              source: entry?.source ?? "llm",
              confidence: entry?.confidence ?? null,
              supportCount: Number(entry?.supportCount || 1),
              reviewStatus: entry?.reviewStatus ?? "confirmed",
              conflictCount: Number(entry?.conflictCount || 0),
              categoryIdsSeen: Array.isArray(entry?.categoryIdsSeen) ? entry.categoryIdsSeen : [],
              lastConflictAt: entry?.lastConflictAt ?? null,
              lastUsedAt: entry?.lastUsedAt ?? now,
              updatedAt: now,
            },
            $setOnInsert: {
              clientId,
              createdAt: now,
            },
          },
          upsert: true,
        },
      }
    })
    .filter(Boolean)

  if (operations.length === 0) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 }
  }

  const result = await collection.bulkWrite(operations, { ordered: false })
  return {
    matchedCount: Number(result?.matchedCount || 0),
    modifiedCount: Number(result?.modifiedCount || 0),
    upsertedCount: Number(result?.upsertedCount || 0),
  }
}

export async function touchTransactionMemories(clientId, memoryType, keys = []) {
  const db = getDB()
  const collection = db.collection("transaction_memory")
  const safeKeys = normalizeKeys(keys)
  const safeMemoryType = String(memoryType || "").trim()

  if (!clientId || !safeMemoryType || safeKeys.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  const result = await collection.updateMany(
    {
      clientId,
      memoryType: safeMemoryType,
      fingerprint: { $in: safeKeys },
    },
    {
      $set: {
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  )

  return {
    matchedCount: Number(result?.matchedCount || 0),
    modifiedCount: Number(result?.modifiedCount || 0),
  }
}

export async function bulkRejectTransactionMemories(entries = []) {
  const db = getDB()
  const collection = db.collection("transaction_memory")
  const now = new Date()

  const operations = (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const clientId = String(entry?.clientId || "").trim()
      const memoryType = String(entry?.memoryType || "").trim()
      const fingerprint = String(entry?.fingerprint || "").trim()

      if (!clientId || !memoryType || !fingerprint) return null

      return {
        updateOne: {
          filter: { clientId, memoryType, fingerprint },
          update: {
            $set: {
              reviewStatus: "rejected",
              lastConflictAt: now,
              updatedAt: now,
            },
            $inc: {
              conflictCount: 1,
            },
          },
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
