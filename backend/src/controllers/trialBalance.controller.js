import { getTrialBalanceReportService } from "../services/trialBalance.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getTrialBalanceReportController(req, res) {
  try {
    const { clientId } = req.params
    const { asOfDate } = req.query
    const result = await getTrialBalanceReportService({ clientId, asOfDate })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
