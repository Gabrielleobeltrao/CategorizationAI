import { getAccountBalancesReportService } from "../services/accountBalances.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getAccountBalancesReportController(req, res) {
  try {
    const { clientId } = req.params
    const { asOfDate, compareDate } = req.query

    const result = await getAccountBalancesReportService({
      clientId,
      asOfDate,
      compareDate,
    })

    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
