import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

// Bank reconciliation = per-month proof that the system's cleared
// balance for a bank account equals the bank statement's ending
// balance. One reconciliation doc per (clientId, accountId, statementDate).

const COLLECTION = "reconciliations"

export async function ensureReconciliationIndexes() {
  const db = getDB()
  await Promise.all([
    db.collection(COLLECTION).createIndex({ clientId: 1, accountId: 1, statementDate: -1 }),
    db.collection(COLLECTION).createIndex({ clientId: 1, status: 1 }),
  ])
}

function normalizeLegRefs(refs) {
  if (!Array.isArray(refs)) return []
  return refs
    .map((r) => ({
      entryId: String(r?.entryId || "").trim(),
      legIndex: Number(r?.legIndex),
    }))
    .filter((r) => r.entryId && ObjectId.isValid(r.entryId) && Number.isInteger(r.legIndex) && r.legIndex >= 0)
}

export async function createReconciliation({
  clientId,
  accountId,
  statementDate,
  openingBalance,
  statementEndingBalance,
  createdBy,
}) {
  const db = getDB()
  const safeClientId = String(clientId || "").trim()
  const safeAccountId = String(accountId || "").trim()
  if (!safeClientId) throw new TypeError("clientId is required")
  if (!safeAccountId) throw new TypeError("accountId is required")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(statementDate))) {
    throw new TypeError("statementDate must be YYYY-MM-DD")
  }

  const doc = {
    clientId: safeClientId,
    accountId: safeAccountId,
    statementDate: String(statementDate),
    openingBalance: Math.round(Number(openingBalance || 0) * 100) / 100,
    statementEndingBalance: Math.round(Number(statementEndingBalance || 0) * 100) / 100,
    clearedTotal: 0,
    legRefs: [],
    status: "in_progress",
    createdBy: String(createdBy || ""),
    createdAt: new Date(),
    completedAt: null,
    completedBy: null,
  }

  const result = await db.collection(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function getReconciliationById(id) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function findInProgressReconciliation(clientId, accountId) {
  const db = getDB()
  return db.collection(COLLECTION).findOne({
    clientId: String(clientId),
    accountId: String(accountId),
    status: "in_progress",
  })
}

export async function getLastCompletedReconciliation(clientId, accountId) {
  const db = getDB()
  return db
    .collection(COLLECTION)
    .find({
      clientId: String(clientId),
      accountId: String(accountId),
      status: "completed",
    })
    .sort({ statementDate: -1, completedAt: -1 })
    .limit(1)
    .next()
}

export async function listReconciliationsByClient(clientId, { accountId, limit = 50 } = {}) {
  const db = getDB()
  const filter = { clientId: String(clientId) }
  if (accountId) filter.accountId = String(accountId)
  return db
    .collection(COLLECTION)
    .find(filter)
    .sort({ statementDate: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
    .toArray()
}

export async function patchReconciliation(id, patch) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  const $set = { updatedAt: new Date() }
  if (Array.isArray(patch?.legRefs)) $set.legRefs = normalizeLegRefs(patch.legRefs)
  if (patch?.clearedTotal !== undefined) {
    $set.clearedTotal = Math.round(Number(patch.clearedTotal) * 100) / 100
  }
  if (patch?.statementEndingBalance !== undefined) {
    $set.statementEndingBalance = Math.round(Number(patch.statementEndingBalance) * 100) / 100
  }
  if (patch?.openingBalance !== undefined) {
    $set.openingBalance = Math.round(Number(patch.openingBalance) * 100) / 100
  }
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id), status: "in_progress" },
    { $set },
    { returnDocument: "after" },
  )
  return result?.value ?? result
}

export async function markReconciliationCompleted(id, { completedBy }) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id), status: "in_progress" },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        completedBy: String(completedBy || ""),
      },
    },
    { returnDocument: "after" },
  )
  return result?.value ?? result
}

export async function reopenReconciliationDoc(id, { reopenedBy }) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id), status: "completed" },
    {
      $set: {
        status: "in_progress",
        reopenedAt: new Date(),
        reopenedBy: String(reopenedBy || ""),
        completedAt: null,
        completedBy: null,
      },
    },
    { returnDocument: "after" },
  )
  return result?.value ?? result
}

export async function deleteReconciliationById(id) {
  if (!ObjectId.isValid(String(id))) return { deletedCount: 0 }
  const db = getDB()
  return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
}
