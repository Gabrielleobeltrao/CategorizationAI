import { getDB } from "../db.js"
import { getClientById } from "./clients.repository.js"

const COLLECTION = "activity_logs"
const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100
const RETENTION_DAYS = 30

export async function ensureActivityLogIndexes() {
  const db = getDB()
  const collection = db.collection(COLLECTION)
  await Promise.all([
    collection.createIndex({ officeId: 1, actorId: 1, at: -1 }),
    collection.createIndex({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 }),
  ])
}

// Best-effort write. Activity logging must never block or fail the caller —
// if Mongo is down or the document is malformed we just swallow the error so
// the user's real action still succeeds.
export async function recordActivity(entry = {}) {
  try {
    const officeId = String(entry.officeId || "").trim()
    const actorId = String(entry.actorId || "").trim()
    const action = String(entry.action || "").trim()
    if (!officeId || !actorId || !action) return null

    const doc = {
      officeId,
      actorId,
      actorName: String(entry.actorName || "").trim(),
      action,
      targetType: String(entry.targetType || "").trim() || null,
      targetId: entry.targetId ? String(entry.targetId).trim() : null,
      // Separate clientId so we can index "recently-worked clients" without
      // having to join through targets (e.g. reconciliation → client).
      clientId: entry.clientId ? String(entry.clientId).trim() : null,
      label: String(entry.label || "").trim(),
      meta: entry.meta && typeof entry.meta === "object" ? entry.meta : null,
      at: entry.at instanceof Date ? entry.at : new Date(),
    }
    const db = getDB()
    await db.collection(COLLECTION).insertOne(doc)
    return doc
  } catch (error) {
    console.warn(`[activityLog] recordActivity failed: ${error?.message || error}`)
    return null
  }
}

// Returns the most recently-touched client IDs (deduped, newest first) by a
// given actor over the last `sinceDays` window.
export async function listClientIdsTouchedByActor(officeId, actorId, { limit = 20, sinceDays = 30 } = {}) {
  const safeOfficeId = String(officeId || "").trim()
  const safeActorId = String(actorId || "").trim()
  if (!safeOfficeId || !safeActorId) return []
  const since = new Date(Date.now() - Math.max(1, Number(sinceDays) || 30) * 24 * 60 * 60 * 1000)

  const db = getDB()
  const rows = await db
    .collection(COLLECTION)
    .aggregate([
      {
        $match: {
          officeId: safeOfficeId,
          actorId: safeActorId,
          clientId: { $exists: true, $ne: null },
          at: { $gte: since },
        },
      },
      { $group: { _id: "$clientId", lastAt: { $max: "$at" } } },
      { $sort: { lastAt: -1 } },
      { $limit: Math.min(50, Math.max(1, Number(limit) || 20)) },
    ])
    .toArray()
  return rows.map((row) => String(row._id))
}

// Convenience wrapper for actions scoped to a client where the caller only
// has clientId — looks up officeId + name once and forwards to recordActivity.
export async function recordActivityForClient({
  clientId,
  actorId,
  actorName,
  action,
  targetType,
  targetId,
  label,
  meta,
}) {
  if (!clientId) return null
  try {
    const client = await getClientById(clientId)
    if (!client) return null
    return recordActivity({
      officeId: client.officeId,
      actorId,
      actorName,
      action,
      targetType: targetType || "client",
      targetId: targetId || clientId,
      clientId,
      label: label || String(client.name || "Client"),
      meta,
    })
  } catch (error) {
    console.warn(`[activityLog] recordActivityForClient failed: ${error?.message || error}`)
    return null
  }
}

export async function listActivityByOfficeAndActor(officeId, actorId, { limit = DEFAULT_LIMIT } = {}) {
  const safeOfficeId = String(officeId || "").trim()
  const safeActorId = String(actorId || "").trim()
  if (!safeOfficeId || !safeActorId) return []
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT))

  const db = getDB()
  return db
    .collection(COLLECTION)
    .find({ officeId: safeOfficeId, actorId: safeActorId })
    .sort({ at: -1 })
    .limit(safeLimit)
    .toArray()
}

// Office-wide listing with optional actor/action filters.
export async function listActivityByOffice(officeId, {
  actorId,
  action,
  targetType,
  from,
  to,
  limit = DEFAULT_LIMIT,
} = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) return []
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT))

  const query = { officeId: safeOfficeId }
  if (actorId) query.actorId = String(actorId).trim()
  if (action) {
    const safeAction = String(action).trim()
    // Allow prefix match for "client" → "client.*"
    if (safeAction.endsWith("*")) {
      query.action = { $regex: `^${safeAction.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` }
    } else {
      query.action = safeAction
    }
  }
  if (targetType) query.targetType = String(targetType).trim()

  if (from || to) {
    query.at = {}
    if (from) {
      const fromDate = new Date(from)
      if (!Number.isNaN(fromDate.getTime())) query.at.$gte = fromDate
    }
    if (to) {
      const toDate = new Date(to)
      if (!Number.isNaN(toDate.getTime())) query.at.$lte = toDate
    }
    if (Object.keys(query.at).length === 0) delete query.at
  }

  const db = getDB()
  return db
    .collection(COLLECTION)
    .find(query)
    .sort({ at: -1 })
    .limit(safeLimit)
    .toArray()
}
