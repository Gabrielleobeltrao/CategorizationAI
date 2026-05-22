import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import { validateTransactionLegs } from "../config/transactionLegs.js"
import { isDateClosed } from "./periodClose.repository.js"

// Journal entries are the canonical double-entry record. One entry =
// one user-visible transaction, with 2+ legs that net to zero (sum of
// debits = sum of credits). Replaces the legacy single-entry `transactions`
// collection.

const COLLECTION = "journal_entries"
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Period-close locking helper. Throws an Error with code
// PERIOD_CLOSED when the given date falls within a closed period for
// the client.
async function assertDateNotClosed(clientId, date, action = "modify") {
  if (await isDateClosed(clientId, date)) {
    const err = new Error(
      `Cannot ${action} a transaction in a closed period. Reopen the period first.`,
    )
    err.code = "PERIOD_CLOSED"
    throw err
  }
}

export async function ensureJournalEntriesIndexes() {
  const db = getDB()
  const collection = db.collection(COLLECTION)

  await Promise.all([
    collection.createIndex({ clientId: 1, date: -1 }),
    collection.createIndex({ clientId: 1, "legs.accountId": 1 }),
    collection.createIndex({ clientId: 1, createdAt: -1 }),
  ])
}

function isValidDate(value) {
  return typeof value === "string" && DATE_REGEX.test(value)
}

function buildDoc(input) {
  const { legs, totalDebits, totalCredits } = validateTransactionLegs(input.legs)

  if (!input.clientId) throw new TypeError("clientId is required")
  if (!isValidDate(input.date)) throw new TypeError("date must be YYYY-MM-DD")

  return {
    clientId: String(input.clientId),
    date: input.date,
    description: typeof input.description === "string" ? input.description.trim() : "",
    legs,
    totalDebits,
    totalCredits,
    source: typeof input.source === "string" ? input.source.trim() : "manual",
    externalId: input.externalId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function createJournalEntry(input) {
  const db = getDB()
  const doc = buildDoc(input)
  await assertDateNotClosed(doc.clientId, doc.date, "create")
  const result = await db.collection(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function insertJournalEntriesInBatches(entries = [], { batchSize = 500 } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return { insertedCount: 0 }
  const db = getDB()
  // Reject the whole batch if ANY entry falls inside a closed period.
  for (const entry of entries) {
    await assertDateNotClosed(entry?.clientId, entry?.date, "import")
  }
  let insertedCount = 0

  for (let i = 0; i < entries.length; i += batchSize) {
    const docs = entries.slice(i, i + batchSize).map(buildDoc)
    const result = await db.collection(COLLECTION).insertMany(docs, { ordered: false })
    insertedCount += result.insertedCount
  }
  return { insertedCount }
}

export async function getJournalEntryById(id) {
  const db = getDB()
  if (!ObjectId.isValid(String(id))) return null
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function updateJournalEntryById(id, patch) {
  const db = getDB()
  if (!ObjectId.isValid(String(id))) return null

  // Lock if the EXISTING entry's date is inside a closed period, OR if
  // the new date (when changing dates) is being moved into one.
  const existing = await db.collection(COLLECTION).findOne(
    { _id: new ObjectId(id) },
    { projection: { clientId: 1, date: 1 } },
  )
  if (existing) {
    await assertDateNotClosed(existing.clientId, existing.date, "edit")
    if (typeof patch.date === "string" && patch.date !== existing.date) {
      await assertDateNotClosed(existing.clientId, patch.date, "move into")
    }
  }

  const $set = { updatedAt: new Date() }

  if (typeof patch.date === "string") {
    if (!isValidDate(patch.date)) throw new TypeError("date must be YYYY-MM-DD")
    $set.date = patch.date
  }

  if (typeof patch.description === "string") {
    $set.description = patch.description.trim()
  }

  if (Array.isArray(patch.legs)) {
    const { legs, totalDebits, totalCredits } = validateTransactionLegs(patch.legs)
    $set.legs = legs
    $set.totalDebits = totalDebits
    $set.totalCredits = totalCredits
  }

  return db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: "after" },
  )
}

export async function deleteJournalEntryById(id) {
  const db = getDB()
  if (!ObjectId.isValid(String(id))) return { deletedCount: 0 }
  const existing = await db
    .collection(COLLECTION)
    .findOne({ _id: new ObjectId(id) }, { projection: { clientId: 1, date: 1 } })
  if (existing) {
    await assertDateNotClosed(existing.clientId, existing.date, "delete")
  }
  return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
}

export async function deleteJournalEntriesByIds(ids = []) {
  const db = getDB()
  const objectIds = Array.isArray(ids)
    ? ids.filter((id) => id && ObjectId.isValid(String(id))).map((id) => new ObjectId(String(id)))
    : []
  if (objectIds.length === 0) return { deletedCount: 0 }
  return db.collection(COLLECTION).deleteMany({ _id: { $in: objectIds } })
}

export async function deleteJournalEntriesByClientId(clientId) {
  const db = getDB()
  return db.collection(COLLECTION).deleteMany({ clientId })
}

export async function listJournalEntriesByClientId(clientId, options = {}) {
  const db = getDB()
  const filter = { clientId }

  if (options.fromDate || options.toDate) {
    filter.date = {}
    if (options.fromDate && isValidDate(options.fromDate)) filter.date.$gte = options.fromDate
    if (options.toDate && isValidDate(options.toDate)) filter.date.$lte = options.toDate
  }

  if (options.accountId) {
    filter["legs.accountId"] = String(options.accountId)
  }

  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 500))
  const skip = Math.max(0, Number(options.skip) || 0)

  return db
    .collection(COLLECTION)
    .find(filter)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray()
}

export async function countJournalEntriesByClientId(clientId, options = {}) {
  const db = getDB()
  const filter = { clientId }
  if (options.fromDate || options.toDate) {
    filter.date = {}
    if (options.fromDate && isValidDate(options.fromDate)) filter.date.$gte = options.fromDate
    if (options.toDate && isValidDate(options.toDate)) filter.date.$lte = options.toDate
  }
  if (options.accountId) {
    filter["legs.accountId"] = String(options.accountId)
  }
  return db.collection(COLLECTION).countDocuments(filter)
}

const SUSPENSE_ACCOUNT_NAME = "Uncategorized"

// Lazily creates (or returns) the per-client "Suspense" account used as
// the placeholder contra-leg for bank-import entries that haven't been
// categorized yet. Marked with `isSuspense: true` so the UI can filter
// for it and reports can skip it from P&L aggregations.
export async function getOrCreateSuspenseAccountId(clientId) {
  const db = getDB()
  const existing = await db
    .collection("coa_accounts")
    .findOne({ clientId, isSuspense: true })
  if (existing) return String(existing._id)

  const result = await db.collection("coa_accounts").insertOne({
    clientId,
    name: SUSPENSE_ACCOUNT_NAME,
    accountType: "asset_current",
    description:
      "Auto-created placeholder for transactions awaiting categorization. Replaced with the correct contra-account by AI or manual review.",
    isActive: true,
    isSuspense: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return String(result.insertedId)
}

// Creates a "half" journal entry from a bank statement row. The bank
// account is one leg (debit if amount > 0, credit if amount < 0); the
// suspense account is the opposite leg. Caller is expected to flip the
// suspense leg later to a real contra-account via categorizeEntry.
export async function createHalfEntry({ clientId, bankAccountId, date, description, amount, externalId = null }) {
  const safeAmount = Math.abs(Number(amount))
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    throw new TypeError("amount must be a non-zero number")
  }
  const suspenseId = await getOrCreateSuspenseAccountId(clientId)

  const moneyIn = Number(amount) > 0
  const legs = [
    {
      accountId: String(bankAccountId),
      debit: moneyIn ? safeAmount : 0,
      credit: moneyIn ? 0 : safeAmount,
      side: moneyIn ? "debit" : "credit",
      description: "",
    },
    {
      accountId: suspenseId,
      debit: moneyIn ? 0 : safeAmount,
      credit: moneyIn ? safeAmount : 0,
      side: moneyIn ? "credit" : "debit",
      description: "",
    },
  ]

  return createJournalEntry({
    clientId,
    date,
    description,
    legs,
    source: "bank_import",
    externalId,
  })
}

// Replaces the suspense leg of an entry with the picked contra-account.
// If the entry has no suspense leg (already categorized) this is a no-op
// returning the existing entry unchanged.
export async function categorizeEntry({ entryId, contraAccountId }) {
  const db = getDB()
  if (!ObjectId.isValid(String(entryId))) throw new TypeError("invalid entryId")
  if (!ObjectId.isValid(String(contraAccountId))) throw new TypeError("invalid contraAccountId")

  const entry = await db.collection(COLLECTION).findOne({ _id: new ObjectId(entryId) })
  if (!entry) return null

  await assertDateNotClosed(entry.clientId, entry.date, "categorize")

  const suspenseId = await getOrCreateSuspenseAccountId(entry.clientId)
  let replaced = false
  const newLegs = entry.legs.map((leg) => {
    if (!replaced && String(leg.accountId) === suspenseId) {
      replaced = true
      return { ...leg, accountId: String(contraAccountId) }
    }
    return leg
  })
  if (!replaced) return entry

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(entryId) },
    { $set: { legs: newLegs, updatedAt: new Date() } },
    { returnDocument: "after" },
  )
  return result?.value ?? result
}

// All entries that still have at least one suspense leg. Used by both
// the Inbox UI and the AI-batch categorizer.
export async function listUncategorizedEntries(clientId, { limit = 200 } = {}) {
  const db = getDB()
  const suspenseId = await getOrCreateSuspenseAccountId(clientId)
  return db
    .collection(COLLECTION)
    .find({ clientId, "legs.accountId": suspenseId })
    .sort({ date: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 200, 1000)))
    .toArray()
}

// True if any journal entry has a leg pointing at the given account.
// Replaces the legacy countTransactionsByAccountId / countTransactionsByCategoryId
// since accounts and categories live in the same coa_accounts collection now.
export async function countLegsByAccountId(accountId) {
  const db = getDB()
  return db.collection(COLLECTION).countDocuments({ "legs.accountId": String(accountId) })
}

export async function listLinkedAccountIds(accountIds = []) {
  const db = getDB()
  const targets = Array.isArray(accountIds)
    ? [...new Set(accountIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : []
  if (targets.length === 0) return []

  const docs = await db
    .collection(COLLECTION)
    .find({ "legs.accountId": { $in: targets } }, { projection: { _id: 0, "legs.accountId": 1 } })
    .toArray()

  const found = new Set()
  for (const doc of docs) {
    for (const leg of doc.legs || []) {
      if (targets.includes(String(leg.accountId))) found.add(String(leg.accountId))
    }
  }
  return [...found]
}

// === Reconciliation helpers ===
// A leg is "cleared" when entry.clearedLegs contains a record with
// matching legIndex. legIndex is the position in the legs array.

function legIsClearedInDoc(entry, legIndex) {
  if (!entry || !Array.isArray(entry.clearedLegs)) return null
  return entry.clearedLegs.find((c) => Number(c?.legIndex) === Number(legIndex)) || null
}

// Returns one row per matching leg with the entry context the worksheet UI
// needs: { entryId, legIndex, date, description, signedAmount, isCleared,
// clearedByReconciliationId }. signedAmount is from the bank's perspective
// (positive = debit/money-in, negative = credit/money-out).
export async function listAccountLegsForReconciliation(clientId, accountId, { upToDate } = {}) {
  const db = getDB()
  const safeClientId = String(clientId || "").trim()
  const safeAccountId = String(accountId || "").trim()
  if (!safeClientId || !safeAccountId) return []

  const filter = { clientId: safeClientId, "legs.accountId": safeAccountId }
  if (upToDate && /^\d{4}-\d{2}-\d{2}$/.test(String(upToDate))) {
    filter.date = { $lte: String(upToDate) }
  }

  const entries = await db
    .collection(COLLECTION)
    .find(filter)
    .sort({ date: 1, _id: 1 })
    .toArray()

  const rows = []
  for (const entry of entries) {
    const legs = Array.isArray(entry.legs) ? entry.legs : []
    legs.forEach((leg, idx) => {
      if (String(leg.accountId) !== safeAccountId) return
      const cleared = legIsClearedInDoc(entry, idx)
      rows.push({
        entryId: String(entry._id),
        legIndex: idx,
        date: entry.date,
        description: entry.description || "",
        signedAmount:
          Math.round((Number(leg.debit || 0) - Number(leg.credit || 0)) * 100) / 100,
        isCleared: Boolean(cleared),
        clearedByReconciliationId: cleared?.reconciliationId
          ? String(cleared.reconciliationId)
          : null,
        clearedAt: cleared?.clearedAt || null,
      })
    })
  }
  return rows
}

// Bulk mark legs as cleared under a given reconciliationId. Idempotent:
// re-running with the same refs is a no-op. legRefs = [{ entryId, legIndex }].
export async function markLegsCleared(legRefs = [], reconciliationId) {
  const db = getDB()
  if (!Array.isArray(legRefs) || legRefs.length === 0) return { matched: 0 }
  if (!ObjectId.isValid(String(reconciliationId))) {
    throw new TypeError("reconciliationId is invalid")
  }
  const clearedAt = new Date()
  const ops = []
  for (const ref of legRefs) {
    const entryId = String(ref?.entryId || "").trim()
    const legIndex = Number(ref?.legIndex)
    if (!entryId || !ObjectId.isValid(entryId)) continue
    if (!Number.isInteger(legIndex) || legIndex < 0) continue
    ops.push({
      updateOne: {
        filter: {
          _id: new ObjectId(entryId),
          "clearedLegs.legIndex": { $ne: legIndex },
        },
        update: {
          $push: {
            clearedLegs: {
              legIndex,
              reconciliationId: String(reconciliationId),
              clearedAt,
            },
          },
        },
      },
    })
  }
  if (ops.length === 0) return { matched: 0 }
  const result = await db.collection(COLLECTION).bulkWrite(ops, { ordered: false })
  return { matched: Number(result?.modifiedCount || 0) }
}

// Removes all cleared markers for a given reconciliation. Used on reopen.
export async function unmarkLegsForReconciliation(reconciliationId) {
  const db = getDB()
  if (!ObjectId.isValid(String(reconciliationId))) return { matched: 0 }
  const result = await db.collection(COLLECTION).updateMany(
    { "clearedLegs.reconciliationId": String(reconciliationId) },
    { $pull: { clearedLegs: { reconciliationId: String(reconciliationId) } } },
  )
  return { matched: Number(result?.modifiedCount || 0) }
}

// True if any leg of the given entry belongs to a completed (or in-progress)
// reconciliation. Used by transactions.repository to block edits/deletes
// on reconciled entries.
export async function entryHasClearedLegs(entryId) {
  const db = getDB()
  if (!ObjectId.isValid(String(entryId))) return false
  const doc = await db
    .collection(COLLECTION)
    .findOne(
      { _id: new ObjectId(entryId) },
      { projection: { clearedLegs: 1 } },
    )
  return Array.isArray(doc?.clearedLegs) && doc.clearedLegs.length > 0
}
