import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const COLLECTION = "categorization_jobs"

export async function ensureCategorizationJobsIndexes() {
  const db = getDB()
  const collection = db.collection(COLLECTION)
  await Promise.all([
    collection.createIndex({ createdBy: 1, createdAt: -1 }),
    collection.createIndex({ status: 1, createdAt: 1 }),
    collection.createIndex({ clientId: 1, createdAt: -1 }),
    collection.createIndex({ clientId: 1, updatedAt: -1, createdAt: -1 }),
    collection.createIndex({ clientId: 1, createdBy: 1, updatedAt: -1 }),
  ])
}

export async function createCategorizationJob(doc) {
  const db = getDB()
  const collection = db.collection(COLLECTION)
  const now = new Date()

  const payload = {
    type: "categorize_all_llm",
    status: "queued",
    stage: "queued",
    clientId: doc.clientId,
    mode: doc.mode,
    transactionIds: Array.isArray(doc.transactionIds) ? doc.transactionIds : [],
    requestedCount: Number(doc.requestedCount || 0),
    createdBy: doc.createdBy || "",
    total: 0,
    processed: 0,
    progressPct: 0,
    errorMessage: null,
    result: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  }

  const result = await collection.insertOne(payload)
  return {
    ...payload,
    _id: result.insertedId,
  }
}

export async function getCategorizationJobById(id) {
  const db = getDB()
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function listCategorizationJobsByUser(userId, options = {}) {
  const db = getDB()
  const collection = db.collection(COLLECTION)
  const limit = Math.max(1, Math.min(50, Number(options.limit || 20)))

  return collection
    .find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}

export async function listQueuedCategorizationJobs(limit = 10) {
  const db = getDB()
  return db
    .collection(COLLECTION)
    .find({ status: "queued" })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()
}

export async function markRunningCategorizationJobsAsQueued() {
  const db = getDB()
  const now = new Date()
  await db.collection(COLLECTION).updateMany(
    { status: "running" },
    {
      $set: {
        status: "queued",
        stage: "queued",
        updatedAt: now,
        startedAt: null,
      },
    }
  )
}

export async function updateCategorizationJobProgress(id, patch = {}) {
  const db = getDB()
  const total = Number(patch.total || 0)
  const processed = Number(patch.processed || 0)
  const safeTotal = total > 0 ? total : 0
  const safeProcessed = processed > 0 ? Math.min(processed, safeTotal || processed) : 0
  const progressPct = safeTotal > 0
    ? Math.max(0, Math.min(100, Math.round((safeProcessed / safeTotal) * 100)))
    : 0

  const $set = {
    updatedAt: new Date(),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.stage !== undefined ? { stage: patch.stage } : {}),
    ...(patch.total !== undefined ? { total: safeTotal } : {}),
    ...(patch.processed !== undefined ? { processed: safeProcessed } : {}),
    ...(patch.total !== undefined || patch.processed !== undefined ? { progressPct } : {}),
    ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
    ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
    ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
    ...(patch.result !== undefined ? { result: patch.result } : {}),
  }

  await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set }
  )
}

export async function deleteCategorizationJobsByClientId(clientId) {
  const db = getDB()
  return db.collection(COLLECTION).deleteMany({ clientId })
}
