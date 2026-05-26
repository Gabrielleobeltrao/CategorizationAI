import { AppError } from "../utils/appError.js"
import { getDB } from "../db.js"
import { getOrCreateSuspenseAccountId } from "../repositories/journalEntries.repository.js"

// Lightweight "where is this client in the setup flow?" snapshot used
// by the frontend's Getting-Started panel. Returns a checklist of
// done/not-done booleans plus counts so the UI can render progress
// without making multiple round trips.

export async function getOnboardingStateService({ clientId }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  const db = getDB()
  const safeClientId = String(clientId)

  // Real accounts = anything in coa_accounts that ISN'T the auto-created
  // suspense account. A fresh client with only the suspense doc still
  // hasn't picked a preset.
  const suspenseId = await getOrCreateSuspenseAccountId(safeClientId)
  const realAccountCount = await db
    .collection("coa_accounts")
    .countDocuments({
      clientId: safeClientId,
      isSuspense: { $ne: true },
      name: { $ne: "Uncategorized" },
    })

  const journalEntryCount = await db
    .collection("journal_entries")
    .countDocuments({ clientId: safeClientId })

  const uncategorizedCount = await db
    .collection("journal_entries")
    .countDocuments({ clientId: safeClientId, "legs.accountId": suspenseId })

  const hasAccounts = realAccountCount > 0
  const hasTransactions = journalEntryCount > 0
  const isFullyCategorized = hasTransactions && uncategorizedCount === 0

  const steps = [
    {
      id: "chart_of_accounts",
      label: "Set up Chart of Accounts",
      description:
        "Pick an industry preset or build your own — the foundation for categorizing everything else.",
      done: hasAccounts,
      cta: hasAccounts ? "View chart" : "Choose a preset",
      ctaPath: `/clients/${safeClientId}/chart-of-accounts`,
    },
    {
      id: "first_transactions",
      label: "Add your first transactions",
      description:
        "Upload a bank statement CSV, add a transaction manually, or post a journal entry.",
      done: hasTransactions,
      cta: hasTransactions ? "View transactions" : "Upload or add",
      // When the step is still open, deep-link straight to the upload
      // modal on the Transactions page (LedgerPage consumes `?action=upload`).
      ctaPath: hasTransactions
        ? `/clients/${safeClientId}/transactions`
        : `/clients/${safeClientId}/transactions?action=upload`,
    },
    {
      id: "categorize",
      label: "Categorize transactions",
      description:
        "Pick a category for each line — or let the AI suggest one and review the results.",
      done: isFullyCategorized,
      cta: isFullyCategorized ? "All categorized" : "Open transactions",
      ctaPath: `/clients/${safeClientId}/transactions`,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  return {
    steps,
    counts: {
      accounts: realAccountCount,
      transactions: journalEntryCount,
      uncategorized: uncategorizedCount,
    },
    doneCount,
    totalCount: steps.length,
    isComplete: doneCount === steps.length,
  }
}
