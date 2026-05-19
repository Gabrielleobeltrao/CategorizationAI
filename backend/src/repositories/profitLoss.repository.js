import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import { normalizeCategoryType } from "../config/categoryTypes.js"

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

const UNCATEGORIZED_INCOME_LABEL = "Uncategorized income"
const UNCATEGORIZED_EXPENSES_LABEL = "Uncategorized expenses"

function isCogsCategory(type) {
  return normalizeCategoryType(type) === "cost_of_goods_sold"
}

function normalizeAmount(value) {
  return Number(Number(value || 0).toFixed(2))
}

function normalizeCategoryId(value) {
  if (!value) return null
  if (typeof value === "string") {
    if (!ObjectId.isValid(value)) return null
    return new ObjectId(value).toString()
  }
  if (value instanceof ObjectId) {
    return value.toString()
  }
  if (typeof value === "object" && typeof value?.toString === "function") {
    const normalized = value.toString()
    if (ObjectId.isValid(normalized)) return new ObjectId(normalized).toString()
  }
  return null
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

const KNOWN_BUCKETS = new Set([
  "income",
  "cost_of_goods_sold",
  "operating_expense",
  "other_income",
  "other_expense",
  "tax_expense",
])

function getCategoryBucket({ categoryType = "", categoryName = "", amount = 0, isUncategorized = false }) {
  if (isUncategorized) {
    return Number(amount || 0) >= 0 ? "income" : "operating_expense"
  }

  const normalizedType = normalizeCategoryType(categoryType)
  if (KNOWN_BUCKETS.has(normalizedType)) return normalizedType

  const normalizedName = String(categoryName || "").trim().toLowerCase()
  if (normalizedName === UNCATEGORIZED_INCOME_LABEL.toLowerCase()) return "income"
  if (normalizedName === UNCATEGORIZED_EXPENSES_LABEL.toLowerCase()) return "operating_expense"

  return Number(amount || 0) >= 0 ? "income" : "operating_expense"
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
  const collection = db.collection("transactions")

  const baseFilter = {
    clientId,
    date: { $regex: /^\d{4}-\d{2}-\d{2}$/ },
  }
  if (startDate && endDate) {
    baseFilter.date = {
      $gte: startDate,
      $lte: endDate,
      $regex: /^\d{4}-\d{2}-\d{2}$/,
    }
  }

  const transactionLines = await collection
    .aggregate(
      [
        { $match: baseFilter },
        {
          $project: {
            date: 1,
            splitItems: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$splits", []] } }, 0] },
                "$splits",
                [
                  {
                    amount: "$amount",
                    categoryId: "$categoryId",
                    category: "$category",
                  },
                ],
              ],
            },
          },
        },
        { $unwind: "$splitItems" },
        {
          $set: {
            categoryObjectId: {
              $convert: {
                input: "$splitItems.categoryId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryObjectId",
            foreignField: "_id",
            as: "categoryDoc",
          },
        },
        {
          $project: {
            _id: 0,
            date: 1,
            amount: "$splitItems.amount",
            categoryId: "$splitItems.categoryId",
            category: "$splitItems.category",
            categoryName: { $first: "$categoryDoc.name" },
            categoryType: { $first: "$categoryDoc.type" },
          },
        },
      ],
      {
        allowDiskUse: false,
        hint: { clientId: 1, date: -1, _id: -1 },
      },
    )
    .toArray()

  let revenue = 0
  let cogs = 0
  let operatingExpenses = 0
  let otherIncome = 0
  let otherExpense = 0
  let taxExpense = 0

  const revenueByCategory = new Map()
  const cogsByCategory = new Map()
  const operatingByCategory = new Map()
  const otherIncomeByCategory = new Map()
  const otherExpenseByCategory = new Map()
  const taxExpenseByCategory = new Map()
  const netByMonth = new Map()

  for (const line of transactionLines) {
    const keyMonth = monthLabel(line.date)
    const amount = Number(line?.amount) || 0
    const normalizedCategoryId = normalizeCategoryId(line?.categoryId)
    const categoryName = line?.category || line?.categoryName || "Uncategorized"
    const categoryType = line?.categoryType || ""
    const isUncategorized =
      !normalizedCategoryId &&
      !String(line?.category || "").trim() &&
      !String(line?.categoryName || "").trim()

    const bucket = getCategoryBucket({
      categoryType,
      categoryName,
      amount,
      isUncategorized,
    })

    if (bucket === "income") {
      const incomeCategoryLabel = isUncategorized ? UNCATEGORIZED_INCOME_LABEL : categoryName
      revenue += amount
      revenueByCategory.set(incomeCategoryLabel, (revenueByCategory.get(incomeCategoryLabel) || 0) + amount)
      netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) + amount)
      continue
    }

    if (bucket === "other_income") {
      otherIncome += amount
      otherIncomeByCategory.set(categoryName, (otherIncomeByCategory.get(categoryName) || 0) + amount)
      netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) + amount)
      continue
    }

    const expenseImpact = -amount
    if (bucket === "cost_of_goods_sold") {
      cogs += expenseImpact
      cogsByCategory.set(categoryName, (cogsByCategory.get(categoryName) || 0) + expenseImpact)
    } else if (bucket === "other_expense") {
      otherExpense += expenseImpact
      otherExpenseByCategory.set(categoryName, (otherExpenseByCategory.get(categoryName) || 0) + expenseImpact)
    } else if (bucket === "tax_expense") {
      taxExpense += expenseImpact
      taxExpenseByCategory.set(categoryName, (taxExpenseByCategory.get(categoryName) || 0) + expenseImpact)
    } else {
      const expenseCategoryLabel = isUncategorized ? UNCATEGORIZED_EXPENSES_LABEL : categoryName
      operatingExpenses += expenseImpact
      operatingByCategory.set(
        expenseCategoryLabel,
        (operatingByCategory.get(expenseCategoryLabel) || 0) + expenseImpact
      )
    }
    netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) + amount)
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

  const revenueItems = buildIncomeItems(revenueByCategory)
  const cogsItems = buildExpenseItems(cogsByCategory).map((item) => ({ ...item, presentationType: "expense" }))
  const operatingItems = buildExpenseItems(operatingByCategory).map((item) => ({ ...item, presentationType: "expense" }))
  const otherIncomeItems = buildIncomeItems(otherIncomeByCategory)
  const otherExpenseItems = buildExpenseItems(otherExpenseByCategory).map((item) => ({ ...item, presentationType: "expense" }))
  const taxExpenseItems = buildExpenseItems(taxExpenseByCategory).map((item) => ({ ...item, presentationType: "expense" }))

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
