import { getBalanceSheetReportService } from "../services/balanceSheet.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getBalanceSheetReportController(req, res) {
  try {
    const { clientId } = req.params
    const { asOfDate } = req.query

    const result = await getBalanceSheetReportService({
      clientId,
      asOfDate,
    })

    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
