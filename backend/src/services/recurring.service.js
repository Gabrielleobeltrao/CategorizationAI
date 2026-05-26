import { AppError } from "../utils/appError.js"
import {
  createRecurring,
  listRecurringByClient,
  getRecurringById,
  updateRecurring,
  deleteRecurring,
  patchScheduleProgress,
  setRecurringActive,
} from "../repositories/recurring.repository.js"
import { createJournalEntry } from "../repositories/journalEntries.repository.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value) {
  return typeof value === "string" && DATE_REGEX.test(value)
}

function todayIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

function daysInMonth(year, month) {
  // month is 1-12
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function clampDayOfMonth(year, month, day) {
  return Math.min(day, daysInMonth(year, month))
}

function toDateParts(iso) {
  const [y, m, d] = String(iso).split("-").map(Number)
  return { year: y, month: m, day: d }
}

function fromDateParts({ year, month, day }) {
  const yyyy = String(year).padStart(4, "0")
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

// Given a recurring template and its current nextRunDate (already used),
// returns the date of the NEXT run after this one. Used to advance the
// schedule on runOnce / skipNext.
function computeAdvancedNextRunDate(template, fromDate) {
  const { frequency, dayOfMonth, monthOfYear } = template
  const parts = toDateParts(fromDate)

  if (frequency === "weekly") {
    const d = new Date(`${fromDate}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 7)
    return d.toISOString().slice(0, 10)
  }

  if (frequency === "biweekly") {
    const d = new Date(`${fromDate}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 14)
    return d.toISOString().slice(0, 10)
  }

  if (frequency === "monthly") {
    let nextYear = parts.year
    let nextMonth = parts.month + 1
    if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    const day = clampDayOfMonth(nextYear, nextMonth, dayOfMonth || parts.day)
    return fromDateParts({ year: nextYear, month: nextMonth, day })
  }

  if (frequency === "yearly") {
    const nextYear = parts.year + 1
    const nextMonth = monthOfYear || parts.month
    const day = clampDayOfMonth(nextYear, nextMonth, dayOfMonth || parts.day)
    return fromDateParts({ year: nextYear, month: nextMonth, day })
  }

  throw new AppError(`Unsupported frequency: ${frequency}`, 400)
}

function annotateRecurring(doc) {
  if (!doc) return doc
  const today = todayIso()
  const dueNow = doc.isActive && doc.nextRunDate && doc.nextRunDate <= today
  return {
    ...doc,
    _id: String(doc._id),
    isDue: Boolean(dueNow),
  }
}

export async function createRecurringService(input) {
  if (!input?.clientId) throw new AppError("clientId is required", 400)
  try {
    const doc = await createRecurring(input)
    return annotateRecurring(doc)
  } catch (err) {
    throw new AppError(err?.message || "Failed to create recurring entry", 400)
  }
}

export async function listRecurringService({ clientId }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  const docs = await listRecurringByClient(clientId)
  return { items: docs.map(annotateRecurring) }
}

export async function getRecurringService({ id, clientId }) {
  const doc = await getRecurringById(id)
  if (!doc) throw new AppError("Recurring entry not found", 404)
  if (clientId && String(doc.clientId) !== String(clientId)) {
    throw new AppError("Recurring entry does not belong to this client", 403)
  }
  return annotateRecurring(doc)
}

export async function updateRecurringService({ id, clientId, patch }) {
  const current = await getRecurringById(id)
  if (!current) throw new AppError("Recurring entry not found", 404)
  if (clientId && String(current.clientId) !== String(clientId)) {
    throw new AppError("Recurring entry does not belong to this client", 403)
  }
  try {
    const updated = await updateRecurring(id, patch || {})
    return annotateRecurring(updated)
  } catch (err) {
    throw new AppError(err?.message || "Failed to update recurring entry", 400)
  }
}

export async function deleteRecurringService({ id, clientId }) {
  const current = await getRecurringById(id)
  if (!current) return { deletedCount: 0 }
  if (clientId && String(current.clientId) !== String(clientId)) {
    throw new AppError("Recurring entry does not belong to this client", 403)
  }
  return deleteRecurring(id)
}

export async function setRecurringActiveService({ id, clientId, isActive }) {
  const current = await getRecurringById(id)
  if (!current) throw new AppError("Recurring entry not found", 404)
  if (clientId && String(current.clientId) !== String(clientId)) {
    throw new AppError("Recurring entry does not belong to this client", 403)
  }
  const updated = await setRecurringActive(id, Boolean(isActive))
  return annotateRecurring(updated)
}

// Run-now: creates one journal_entry dated on nextRunDate using the
// template's legs, then advances nextRunDate by one cycle. If the new
// nextRunDate is past endDate, deactivates the template.
export async function runRecurringOnceService({ id, clientId }) {
  const current = await getRecurringById(id)
  if (!current) throw new AppError("Recurring entry not found", 404)
  if (clientId && String(current.clientId) !== String(clientId)) {
    throw new AppError("Recurring entry does not belong to this client", 403)
  }
  if (!current.isActive) {
    throw new AppError("This recurring entry is paused. Resume it before running.", 409)
  }
  if (!isValidDate(current.nextRunDate)) {
    throw new AppError("Recurring entry has no nextRunDate set", 400)
  }

  let createdEntry
  try {
    createdEntry = await createJournalEntry({
      clientId: current.clientId,
      date: current.nextRunDate,
      description: current.description || current.name,
      legs: current.legs,
      source: "recurring",
    })
  } catch (err) {
    // PERIOD_CLOSED surfaced from journal entry layer becomes a clear
    // 409 here so the UI can show the deep-link message.
    if (err?.code === "PERIOD_CLOSED") {
      throw new AppError(
        "Cannot run: the target date falls in a closed period. Reopen the period or skip the next run.",
        409,
        { code: "PERIOD_CLOSED" },
      )
    }
    throw new AppError(err?.message || "Failed to create journal entry", 400)
  }

  // Advance the schedule.
  const lastRunDate = current.nextRunDate
  let nextRunDate = computeAdvancedNextRunDate(current, current.nextRunDate)
  let isActive = true
  if (current.endDate && nextRunDate > current.endDate) {
    isActive = false
  }
  const updated = await patchScheduleProgress(id, {
    lastRunDate,
    nextRunDate,
    isActive,
  })
  return {
    entry: createdEntry,
    recurring: annotateRecurring(updated),
  }
}

// Skip-next: advances the schedule by one cycle WITHOUT creating an
// entry. Useful when the bookkeeper already posted the transaction by
// hand and doesn't want the auto-generation.
export async function skipRecurringNextService({ id, clientId }) {
  const current = await getRecurringById(id)
  if (!current) throw new AppError("Recurring entry not found", 404)
  if (clientId && String(current.clientId) !== String(clientId)) {
    throw new AppError("Recurring entry does not belong to this client", 403)
  }
  if (!isValidDate(current.nextRunDate)) {
    throw new AppError("Recurring entry has no nextRunDate set", 400)
  }
  let nextRunDate = computeAdvancedNextRunDate(current, current.nextRunDate)
  let isActive = current.isActive
  if (current.endDate && nextRunDate > current.endDate) {
    isActive = false
  }
  const updated = await patchScheduleProgress(id, { nextRunDate, isActive })
  return annotateRecurring(updated)
}
