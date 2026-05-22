import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

// Period close = freezing all transactions dated on/before a snapshot
// date for a client. The current state lives as `closedThroughDate` on
// the `clients` doc (null = "books are open"). The `period_closes`
// collection is the audit log of every close / reopen.

const COLLECTION = "period_closes"

export async function ensurePeriodCloseIndexes() {
  const db = getDB()
  await db.collection(COLLECTION).createIndex({ clientId: 1, createdAt: -1 })
}

// Reads the client's current locked-through date. null means books open.
export async function getClientClosedThroughDate(clientId) {
  const db = getDB()
  if (!ObjectId.isValid(String(clientId))) return null
  const client = await db
    .collection("clients")
    .findOne({ _id: new ObjectId(String(clientId)) }, { projection: { closedThroughDate: 1 } })
  const value = client?.closedThroughDate
  if (!value) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null
}

// True when `date` falls on or before the client's current closedThroughDate.
// Anything not-locked passes (no client, no date, books open).
export async function isDateClosed(clientId, date) {
  if (!clientId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return false
  const closedThrough = await getClientClosedThroughDate(clientId)
  if (!closedThrough) return false
  return String(date) <= String(closedThrough)
}

async function setClientClosedThroughDate(clientId, value) {
  const db = getDB()
  if (!ObjectId.isValid(String(clientId))) return
  await db
    .collection("clients")
    .updateOne(
      { _id: new ObjectId(String(clientId)) },
      { $set: { closedThroughDate: value || null, updatedAt: new Date() } },
    )
}

export async function recordPeriodClose({
  clientId,
  closedThroughDate,
  previousClosedThroughDate,
  note,
  createdBy,
}) {
  const db = getDB()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(closedThroughDate))) {
    throw new TypeError("closedThroughDate must be YYYY-MM-DD")
  }
  const doc = {
    clientId: String(clientId),
    action: "close",
    closedThroughDate: String(closedThroughDate),
    previousClosedThroughDate: previousClosedThroughDate
      ? String(previousClosedThroughDate)
      : null,
    note: String(note || "").trim(),
    createdAt: new Date(),
    createdBy: String(createdBy || ""),
  }
  const result = await db.collection(COLLECTION).insertOne(doc)
  await setClientClosedThroughDate(clientId, closedThroughDate)
  return { ...doc, _id: result.insertedId }
}

export async function recordPeriodReopen({
  clientId,
  closedThroughDate,
  previousClosedThroughDate,
  note,
  createdBy,
}) {
  const db = getDB()
  const doc = {
    clientId: String(clientId),
    action: "reopen",
    closedThroughDate: closedThroughDate ? String(closedThroughDate) : null,
    previousClosedThroughDate: previousClosedThroughDate
      ? String(previousClosedThroughDate)
      : null,
    note: String(note || "").trim(),
    createdAt: new Date(),
    createdBy: String(createdBy || ""),
  }
  const result = await db.collection(COLLECTION).insertOne(doc)
  await setClientClosedThroughDate(clientId, closedThroughDate || null)
  return { ...doc, _id: result.insertedId }
}

export async function listPeriodCloseHistory(clientId, { limit = 50 } = {}) {
  const db = getDB()
  return db
    .collection(COLLECTION)
    .find({ clientId: String(clientId) })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
    .toArray()
}

export async function getLatestCloseEvent(clientId) {
  const db = getDB()
  return db
    .collection(COLLECTION)
    .find({ clientId: String(clientId), action: "close" })
    .sort({ createdAt: -1 })
    .limit(1)
    .next()
}
