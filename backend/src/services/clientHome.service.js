import { AppError } from "../utils/appError.js"
import { getDB } from "../db.js"
import { getClientById } from "../repositories/clients.repository.js"
import {
  getOrCreateSuspenseAccountId,
} from "../repositories/journalEntries.repository.js"
import { getProfitLossByClientAndRange } from "../repositories/profitLoss.repository.js"
import { getChartOfAccountsByClientId } from "../repositories/chartOfAccounts.repository.js"
import { getClientClosedThroughDate } from "../repositories/periodClose.repository.js"
import { listTasksByOfficeId } from "../repositories/tasks.repository.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BANK_LIKE_TYPES = [
  "asset_current",
  "asset_noncurrent",
  "liability_current",
  "liability_noncurrent",
]

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function todayIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

function firstOfCurrentMonth() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}

function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null
  const a = new Date(`${fromIso}T00:00:00Z`)
  const b = new Date(`${toIso}T00:00:00Z`)
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)))
}

// Counts uncleared bank legs (date <= today, account is bank-like,
// no entry in clearedLegs for that leg index). Returns the number of
// bank accounts with at least one such leg, plus the total count.
export async function countUnreconciled(clientId) {
  const db = getDB()
  const accounts = await db
    .collection("coa_accounts")
    .find({
      clientId: String(clientId),
      accountType: { $in: BANK_LIKE_TYPES },
      isSuspense: { $ne: true },
      isActive: { $ne: false },
    })
    .toArray()

  const today = todayIso()
  const out = { accountsWithUncleared: 0, totalUnclearedLegs: 0 }

  for (const acc of accounts) {
    const accountId = String(acc._id)
    const entries = await db
      .collection("journal_entries")
      .aggregate([
        {
          $match: {
            clientId: String(clientId),
            "legs.accountId": accountId,
            date: { $regex: DATE_REGEX, $lte: today },
          },
        },
        { $project: { legs: 1, clearedLegs: 1 } },
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
      out.accountsWithUncleared += 1
      out.totalUnclearedLegs += uncleared
    }
  }
  return out
}

async function getRecentTransactions(clientId, { limit = 8 } = {}) {
  const db = getDB()
  const entries = await db
    .collection("journal_entries")
    .find({ clientId: String(clientId) })
    .sort({ date: -1, _id: -1 })
    .limit(Math.min(50, Math.max(1, Number(limit) || 8)))
    .toArray()

  if (entries.length === 0) return []

  // Collect every account id touched so we can resolve names in one go.
  const ids = new Set()
  for (const entry of entries) {
    for (const leg of entry.legs || []) ids.add(String(leg.accountId))
  }
  const accountList = await db
    .collection("coa_accounts")
    .find({ _id: { $in: [...ids].map((id) => ({ $oid: id })) } })
    .toArray()
    .catch(() => [])
  // The $oid trick above can fail in some drivers — fallback to ObjectId conversion.
  let accountsById = new Map(accountList.map((a) => [String(a._id), a]))
  if (accountList.length === 0) {
    const { ObjectId } = await import("mongodb")
    const idList = [...ids].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
    const list = await db.collection("coa_accounts").find({ _id: { $in: idList } }).toArray()
    accountsById = new Map(list.map((a) => [String(a._id), a]))
  }

  return entries.map((entry) => {
    const legs = entry.legs || []
    // Pick the "bank-like" leg as the primary one shown in the row.
    const bankLeg = legs.find((leg) => {
      const acc = accountsById.get(String(leg.accountId))
      const type = acc?.accountType
      return BANK_LIKE_TYPES.includes(type)
    }) || legs[0]
    const bankAccount = accountsById.get(String(bankLeg?.accountId))
    const otherLegs = legs.filter((l) => l !== bankLeg)
    const contraAccount =
      otherLegs.length === 1 ? accountsById.get(String(otherLegs[0]?.accountId)) : null
    const contraIsSuspense = Boolean(contraAccount?.isSuspense)
    const amount = bankLeg
      ? Number(bankLeg.debit || 0) - Number(bankLeg.credit || 0)
      : 0
    return {
      id: String(entry._id),
      date: entry.date,
      description: entry.description || "",
      amount: round2(amount),
      bankAccount: bankAccount?.name || "",
      category:
        otherLegs.length === 1
          ? contraIsSuspense
            ? null
            : contraAccount?.name || null
          : null,
      isSplit: otherLegs.length > 1,
      isUncategorized:
        otherLegs.length === 1 ? Boolean(contraIsSuspense) : false,
    }
  })
}

export async function getClientHomeService({ clientId }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  const client = await getClientById(clientId)
  if (!client) throw new AppError("Client not found", 404)

  const today = todayIso()
  const startOfMonth = firstOfCurrentMonth()

  // Run the heavy lifters in parallel.
  const [coa, pl, closedThroughDate, suspenseId, unreconciled, recent, openTasks] = await Promise.all([
    getChartOfAccountsByClientId({ clientId }),
    getProfitLossByClientAndRange({
      clientId,
      startDate: startOfMonth,
      endDate: today,
      periodLabel: "Month to date",
    }),
    getClientClosedThroughDate(clientId),
    getOrCreateSuspenseAccountId(clientId),
    countUnreconciled(clientId),
    getRecentTransactions(clientId, { limit: 8 }),
    client?.officeId
      ? listTasksByOfficeId(client.officeId, { clientId, status: "active" }).catch(() => [])
      : Promise.resolve([]),
  ])

  // Cash balance = positive natural-side balance of bank-like asset
  // accounts. Liabilities (credit cards) don't count as cash even
  // though they're bank-like for reconciliation.
  let cashBalance = 0
  const bankBalances = []
  for (const group of coa?.groups || []) {
    for (const row of group.items || []) {
      if (!BANK_LIKE_TYPES.includes(row.accountType)) continue
      bankBalances.push({
        id: row.id,
        name: row.name,
        accountType: row.accountType,
        balance: round2(row.balance),
      })
      if (row.accountType?.startsWith("asset_")) {
        cashBalance += Number(row.balance || 0)
      }
    }
  }
  bankBalances.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

  // Pull P&L KPIs by id for a stable shape.
  const plKpi = (id) => (pl?.kpis || []).find((k) => k.id === id)?.value ?? 0

  // Count uncategorized = entries with at least one suspense leg.
  const db = getDB()
  const uncategorizedCount = await db
    .collection("journal_entries")
    .countDocuments({ clientId: String(clientId), "legs.accountId": suspenseId })

  // Most recent activity (any journal entry).
  const lastActivityDate = recent[0]?.date || null
  const lastActivityDaysAgo = lastActivityDate ? daysBetween(lastActivityDate, today) : null

  return {
    client: {
      id: String(client._id),
      name: client.name || "",
      businessType: client.businessType || "",
      mainActivity: client.mainActivity || "",
      state: client.state || "",
      description: client.description || "",
      notes: Array.isArray(client.notes) ? client.notes : [],
    },
    period: { fromDate: startOfMonth, toDate: today, label: "Month to date" },
    kpis: {
      cashBalance: round2(cashBalance),
      mtdRevenue: round2(plKpi("revenue")),
      mtdGrossProfit: round2(plKpi("gross_profit")),
      mtdNetIncome: round2(plKpi("net_income")),
    },
    actionItems: {
      uncategorizedCount,
      unreconciledAccountCount: unreconciled.accountsWithUncleared,
      unreconciledLegsCount: unreconciled.totalUnclearedLegs,
      closedThroughDate: closedThroughDate || null,
      lastActivityDate,
      lastActivityDaysAgo,
    },
    bankBalances,
    recentTransactions: recent,
    // Forward the full task docs (already decorated by the tasks repo)
    // so TaskCard / TaskDetailsModal / TaskEditModal have every field
    // they need (description, comments, statusHistory, clientIds, etc.).
    tasks: (openTasks || []).slice(0, 8),
    tasksTotal: (openTasks || []).length,
  }
}
