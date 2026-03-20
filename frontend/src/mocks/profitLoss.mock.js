const PERIOD_MULTIPLIER = {
  ALL: 1,
  MONTH: 0.27,
  YEAR: 1,
  RANGE: 0.27,
}

const profitLossByClient = {
  cli_1: {
    period: "Jan 2026 - Mar 2026",
    kpis: [
      { id: "revenue", label: "Revenue", value: 186420 },
      { id: "gross_profit", label: "Gross Profit", value: 121180 },
      { id: "operating_income", label: "Operating Income", value: 57340 },
      { id: "net_income", label: "Net Income", value: 54490 },
    ],
    statement: [
      { id: "revenue", label: "Revenue", amount: 186420, level: 0, type: "group" },
      { id: "service_income", label: "Service Income", amount: 154900, level: 1, type: "item" },
      { id: "other_income", label: "Other Income", amount: 31520, level: 1, type: "item" },
      { id: "cogs", label: "Cost of Goods Sold", amount: -65240, level: 0, type: "group" },
      { id: "materials", label: "Materials", amount: -43870, level: 1, type: "item" },
      { id: "subcontractors", label: "Subcontractors", amount: -21370, level: 1, type: "item" },
      { id: "gross_total", label: "Gross Profit", amount: 121180, level: 0, type: "total" },
      { id: "opex", label: "Operating Expenses", amount: -63840, level: 0, type: "group" },
      { id: "payroll", label: "Payroll", amount: -32200, level: 1, type: "item" },
      { id: "rent", label: "Rent", amount: -11800, level: 1, type: "item" },
      { id: "software", label: "Software", amount: -4920, level: 1, type: "item" },
      { id: "ads", label: "Advertising", amount: -8240, level: 1, type: "item" },
      { id: "travel", label: "Travel & Meals", amount: -6680, level: 1, type: "item" },
      { id: "op_total", label: "Operating Income", amount: 57340, level: 0, type: "total" },
      { id: "other_section", label: "Other Income / Expenses", amount: -2860, level: 0, type: "group" },
      { id: "interest", label: "Interest Expense", amount: -1860, level: 1, type: "item" },
      { id: "bank_fees", label: "Bank Fees", amount: -1000, level: 1, type: "item" },
      { id: "net_total", label: "Net Income", amount: 54490, level: 0, type: "total" },
    ],
    monthlyNet: [
      { month: "Jan", amount: 16340 },
      { month: "Feb", amount: 18510 },
      { month: "Mar", amount: 19640 },
    ],
    expenseMix: [
      { name: "Payroll", value: 50 },
      { name: "Materials", value: 21 },
      { name: "Rent", value: 18 },
      { name: "Advertising", value: 11 },
    ],
  },
}

export function getProfitLossByClientId(clientId) {
  return profitLossByClient[clientId] || null
}

function resolveMultiplier({ period, month, year, fromDate, toDate }) {
  if (period === "RANGE" && fromDate && toDate) {
    const start = new Date(`${fromDate}T00:00:00`)
    const end = new Date(`${toDate}T00:00:00`)
    const diff = Math.max(1, Math.round((end - start) / 86400000) + 1)
    return Math.min(1, Math.max(0.05, diff / 31))
  }

  if (period === "MONTH" && month) {
    const monthPart = Number(month.split("-")[1] || "1")
    return Math.min(1, Math.max(0.08, monthPart / 12))
  }

  if (period === "YEAR" && year) {
    if (year === "2026") return 1
    if (year === "2025") return 0.84
    if (year === "2024") return 0.72
    return 0.6
  }

  return PERIOD_MULTIPLIER[period] ?? PERIOD_MULTIPLIER.MONTH
}

function resolvePeriodLabel({ period, fromDate, toDate, month, year }) {
  if (period === "ALL") return "ALL"
  if (period === "RANGE") return `RANGE:${fromDate || "?"}->${toDate || "?"}`
  if (period === "MONTH" && month) return `MONTH:${month}`
  if (period === "YEAR" && year) return `YEAR:${year}`
  return period
}

export function getProfitLossByClientIdAndPeriod(clientId, options = {}) {
  const base = profitLossByClient[clientId]
  if (!base) return null

  const normalizedPeriod = String(options.period || "MONTH").toUpperCase()
  const multiplier = resolveMultiplier({
    period: normalizedPeriod,
    fromDate: options.fromDate,
    toDate: options.toDate,
    month: options.month,
    year: options.year,
  })

  return {
    ...base,
    period: resolvePeriodLabel({
      period: normalizedPeriod,
      fromDate: options.fromDate,
      toDate: options.toDate,
      month: options.month,
      year: options.year,
    }),
    kpis: base.kpis.map((kpi) => ({
      ...kpi,
      value: Math.round(kpi.value * multiplier),
    })),
    statement: base.statement.map((line) => ({
      ...line,
      amount: Math.round(line.amount * multiplier),
    })),
    monthlyNet: base.monthlyNet.map((point) => ({
      ...point,
      amount: Math.round(point.amount * multiplier),
    })),
  }
}
