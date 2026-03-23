import { getProfitLossByClientAndRange } from "../repositories/profitLoss.repository.js"

function toDateString(date) {
  return date.toISOString().slice(0, 10)
}

function getRangeByPeriod({ period, month, year, fromDate, toDate }) {
  if (period === "ALL") {
    return { startDate: null, endDate: null, periodLabel: "ALL" }
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

  if (period === "RANGE") {
    const safeFrom = String(fromDate || "").trim()
    const safeTo = String(toDate || "").trim()
    const validFormat = /^\d{4}-\d{2}-\d{2}$/

    if (!validFormat.test(safeFrom) || !validFormat.test(safeTo)) {
      throw new Error("fromDate and toDate must be in YYYY-MM-DD format")
    }

    if (safeFrom > safeTo) {
      throw new Error("fromDate cannot be greater than toDate")
    }

    return {
      startDate: safeFrom,
      endDate: safeTo,
      periodLabel: `RANGE:${safeFrom}->${safeTo}`,
    }
  }

  throw new Error("invalid period")
}

export async function getProfitLossByClientIdService({
  clientId,
  period,
  month,
  year,
  fromDate,
  toDate,
}) {
  if (!clientId) throw new Error("clientId is required")

  const normalizedPeriod = String(period || "MONTH").toUpperCase()

  if (!["ALL", "MONTH", "YEAR", "RANGE"].includes(normalizedPeriod)) {
    throw new Error("period must be one of: ALL, MONTH, YEAR, RANGE")
  }

  const range = getRangeByPeriod({
    period: normalizedPeriod,
    month,
    year,
    fromDate,
    toDate,
  })

  return getProfitLossByClientAndRange({
    clientId,
    startDate: range.startDate,
    endDate: range.endDate,
    periodLabel: range.periodLabel,
  })
}
