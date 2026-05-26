// Canonical transaction schema for double-entry bookkeeping.
//
// A transaction (a.k.a. journal entry) is the user-facing unit of
// activity. It always has:
//   - date (YYYY-MM-DD)
//   - description (free text — the bank line, the manual memo, etc.)
//   - clientId
//   - legs: array of at least 2 entries where sum(debit) === sum(credit)
//
// Each leg targets exactly one account from `coa_accounts` and records
// either a debit OR a credit (the other side is 0). The accounting
// invariant — debits = credits — is enforced by `validateTransactionLegs`
// before any write hits the database.
//
// The legacy single-entry shape (accountId / categoryId / amount /
// splits) is dropped entirely; there's no backward-compat field on
// the new docs.

import { ObjectId } from "mongodb"

export const MIN_LEGS_PER_TRANSACTION = 2

// Allow tiny floating-point drift coming from the UI (e.g. 0.1 + 0.2).
// Anything below half a cent is treated as balanced.
const BALANCE_EPSILON = 0.005

function isPositiveAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

function normalizeMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function isObjectIdLike(value) {
  if (!value) return false
  if (value instanceof ObjectId) return true
  return ObjectId.isValid(String(value))
}

// Throws a TypeError with a human-readable message when `legs` doesn't
// satisfy the double-entry invariant. Returns the normalized legs
// (numeric amounts rounded to 2 decimals, side stamped) when valid.
export function validateTransactionLegs(legs) {
  if (!Array.isArray(legs) || legs.length < MIN_LEGS_PER_TRANSACTION) {
    throw new TypeError(
      `Transaction must have at least ${MIN_LEGS_PER_TRANSACTION} legs (got ${Array.isArray(legs) ? legs.length : "non-array"})`,
    )
  }

  const normalized = []
  let totalDebits = 0
  let totalCredits = 0

  legs.forEach((leg, index) => {
    if (!leg || typeof leg !== "object") {
      throw new TypeError(`Leg ${index}: must be an object`)
    }
    if (!isObjectIdLike(leg.accountId)) {
      throw new TypeError(`Leg ${index}: accountId is required and must be a valid ObjectId`)
    }

    const debit = normalizeMoney(leg.debit)
    const credit = normalizeMoney(leg.credit)

    if (debit < 0 || credit < 0) {
      throw new TypeError(`Leg ${index}: amounts must be non-negative`)
    }
    if (debit > 0 && credit > 0) {
      throw new TypeError(`Leg ${index}: a leg cannot be both a debit and a credit`)
    }
    if (!isPositiveAmount(debit) && !isPositiveAmount(credit)) {
      throw new TypeError(`Leg ${index}: must have a positive debit or credit`)
    }

    normalized.push({
      accountId: String(leg.accountId),
      debit,
      credit,
      side: debit > 0 ? "debit" : "credit",
      description: typeof leg.description === "string" ? leg.description.trim() : "",
    })

    totalDebits += debit
    totalCredits += credit
  })

  if (Math.abs(totalDebits - totalCredits) > BALANCE_EPSILON) {
    throw new TypeError(
      `Transaction is unbalanced: debits ${totalDebits.toFixed(2)} ≠ credits ${totalCredits.toFixed(2)}`,
    )
  }

  return {
    legs: normalized,
    totalDebits: normalizeMoney(totalDebits),
    totalCredits: normalizeMoney(totalCredits),
  }
}

// Returns a signed amount representing the net effect of the
// transaction on an asset perspective (positive = increase in
// assets/expenses). Used by display logic that wants a single
// "amount" column instead of separate debit/credit columns.
export function getNetDebitForAccount(legs, accountId) {
  const targetId = String(accountId || "")
  if (!targetId || !Array.isArray(legs)) return 0
  let net = 0
  for (const leg of legs) {
    if (String(leg.accountId) !== targetId) continue
    net += Number(leg.debit || 0) - Number(leg.credit || 0)
  }
  return normalizeMoney(net)
}

// Returns the legs of a transaction that hit accounts of any of the
// given accountTypes. Used by the P&L aggregation to pluck income/
// expense legs out of journal entries.
export function filterLegsByAccountIds(legs, accountIds) {
  const set = new Set((accountIds || []).map((id) => String(id)))
  if (!Array.isArray(legs) || set.size === 0) return []
  return legs.filter((leg) => set.has(String(leg.accountId)))
}
