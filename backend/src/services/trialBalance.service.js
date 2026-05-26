import { getTrialBalanceByClientId } from "../repositories/trialBalance.repository.js"
import { AppError } from "../utils/appError.js"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value) {
  return typeof value === "string" && DATE_PATTERN.test(value)
}

export async function getTrialBalanceReportService({ clientId, asOfDate }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new AppError("asOfDate must be YYYY-MM-DD", 400)
  }
  return getTrialBalanceByClientId({ clientId, asOfDate })
}
