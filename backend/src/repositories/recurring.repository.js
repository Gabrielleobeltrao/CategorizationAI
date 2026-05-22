import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import { validateTransactionLegs } from "../config/transactionLegs.js"

// Recurring journal entry templates. Each row holds the legs to apply
// on every run plus a schedule (frequency + nextRunDate). The actual
// journal_entries are created on demand when the bookkeeper clicks
// "Run now" — no background worker in the MVP.

const COLLECTION = "recurring_journal_entries"
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const FREQUENCIES = ["monthly", "yearly", "weekly", "biweekly"]

function isValidDate(value) {
  return typeof value === "string" && DATE_REGEX.test(value)
}

function normalizeRecurringDoc(input) {
  const safeName = String(input?.name || "").trim()
  if (!safeName) throw new TypeError("name is required")
  if (!input?.clientId) throw new TypeError("clientId is required")
  if (!isValidDate(input?.startDate)) throw new TypeError("startDate must be YYYY-MM-DD")
  if (input?.endDate && !isValidDate(input.endDate)) {
    throw new TypeError("endDate must be YYYY-MM-DD or null")
  }
  if (!FREQUENCIES.includes(input?.frequency)) {
    throw new TypeError(`frequency must be one of ${FREQUENCIES.join(", ")}`)
  }
  const { legs, totalDebits, totalCredits } = validateTransactionLegs(input.legs)

  const frequency = input.frequency
  let dayOfMonth = null
  let monthOfYear = null
  let dayOfWeek = null

  if (frequency === "monthly") {
    dayOfMonth = Number(input.dayOfMonth)
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      throw new TypeError("dayOfMonth must be 1-31 for monthly frequency")
    }
  } else if (frequency === "yearly") {
    dayOfMonth = Number(input.dayOfMonth)
    monthOfYear = Number(input.monthOfYear)
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      throw new TypeError("dayOfMonth must be 1-31 for yearly frequency")
    }
    if (!Number.isInteger(monthOfYear) || monthOfYear < 1 || monthOfYear > 12) {
      throw new TypeError("monthOfYear must be 1-12 for yearly frequency")
    }
  } else if (frequency === "weekly" || frequency === "biweekly") {
    dayOfWeek = Number(input.dayOfWeek)
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new TypeError("dayOfWeek must be 0-6 (0=Sunday) for weekly/biweekly")
    }
  }

  return {
    clientId: String(input.clientId),
    name: safeName,
    description: String(input.description || "").trim(),
    legs,
    totalDebits,
    totalCredits,
    frequency,
    dayOfMonth,
    monthOfYear,
    dayOfWeek,
    startDate: input.startDate,
    endDate: input.endDate || null,
    nextRunDate: isValidDate(input?.nextRunDate) ? input.nextRunDate : input.startDate,
    lastRunDate: isValidDate(input?.lastRunDate) ? input.lastRunDate : null,
    isActive: input?.isActive !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: String(input?.createdBy || ""),
  }
}

export async function ensureRecurringIndexes() {
  const db = getDB()
  await Promise.all([
    db.collection(COLLECTION).createIndex({ clientId: 1, isActive: 1, nextRunDate: 1 }),
    db.collection(COLLECTION).createIndex({ clientId: 1, createdAt: -1 }),
  ])
}

export async function createRecurring(input) {
  const db = getDB()
  const doc = normalizeRecurringDoc(input)
  const result = await db.collection(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function listRecurringByClient(clientId) {
  const db = getDB()
  return db
    .collection(COLLECTION)
    .find({ clientId: String(clientId) })
    .sort({ isActive: -1, nextRunDate: 1, name: 1 })
    .toArray()
}

export async function getRecurringById(id) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(String(id)) })
}

export async function updateRecurring(id, patch) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  const current = await getRecurringById(id)
  if (!current) return null

  // Normalize the merged doc through the same validator so legs / schedule
  // are kept consistent. The merge preserves untouched fields.
  const merged = { ...current, ...(patch || {}) }
  const normalized = normalizeRecurringDoc(merged)
  normalized.createdAt = current.createdAt
  normalized.createdBy = current.createdBy
  normalized.updatedAt = new Date()

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(String(id)) },
    { $set: normalized },
    { returnDocument: "after" },
  )
  return result?.value ?? result
}

export async function deleteRecurring(id) {
  if (!ObjectId.isValid(String(id))) return { deletedCount: 0 }
  const db = getDB()
  return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(String(id)) })
}

export async function patchScheduleProgress(id, { nextRunDate, lastRunDate, isActive }) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  const $set = { updatedAt: new Date() }
  if (nextRunDate !== undefined) $set.nextRunDate = nextRunDate
  if (lastRunDate !== undefined) $set.lastRunDate = lastRunDate
  if (isActive !== undefined) $set.isActive = Boolean(isActive)
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(String(id)) },
    { $set },
    { returnDocument: "after" },
  )
  return result?.value ?? result
}

export async function setRecurringActive(id, isActive) {
  return patchScheduleProgress(id, { isActive })
}
