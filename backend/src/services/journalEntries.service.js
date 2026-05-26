import {
  createJournalEntry,
  updateJournalEntryById,
  getJournalEntryById,
  listJournalEntriesByClientId,
  countJournalEntriesByClientId,
  deleteJournalEntryById,
  deleteJournalEntriesByIds,
  createHalfEntry,
  categorizeEntry,
  listUncategorizedEntries,
  getOrCreateSuspenseAccountId,
} from "../repositories/journalEntries.repository.js"
import { listAccountsByClientId } from "../repositories/account.repository.js"
import { getClientById } from "../repositories/clients.repository.js"
import { PNL_ACCOUNT_TYPES } from "../config/accountTypes.js"
import categorizeTransaction from "../lib/ai/categorizeTransaction.js"
import { AppError } from "../utils/appError.js"

export async function createJournalEntryService(input) {
  try {
    return await createJournalEntry(input)
  } catch (err) {
    if (err instanceof TypeError) throw new AppError(err.message, 400)
    throw err
  }
}

export async function updateJournalEntryByIdService(id, patch) {
  try {
    return await updateJournalEntryById(id, patch)
  } catch (err) {
    if (err instanceof TypeError) throw new AppError(err.message, 400)
    throw err
  }
}

export async function getJournalEntryByIdService(id) {
  if (!id) throw new AppError("id is required", 400)
  return getJournalEntryById(id)
}

export async function listJournalEntriesByClientIdService(clientId, options = {}) {
  if (!clientId) throw new AppError("clientId is required", 400)
  const [entries, total] = await Promise.all([
    listJournalEntriesByClientId(clientId, options),
    countJournalEntriesByClientId(clientId, options),
  ])
  return { entries, total }
}

export async function deleteJournalEntryByIdService(id) {
  if (!id) throw new AppError("id is required", 400)
  return deleteJournalEntryById(id)
}

export async function deleteJournalEntriesByIdsService(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("ids must be a non-empty array", 400)
  }
  const result = await deleteJournalEntriesByIds(ids)
  return {
    requestedCount: ids.length,
    deletedCount: Number(result?.deletedCount || 0),
  }
}

// === Inbox / categorization flow ===

export async function createHalfEntryService(input) {
  if (!input?.clientId) throw new AppError("clientId is required", 400)
  if (!input?.bankAccountId) throw new AppError("bankAccountId is required", 400)
  if (!input?.date) throw new AppError("date is required", 400)
  try {
    return await createHalfEntry({
      clientId: input.clientId,
      bankAccountId: input.bankAccountId,
      date: input.date,
      description: input.description || "",
      amount: input.amount,
      externalId: input.externalId || null,
    })
  } catch (err) {
    if (err instanceof TypeError) throw new AppError(err.message, 400)
    throw err
  }
}

export async function categorizeEntryService({ entryId, contraAccountId }) {
  if (!entryId) throw new AppError("entryId is required", 400)
  if (!contraAccountId) throw new AppError("contraAccountId is required", 400)
  try {
    const result = await categorizeEntry({ entryId, contraAccountId })
    if (!result) throw new AppError("Journal entry not found", 404)
    return result
  } catch (err) {
    if (err instanceof TypeError) throw new AppError(err.message, 400)
    throw err
  }
}

export async function listUncategorizedEntriesService(clientId, options = {}) {
  if (!clientId) throw new AppError("clientId is required", 400)
  const [entries, suspenseAccountId] = await Promise.all([
    listUncategorizedEntries(clientId, options),
    getOrCreateSuspenseAccountId(clientId),
  ])
  return { entries, suspenseAccountId }
}

// Runs the AI categorizer over every uncategorized entry of a client.
// Confidence threshold: 0.7 by default — only entries the model is
// reasonably sure about get auto-applied. Lower-confidence suggestions
// are returned for manual review by the user.
const DEFAULT_AUTO_APPLY_THRESHOLD = 0.7

export async function categorizeWithAiService({ clientId, autoApplyThreshold = DEFAULT_AUTO_APPLY_THRESHOLD }) {
  if (!clientId) throw new AppError("clientId is required", 400)

  const [client, accounts, { entries, suspenseAccountId }] = await Promise.all([
    getClientById(clientId),
    listAccountsByClientId(clientId, { includeInactive: false, includeAllTypes: true }),
    listUncategorizedEntriesService(clientId, { limit: 500 }),
  ])

  if (!client) throw new AppError("Client not found", 404)
  if (entries.length === 0) {
    return { suggestedCount: 0, appliedCount: 0, suggestions: [] }
  }

  const pnlAccounts = accounts.filter(
    (acc) => PNL_ACCOUNT_TYPES.includes(acc.accountType) && !acc.isSuspense,
  )
  if (pnlAccounts.length === 0) {
    throw new AppError("No P&L accounts available — add Income/Expense accounts first", 400)
  }

  // Build the inputs for the AI in the shape the prompt expects. We
  // collapse each entry to a synthetic "transaction" view: amount sign
  // = money_in/out, description from the user's bank line.
  const aiAccounts = pnlAccounts.map((acc) => ({
    id: String(acc._id),
    name: acc.name,
    accountType: acc.accountType,
    description: acc.description || "",
  }))

  const aiTransactions = entries.map((entry) => {
    const suspenseLeg = (entry.legs || []).find((leg) => String(leg.accountId) === suspenseAccountId)
    // Suspense leg sign tells us the bank-side direction (opposite of suspense)
    const moneyIn = suspenseLeg ? Number(suspenseLeg.credit || 0) > 0 : Number(entry.totalDebits || 0) > 0
    const amount = Number(entry.totalDebits || 0)
    return {
      id: String(entry._id),
      description: entry.description || "",
      amount: moneyIn ? amount : -amount,
    }
  })

  const aiResults = await categorizeTransaction(aiAccounts, aiTransactions, {
    name: client.name || "",
    businessType: client.businessType || "",
    mainActivity: client.mainActivity || "",
    description: client.description || "",
  })

  const accountById = new Map(aiAccounts.map((a) => [a.id, a]))
  const suggestions = []
  let appliedCount = 0

  for (const result of aiResults) {
    if (!result.accountId) {
      suggestions.push({
        entryId: String(result.id),
        suggestedAccountId: null,
        suggestedAccountName: null,
        confidence: result.confidence,
        ambiguous: result.ambiguous,
        applied: false,
      })
      continue
    }
    const account = accountById.get(result.accountId)
    const shouldApply = result.confidence >= autoApplyThreshold && !result.ambiguous
    if (shouldApply) {
      try {
        await categorizeEntry({ entryId: String(result.id), contraAccountId: result.accountId })
        appliedCount += 1
      } catch {
        // Skip on individual failure — surfaced as suggestion only
      }
    }
    suggestions.push({
      entryId: String(result.id),
      suggestedAccountId: result.accountId,
      suggestedAccountName: account?.name || "",
      confidence: result.confidence,
      ambiguous: result.ambiguous,
      applied: shouldApply,
    })
  }

  return {
    suggestedCount: suggestions.filter((s) => s.suggestedAccountId).length,
    appliedCount,
    suggestions,
  }
}
