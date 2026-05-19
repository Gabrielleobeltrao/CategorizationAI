import { getAccountBalancesByClientId } from "../repositories/accountBalances.repository.js"
import { AppError } from "../utils/appError.js"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value) {
  return typeof value === "string" && DATE_PATTERN.test(value)
}

export async function getAccountBalancesReportService({ clientId, asOfDate, compareDate }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new AppError("asOfDate must be YYYY-MM-DD", 400)
  }
  if (compareDate && !isValidDate(compareDate)) {
    throw new AppError("compareDate must be YYYY-MM-DD", 400)
  }

  const primary = await getAccountBalancesByClientId({ clientId, asOfDate })

  if (!compareDate) {
    return {
      asOfDate: asOfDate || null,
      compareDate: null,
      rows: primary.map((row) => ({
        accountId: row.accountId,
        name: row.name,
        type: row.type,
        balance: row.balance,
      })),
    }
  }

  const secondary = await getAccountBalancesByClientId({ clientId, asOfDate: compareDate })
  const secondaryMap = new Map(secondary.map((row) => [row.accountId, row.balance]))

  return {
    asOfDate: asOfDate || null,
    compareDate,
    rows: primary.map((row) => {
      const compareBalance = secondaryMap.get(row.accountId) || 0
      const delta = row.balance - compareBalance
      const percentChange = compareBalance !== 0
        ? (delta / Math.abs(compareBalance)) * 100
        : null
      return {
        accountId: row.accountId,
        name: row.name,
        type: row.type,
        balance: row.balance,
        compareBalance,
        delta,
        percentChange,
      }
    }),
  }
}
