import { getProfitLossByClientAndRange } from "../repositories/profitLoss.repository.js"

function toDateString(date) {
  return date.toISOString().slice(0, 10)
}

function getRangeByPeriod({ period, day, month, year }) {
  if (period === "DAY") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) {
      throw new Error("day must be in YYYY-MM-DD format")
    }
    return { startDate: day, endDate: day, periodLabel: `DAY:${day}` }
  }

  if (period === "MONTH") {
    if (!/^\d{4}-\d{2}$/.test(String(month || ""))) {
      throw new Error("month must be in YYYY-MM format")
    }

    const [yearPart, monthPart] = month.split("-").map(Number)
    const start = new Date(Date.UTC(yearPart, monthPart - 1, 1))
    const end = new Date(Date.UTC(yearPart, monthPart, 0))
    return {
      startDate: toDateString(start),
      endDate: toDateString(end),
      periodLabel: `MONTH:${month}`,
    }
  }

  if (period === "YEAR") {
    if (!/^\d{4}$/.test(String(year || ""))) {
      throw new Error("year must be in YYYY format")
    }

    const yearNumber = Number(year)
    const start = new Date(Date.UTC(yearNumber, 0, 1))
    const end = new Date(Date.UTC(yearNumber, 11, 31))
    return {
      startDate: toDateString(start),
      endDate: toDateString(end),
      periodLabel: `YEAR:${year}`,
    }
  }

  throw new Error("invalid period")
}

export async function getProfitLossByClientIdService({ clientId, period, day, month, year }) {
  if (!clientId) throw new Error("clientId is required")

  const normalizedPeriod = String(period || "MONTH").toUpperCase()

  if (!["DAY", "MONTH", "YEAR"].includes(normalizedPeriod)) {
    throw new Error("period must be one of: DAY, MONTH, YEAR")
  }

  const range = getRangeByPeriod({
    period: normalizedPeriod,
    day,
    month,
    year,
  })

  return getProfitLossByClientAndRange({
    clientId,
    startDate: range.startDate,
    endDate: range.endDate,
    periodLabel: normalizedPeriod,
  })
}
