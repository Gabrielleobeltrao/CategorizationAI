import { getGeneralLedgerReportService } from "../services/generalLedger.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getGeneralLedgerReportController(req, res) {
  try {
    const { clientId } = req.params
    const { accountId, fromDate, toDate } = req.query || {}
    const result = await getGeneralLedgerReportService({
      clientId,
      accountId,
      fromDate,
      toDate,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
