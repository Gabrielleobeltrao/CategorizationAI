import { AppError } from "../utils/appError.js"
import {
  createReconciliation,
  getReconciliationById,
  findInProgressReconciliation,
  getLastCompletedReconciliation,
  listReconciliationsByClient,
  patchReconciliation,
  markReconciliationCompleted,
  reopenReconciliationDoc,
  deleteReconciliationById,
} from "../repositories/reconciliation.repository.js"
import {
  listAccountLegsForReconciliation,
  markLegsCleared,
  unmarkLegsForReconciliation,
} from "../repositories/journalEntries.repository.js"
import { getAccountById } from "../repositories/account.repository.js"
import { isDateClosed } from "../repositories/periodClose.repository.js"

// Tolerância para o difference floating-point. Igual ao BALANCE_EPSILON
// usado por validateTransactionLegs — meio centavo.
const BALANCE_EPSILON = 0.005

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

async function ensureAccountIsBankLike(clientId, accountId) {
  const account = await getAccountById(accountId)
  if (!account) throw new AppError("Account not found", 404)
  if (String(account.clientId) !== String(clientId)) {
    throw new AppError("Account does not belong to this client", 403)
  }
  const type = String(account.accountType || "")
  const allowed = ["asset_current", "asset_noncurrent", "liability_current", "liability_noncurrent"]
  if (!allowed.includes(type)) {
    throw new AppError("Only bank-like accounts (assets / liabilities) can be reconciled", 400)
  }
  return account
}

// Computes the opening balance from the last completed reconciliation.
// First reconciliation ever on this account: 0.
async function computeOpeningBalance(clientId, accountId) {
  const last = await getLastCompletedReconciliation(clientId, accountId)
  return last ? round2(last.statementEndingBalance) : 0
}

export async function startReconciliationService({
  clientId,
  accountId,
  statementDate,
  statementEndingBalance,
  openingBalance,
  createdBy,
}) {
  if (!clientId) throw new AppError("clientId is required", 400)
  if (!accountId) throw new AppError("accountId is required", 400)
  if (!statementDate) throw new AppError("statementDate is required", 400)
  if (statementEndingBalance === undefined || statementEndingBalance === null) {
    throw new AppError("statementEndingBalance is required", 400)
  }

  await ensureAccountIsBankLike(clientId, accountId)

  const existing = await findInProgressReconciliation(clientId, accountId)
  if (existing) {
    throw new AppError(
      "There is already an in-progress reconciliation for this account. Continue or cancel it first.",
      409,
      { reconciliationId: String(existing._id) },
    )
  }

  const computedOpening = await computeOpeningBalance(clientId, accountId)
  const finalOpening = openingBalance !== undefined && openingBalance !== null
    ? round2(openingBalance)
    : computedOpening

  return createReconciliation({
    clientId,
    accountId,
    statementDate,
    openingBalance: finalOpening,
    statementEndingBalance,
    createdBy,
  })
}

export async function getWorksheetService({ reconciliationId, clientId }) {
  const rec = await getReconciliationById(reconciliationId)
  if (!rec) throw new AppError("Reconciliation not found", 404)
  if (clientId && String(rec.clientId) !== String(clientId)) {
    throw new AppError("Reconciliation does not belong to this client", 403)
  }

  const legs = await listAccountLegsForReconciliation(rec.clientId, rec.accountId, {
    upToDate: rec.statementDate,
  })

  // For an in-progress reconciliation, surface the legs flagged as
  // cleared by THIS reconciliation as a separate hint to the UI, so it
  // can pre-check them after a page reload.
  const checkedSet = new Set(
    (rec.legRefs || []).map((r) => `${r.entryId}:${r.legIndex}`),
  )
  const items = legs.map((row) => ({
    ...row,
    isCheckedInThisReconciliation: checkedSet.has(`${row.entryId}:${row.legIndex}`),
    // Hide legs already cleared by ANOTHER completed reconciliation so
    // the contador isn't tempted to double-clear them.
    belongsToOtherReconciliation:
      row.isCleared &&
      row.clearedByReconciliationId &&
      row.clearedByReconciliationId !== String(rec._id),
  }))

  const account = await getAccountById(rec.accountId)
  const target = round2(rec.statementEndingBalance - rec.openingBalance)
  return {
    reconciliation: rec,
    account: account
      ? { id: String(account._id), name: account.name, accountType: account.accountType }
      : null,
    items,
    target,
  }
}

export async function updateReconciliationProgressService({ reconciliationId, clientId, legRefs }) {
  const rec = await getReconciliationById(reconciliationId)
  if (!rec) throw new AppError("Reconciliation not found", 404)
  if (clientId && String(rec.clientId) !== String(clientId)) {
    throw new AppError("Reconciliation does not belong to this client", 403)
  }
  if (rec.status !== "in_progress") {
    throw new AppError("Cannot update a completed reconciliation. Reopen it first.", 409)
  }

  // Compute cleared total from the selected legs to keep it consistent.
  const allLegs = await listAccountLegsForReconciliation(rec.clientId, rec.accountId, {
    upToDate: rec.statementDate,
  })
  const byKey = new Map(allLegs.map((r) => [`${r.entryId}:${r.legIndex}`, r]))
  let clearedTotal = 0
  const validRefs = []
  for (const ref of legRefs || []) {
    const key = `${String(ref?.entryId || "")}:${Number(ref?.legIndex)}`
    const row = byKey.get(key)
    if (!row) continue
    validRefs.push({ entryId: String(ref.entryId), legIndex: Number(ref.legIndex) })
    clearedTotal += Number(row.signedAmount || 0)
  }

  return patchReconciliation(reconciliationId, {
    legRefs: validRefs,
    clearedTotal: round2(clearedTotal),
  })
}

export async function completeReconciliationService({ reconciliationId, clientId, completedBy, legRefs }) {
  // Allow caller to pass final legRefs on complete (treat as final autosave).
  if (Array.isArray(legRefs)) {
    await updateReconciliationProgressService({ reconciliationId, clientId, legRefs })
  }

  const rec = await getReconciliationById(reconciliationId)
  if (!rec) throw new AppError("Reconciliation not found", 404)
  if (clientId && String(rec.clientId) !== String(clientId)) {
    throw new AppError("Reconciliation does not belong to this client", 403)
  }
  if (rec.status !== "in_progress") {
    throw new AppError("Reconciliation is already completed", 409)
  }

  const target = round2(rec.statementEndingBalance - rec.openingBalance)
  const difference = round2(rec.clearedTotal - target)
  if (Math.abs(difference) > BALANCE_EPSILON) {
    throw new AppError(
      `Cannot complete: cleared total ($${rec.clearedTotal}) doesn't match target ($${target}). Difference $${difference}.`,
      400,
      { difference, clearedTotal: rec.clearedTotal, target },
    )
  }

  await markLegsCleared(rec.legRefs || [], reconciliationId)
  return markReconciliationCompleted(reconciliationId, { completedBy })
}

export async function reopenReconciliationService({ reconciliationId, clientId, reopenedBy }) {
  const rec = await getReconciliationById(reconciliationId)
  if (!rec) throw new AppError("Reconciliation not found", 404)
  if (clientId && String(rec.clientId) !== String(clientId)) {
    throw new AppError("Reconciliation does not belong to this client", 403)
  }
  if (rec.status !== "completed") {
    throw new AppError("Only completed reconciliations can be reopened", 409)
  }

  // Reopening a reconciliation whose statementDate is inside a closed
  // period would unlock transactions that the period close froze. Block.
  if (await isDateClosed(rec.clientId, rec.statementDate)) {
    throw new AppError(
      "This reconciliation's statement date is in a closed period. Reopen the period first.",
      409,
    )
  }

  // Only allow reopening the MOST RECENT completed reconciliation for
  // this account — otherwise the chain of opening balances breaks.
  const last = await getLastCompletedReconciliation(rec.clientId, rec.accountId)
  if (!last || String(last._id) !== String(rec._id)) {
    throw new AppError(
      "Only the latest completed reconciliation can be reopened. Reopen newer ones first.",
      409,
    )
  }

  await unmarkLegsForReconciliation(reconciliationId)
  return reopenReconciliationDoc(reconciliationId, { reopenedBy })
}

export async function cancelInProgressReconciliationService({ reconciliationId, clientId }) {
  const rec = await getReconciliationById(reconciliationId)
  if (!rec) throw new AppError("Reconciliation not found", 404)
  if (clientId && String(rec.clientId) !== String(clientId)) {
    throw new AppError("Reconciliation does not belong to this client", 403)
  }
  if (rec.status !== "in_progress") {
    throw new AppError("Only in-progress reconciliations can be cancelled", 409)
  }
  return deleteReconciliationById(reconciliationId)
}

export async function listReconciliationsService({ clientId, accountId, limit }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  return listReconciliationsByClient(clientId, { accountId, limit })
}

export async function getActiveReconciliationService({ clientId, accountId }) {
  if (!clientId || !accountId) return null
  return findInProgressReconciliation(clientId, accountId)
}

export async function getOpeningBalanceService({ clientId, accountId }) {
  if (!clientId || !accountId) return { openingBalance: 0 }
  const opening = await computeOpeningBalance(clientId, accountId)
  return { openingBalance: opening }
}
