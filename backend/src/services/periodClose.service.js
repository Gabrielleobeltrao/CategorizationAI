import { ObjectId } from "mongodb"
import { AppError } from "../utils/appError.js"
import { getDB } from "../db.js"
import {
  getClientClosedThroughDate,
  recordPeriodClose,
  recordPeriodReopen,
  listPeriodCloseHistory,
  getLatestCloseEvent,
} from "../repositories/periodClose.repository.js"
import { getOrCreateSuspenseAccountId } from "../repositories/journalEntries.repository.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value) {
  return typeof value === "string" && DATE_REGEX.test(value)
}

function assertDate(value, field) {
  if (!isValidDate(value)) {
    throw new AppError(`${field} must be YYYY-MM-DD`, 400)
  }
}

// === Pre-close checks ===
// Soft warnings the bookkeeper sees before pulling the trigger. None of
// them block the close — they exist to help the bookkeeper realize when
// they're freezing books that still have loose ends.

async function getUnreconciledByAccount(clientId, throughDate) {
  // Per bank-like account, count legs that haven't been cleared by any
  // reconciliation and whose entry date is <= throughDate.
  const db = getDB()
  const accounts = await db
    .collection("coa_accounts")
    .find({
      clientId: String(clientId),
      accountType: {
        $in: ["asset_current", "asset_noncurrent", "liability_current", "liability_noncurrent"],
      },
      isSuspense: { $ne: true },
      isActive: { $ne: false },
    })
    .toArray()

  const out = []
  for (const acc of accounts) {
    const accountId = String(acc._id)
    const entries = await db
      .collection("journal_entries")
      .aggregate([
        {
          $match: {
            clientId: String(clientId),
            "legs.accountId": accountId,
            date: { $regex: DATE_REGEX, $lte: throughDate },
          },
        },
        {
          $project: {
            legs: 1,
            clearedLegs: 1,
          },
        },
      ])
      .toArray()

    let uncleared = 0
    for (const entry of entries) {
      const cleared = Array.isArray(entry.clearedLegs) ? entry.clearedLegs : []
      const legs = Array.isArray(entry.legs) ? entry.legs : []
      legs.forEach((leg, idx) => {
        if (String(leg.accountId) !== accountId) return
        const wasCleared = cleared.some((c) => Number(c?.legIndex) === idx)
        if (!wasCleared) uncleared += 1
      })
    }
    if (uncleared > 0) {
      out.push({ accountId, name: acc.name, accountType: acc.accountType, unclearedCount: uncleared })
    }
  }
  return out
}

async function countUncategorizedThrough(clientId, throughDate) {
  const db = getDB()
  const suspenseId = await getOrCreateSuspenseAccountId(String(clientId))
  return db.collection("journal_entries").countDocuments({
    clientId: String(clientId),
    "legs.accountId": suspenseId,
    date: { $regex: DATE_REGEX, $lte: throughDate },
  })
}

export async function getPreCloseChecksService({ clientId, throughDate }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  assertDate(throughDate, "throughDate")
  const [unreconciled, uncategorized] = await Promise.all([
    getUnreconciledByAccount(clientId, throughDate),
    countUncategorizedThrough(clientId, throughDate),
  ])
  return {
    throughDate,
    unreconciledByAccount: unreconciled,
    uncategorizedCount: uncategorized,
  }
}

// === State + history ===

export async function getCurrentStateService({ clientId }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  const [closedThroughDate, latestClose] = await Promise.all([
    getClientClosedThroughDate(clientId),
    getLatestCloseEvent(clientId),
  ])
  return {
    closedThroughDate: closedThroughDate || null,
    closedAt: latestClose?.createdAt || null,
    closedBy: latestClose?.createdBy || null,
  }
}

export async function listHistoryService({ clientId, limit }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  return listPeriodCloseHistory(clientId, { limit })
}

// === Close + Reopen ===

export async function closePeriodService({ clientId, throughDate, note, createdBy }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  assertDate(throughDate, "throughDate")

  const currentClosed = await getClientClosedThroughDate(clientId)
  if (currentClosed && String(throughDate) <= String(currentClosed)) {
    throw new AppError(
      `Period is already closed through ${currentClosed}. Pick a date after ${currentClosed} to extend the close.`,
      409,
      { currentClosed },
    )
  }

  return recordPeriodClose({
    clientId,
    closedThroughDate: throughDate,
    previousClosedThroughDate: currentClosed,
    note,
    createdBy,
  })
}

// Reopens the period — rolls the closedThroughDate back to the value it
// held BEFORE the latest close event. If there is no prior history,
// closedThroughDate becomes null ("books are open").
export async function reopenPeriodService({ clientId, note, createdBy }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  const currentClosed = await getClientClosedThroughDate(clientId)
  if (!currentClosed) {
    throw new AppError("Books are already open — nothing to reopen.", 409)
  }
  const latest = await getLatestCloseEvent(clientId)
  // previousClosedThroughDate may be null if this was the first close ever.
  const rollbackTo = latest?.previousClosedThroughDate || null

  return recordPeriodReopen({
    clientId,
    closedThroughDate: rollbackTo,
    previousClosedThroughDate: currentClosed,
    note,
    createdBy,
  })
}
