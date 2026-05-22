import { getDB } from "../db.js"
import { PNL_ACCOUNT_TYPES } from "../config/accountTypes.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function monthLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`)
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
}

function statementId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function normalizeAmount(value) {
  return Number(Number(value || 0).toFixed(2))
}

// Sign convention for the P&L: income / other_income accounts have a
// natural CREDIT balance, so their "amount" on the report is
// credit − debit (positive = revenue). Expense-type accounts have a
// natural DEBIT balance, so the report's "amount" is debit − credit
// (positive = cost).
function legImpact(accountType, debit, credit) {
  const d = Number(debit || 0)
  const c = Number(credit || 0)
  if (accountType === "income" || accountType === "other_income") return c - d
  return d - c
}

export async function listProfitLossPeriodOptionsByClientId(clientId) {
  const db = getDB()

  const [result] = await db
    .collection("journal_entries")
    .aggregate([
      { $match: { clientId, date: { $regex: DATE_REGEX } } },
      {
        $project: {
          year: { $substrBytes: ["$date", 0, 4] },
          month: { $substrBytes: ["$date", 0, 7] },
        },
      },
      {
        $group: {
          _id: null,
          years: { $addToSet: "$year" },
          months: { $addToSet: "$month" },
        },
      },
    ])
    .toArray()

  const years = Array.isArray(result?.years) ? [...result.years].sort((a, b) => b.localeCompare(a)) : []
  const months = Array.isArray(result?.months) ? [...result.months].sort((a, b) => b.localeCompare(a)) : []

  return { years, months }
}

export async function getProfitLossByClientAndRange({ clientId, startDate, endDate, periodLabel }) {
  const db = getDB()

  const dateFilter = { $regex: DATE_REGEX }
  if (startDate && endDate) {
    dateFilter.$gte = startDate
    dateFilter.$lte = endDate
  }

  // Aggregates each leg that lands on a P&L account, joining the leg's
  // accountId against coa_accounts to discover the accountType and
  // human-readable name. Returns one row per leg (kept that way so we
  // can also bucket by month for the trend chart).
  const lines = await db
    .collection("journal_entries")
    .aggregate([
      { $match: { clientId, date: dateFilter } },
      { $unwind: "$legs" },
      {
        $set: {
          accountObjectId: {
            $convert: { input: "$legs.accountId", to: "objectId", onError: null, onNull: null },
          },
        },
      },
      {
        $lookup: {
          from: "coa_accounts",
          localField: "accountObjectId",
          foreignField: "_id",
          as: "accountDoc",
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          debit: "$legs.debit",
          credit: "$legs.credit",
          accountId: "$legs.accountId",
          accountName: { $first: "$accountDoc.name" },
          accountType: { $first: "$accountDoc.accountType" },
        },
      },
      { $match: { accountType: { $in: PNL_ACCOUNT_TYPES } } },
    ])
    .toArray()

  let revenue = 0
  let cogs = 0
  let operatingExpenses = 0
  let otherIncome = 0
  let otherExpense = 0
  let taxExpense = 0

  const revenueByAccount = new Map()
  const cogsByAccount = new Map()
  const operatingByAccount = new Map()
  const otherIncomeByAccount = new Map()
  const otherExpenseByAccount = new Map()
  const taxExpenseByAccount = new Map()
  const netByMonth = new Map()

  for (const line of lines) {
    const impact = legImpact(line.accountType, line.debit, line.credit)
    const accountName = line.accountName || "Unnamed account"
    const keyMonth = monthLabel(line.date)

    if (line.accountType === "income") {
      revenue += impact
      revenueByAccount.set(accountName, (revenueByAccount.get(accountName) || 0) + impact)
    } else if (line.accountType === "cost_of_goods_sold") {
      cogs += impact
      cogsByAccount.set(accountName, (cogsByAccount.get(accountName) || 0) + impact)
    } else if (line.accountType === "operating_expense") {
      operatingExpenses += impact
      operatingByAccount.set(accountName, (operatingByAccount.get(accountName) || 0) + impact)
    } else if (line.accountType === "other_income") {
      otherIncome += impact
      otherIncomeByAccount.set(accountName, (otherIncomeByAccount.get(accountName) || 0) + impact)
    } else if (line.accountType === "other_expense") {
      otherExpense += impact
      otherExpenseByAccount.set(accountName, (otherExpenseByAccount.get(accountName) || 0) + impact)
    } else if (line.accountType === "tax_expense") {
      taxExpense += impact
      taxExpenseByAccount.set(accountName, (taxExpenseByAccount.get(accountName) || 0) + impact)
    }

    // Monthly net: revenue + other_income − all expense types.
    const netDelta = line.accountType === "income" || line.accountType === "other_income" ? impact : -impact
    netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) + netDelta)
  }

  const grossProfit = revenue - cogs
  const operatingIncome = grossProfit - operatingExpenses
  const pretaxIncome = operatingIncome + otherIncome - otherExpense
  const netIncome = pretaxIncome - taxExpense

  const buildIncomeItems = (map) =>
    Array.from(map.entries())
      .map(([label, amount]) => ({
        id: statementId(label),
        label,
        amount: normalizeAmount(amount),
        level: 1,
        type: "item",
        presentationType: "income",
      }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  const buildExpenseItems = (map) =>
    Array.from(map.entries())
      .map(([label, amount]) => ({
        id: statementId(label),
        label,
        amount: -normalizeAmount(amount),
        level: 1,
        type: "item",
        presentationType: "expense",
      }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  const revenueItems = buildIncomeItems(revenueByAccount)
  const cogsItems = buildExpenseItems(cogsByAccount)
  const operatingItems = buildExpenseItems(operatingByAccount)
  const otherIncomeItems = buildIncomeItems(otherIncomeByAccount)
  const otherExpenseItems = buildExpenseItems(otherExpenseByAccount)
  const taxExpenseItems = buildExpenseItems(taxExpenseByAccount)

  const statement = [
    { id: "revenue", label: "Revenue", amount: normalizeAmount(revenue), level: 0, type: "group", presentationType: "income" },
    ...revenueItems,
    { id: "cogs", label: "Cost of Goods Sold", amount: -normalizeAmount(cogs), level: 0, type: "group", presentationType: "expense" },
    ...cogsItems,
    { id: "gross_total", label: "Gross Profit", amount: normalizeAmount(grossProfit), level: 0, type: "total", presentationType: "net" },
    { id: "opex", label: "Operating Expenses", amount: -normalizeAmount(operatingExpenses), level: 0, type: "group", presentationType: "expense" },
    ...operatingItems,
    { id: "op_total", label: "Operating Income", amount: normalizeAmount(operatingIncome), level: 0, type: "total", presentationType: "net" },
    ...(otherIncome !== 0 || otherIncomeItems.length > 0 ? [
      { id: "other_income", label: "Other Income", amount: normalizeAmount(otherIncome), level: 0, type: "group", presentationType: "income" },
      ...otherIncomeItems,
    ] : []),
    ...(otherExpense !== 0 || otherExpenseItems.length > 0 ? [
      { id: "other_expense", label: "Other Expense", amount: -normalizeAmount(otherExpense), level: 0, type: "group", presentationType: "expense" },
      ...otherExpenseItems,
    ] : []),
    { id: "pretax_total", label: "Pretax Income", amount: normalizeAmount(pretaxIncome), level: 0, type: "total", presentationType: "net" },
    ...(taxExpense !== 0 || taxExpenseItems.length > 0 ? [
      { id: "tax_expense", label: "Tax Expense", amount: -normalizeAmount(taxExpense), level: 0, type: "group", presentationType: "expense" },
      ...taxExpenseItems,
    ] : []),
    { id: "net_total", label: "Net Income", amount: normalizeAmount(netIncome), level: 0, type: "total", presentationType: "net" },
  ]

  const monthlyNet = Array.from(netByMonth.entries()).map(([month, amount]) => ({
    month,
    amount: normalizeAmount(amount),
  }))

  return {
    period: periodLabel,
    periodStart: startDate || null,
    periodEnd: endDate || null,
    kpis: [
      { id: "revenue", label: "Revenue", value: normalizeAmount(revenue) },
      { id: "gross_profit", label: "Gross Profit", value: normalizeAmount(grossProfit) },
      { id: "operating_income", label: "Operating Income", value: normalizeAmount(operatingIncome) },
      { id: "pretax_income", label: "Pretax Income", value: normalizeAmount(pretaxIncome) },
      { id: "net_income", label: "Net Income", value: normalizeAmount(netIncome) },
    ],
    statement,
    monthlyNet,
  }
}
