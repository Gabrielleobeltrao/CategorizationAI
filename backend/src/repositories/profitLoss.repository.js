import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

function monthLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`)
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
}

export async function getProfitLossByClientAndRange({ clientId, startDate, endDate, periodLabel }) {
  const db = getDB()

  const transactions = await db
    .collection("transactions")
    .find({
      clientId,
      date: { $gte: startDate, $lte: endDate },
    })
    .sort({ date: 1 })
    .toArray()

  const categoryIds = Array.from(
    new Set(
      transactions
        .map((tx) => tx.categoryId)
        .filter((value) => typeof value === "string" && ObjectId.isValid(value))
    )
  ).map((id) => new ObjectId(id))

  const categories = categoryIds.length
    ? await db
        .collection("categories")
        .find({ _id: { $in: categoryIds } })
        .toArray()
    : []

  const categoryTypeById = new Map(categories.map((c) => [String(c._id), c.type]))

  let revenue = 0
  let cogs = 0
  let operatingExpenses = 0

  const expenseByCategory = new Map()
  const netByMonth = new Map()

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0
    const categoryType = tx.categoryId ? categoryTypeById.get(String(tx.categoryId)) : undefined
    const categoryName = tx.category || "Uncategorized"
    const keyMonth = monthLabel(tx.date)

    if (amount < 0) {
      const income = Math.abs(amount)
      revenue += income
      netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) + income)
      continue
    }

    const expense = Math.abs(amount)
    const isCogs = typeof categoryType === "string" && categoryType.toLowerCase().includes("cost")

    if (isCogs) {
      cogs += expense
    } else {
      operatingExpenses += expense
    }

    expenseByCategory.set(categoryName, (expenseByCategory.get(categoryName) || 0) + expense)
    netByMonth.set(keyMonth, (netByMonth.get(keyMonth) || 0) - expense)
  }

  const grossProfit = revenue - cogs
  const operatingIncome = grossProfit - operatingExpenses
  const netIncome = operatingIncome

  const expenseMixRaw = Array.from(expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const totalExpenses = cogs + operatingExpenses

  const expenseMix = expenseMixRaw.map(([name, value]) => ({
    name,
    value: totalExpenses > 0 ? Math.round((value / totalExpenses) * 100) : 0,
  }))

  const monthlyNet = Array.from(netByMonth.entries()).map(([month, amount]) => ({ month, amount }))

  return {
    period: periodLabel,
    periodStart: startDate,
    periodEnd: endDate,
    kpis: [
      { id: "revenue", label: "Revenue", value: Math.round(revenue) },
      { id: "gross_profit", label: "Gross Profit", value: Math.round(grossProfit) },
      { id: "operating_income", label: "Operating Income", value: Math.round(operatingIncome) },
      { id: "net_income", label: "Net Income", value: Math.round(netIncome) },
    ],
    statement: [
      { id: "revenue", label: "Revenue", amount: Math.round(revenue), level: 0, type: "group" },
      { id: "cogs", label: "Cost of Goods Sold", amount: -Math.round(cogs), level: 0, type: "group" },
      { id: "gross_total", label: "Gross Profit", amount: Math.round(grossProfit), level: 0, type: "total" },
      { id: "opex", label: "Operating Expenses", amount: -Math.round(operatingExpenses), level: 0, type: "group" },
      { id: "op_total", label: "Operating Income", amount: Math.round(operatingIncome), level: 0, type: "total" },
      { id: "net_total", label: "Net Income", amount: Math.round(netIncome), level: 0, type: "total" },
    ],
    monthlyNet,
    expenseMix,
  }
}
