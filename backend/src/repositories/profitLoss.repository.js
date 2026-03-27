import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

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

function isCogsCategory(type) {
  const normalized = String(type || "").toLowerCase()
  return normalized.includes("cost") || normalized.includes("cogs")
}

function normalizeAmount(value) {
  return Math.round(Number(value || 0))
}

function buildExpenseItems(mapByCategory) {
  return Array.from(mapByCategory.entries())
    .map(([label, amount]) => ({
      id: statementId(label),
      label,
      amount: -normalizeAmount(amount),
      level: 1,
      type: "item",
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

export async function listProfitLossPeriodOptionsByClientId(clientId) {
  const db = getDB()

  const [result] = await db
    .collection("transactions")
    .aggregate([
      {
        $match: {
          clientId,
          date: { $regex: /^\d{4}-\d{2}-\d{2}$/ },
        },
      },
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

  const baseFilter = { clientId }
  if (startDate && endDate) {
    baseFilter.date = { $gte: startDate, $lte: endDate }
  }

  const transactions = await db
    .collection("transactions")
    .find(baseFilter)
    .sort({ date: 1 })
    .toArray()

  const categoryIds = Array.from(
    new Set(
      transactions.flatMap((tx) => {
        const ids = []
        if (typeof tx?.categoryId === "string" && ObjectId.isValid(tx.categoryId)) {
          ids.push(tx.categoryId)
        }
        if (Array.isArray(tx?.splits)) {
          tx.splits.forEach((split) => {
            if (typeof split?.categoryId === "string" && ObjectId.isValid(split.categoryId)) {
              ids.push(split.categoryId)
            }
          })
        }
        return ids
      })
    )
  ).map((id) => new ObjectId(id))

  const categories = categoryIds.length
    ? await db
        .collection("categories")
        .find({ _id: { $in: categoryIds } })
        .toArray()
    : []

  const categoryMap = new Map(
    categories.map((item) => [
      String(item._id),
      {
        name: item.name || "Uncategorized",
        type: item.type || "",
      },
    ])
  )

  let revenue = 0
  let cogs = 0
  let operatingExpenses = 0

  const cogsByCategory = new Map()
  const operatingByCategory = new Map()
  const netByMonth = new Map()

  for (const tx of transactions) {
    const keyMonth = monthLabel(tx.date)
    const splitItems = Array.isArray(tx?.splits) && tx.splits.length > 0
      ? tx.splits
      : [
          {
            amount: tx.amount,
            categoryId: tx.categoryId ?? null,
            category: tx.category ?? null,
          },
        ]

    for (const splitItem of splitItems) {
      const amount = Number(splitItem?.amount) || 0
      const categoryRef = splitItem?.categoryId ? categoryMap.get(String(splitItem.categoryId)) : null
      const categoryName = splitItem?.category || categoryRef?.name || "Uncategorized"
      const categoryType = categoryRef?.type || ""

      if (amount < 0) {
        const income = Math.abs(amount)
        revenue += income
        netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) + income)
        continue
      }

      const expense = Math.abs(amount)
      if (isCogsCategory(categoryType)) {
        cogs += expense
        cogsByCategory.set(categoryName, (cogsByCategory.get(categoryName) || 0) + expense)
      } else {
        operatingExpenses += expense
        operatingByCategory.set(categoryName, (operatingByCategory.get(categoryName) || 0) + expense)
      }
      netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) - expense)
    }
  }

  const grossProfit = revenue - cogs
  const operatingIncome = grossProfit - operatingExpenses
  const netIncome = operatingIncome

  const cogsItems = buildExpenseItems(cogsByCategory)
  const operatingItems = buildExpenseItems(operatingByCategory)

  const statement = [
    { id: "revenue", label: "Revenue", amount: normalizeAmount(revenue), level: 0, type: "group" },
    { id: "service_income", label: "Service Income", amount: normalizeAmount(revenue), level: 1, type: "item" },
    { id: "cogs", label: "Cost of Goods Sold", amount: -normalizeAmount(cogs), level: 0, type: "group" },
    ...cogsItems,
    { id: "gross_total", label: "Gross Profit", amount: normalizeAmount(grossProfit), level: 0, type: "total" },
    { id: "opex", label: "Operating Expenses", amount: -normalizeAmount(operatingExpenses), level: 0, type: "group" },
    ...operatingItems,
    { id: "op_total", label: "Operating Income", amount: normalizeAmount(operatingIncome), level: 0, type: "total" },
    { id: "net_total", label: "Net Income", amount: normalizeAmount(netIncome), level: 0, type: "total" },
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
      { id: "net_income", label: "Net Income", value: normalizeAmount(netIncome) },
    ],
    statement,
    monthlyNet,
  }
}
