import { getGeneralLedgerByAccount } from "../repositories/generalLedger.repository.js"
import { AppError } from "../utils/appError.js"

export async function getGeneralLedgerReportService({ clientId, accountId, fromDate, toDate }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  if (!accountId) throw new AppError("accountId is required", 400)
  try {
    return await getGeneralLedgerByAccount({ clientId, accountId, fromDate, toDate })
  } catch (err) {
    throw new AppError(err?.message || "Failed to build general ledger", 400)
  }
}
