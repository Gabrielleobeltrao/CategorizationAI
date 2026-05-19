import { getChartOfAccountsService } from "../services/chartOfAccounts.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getChartOfAccountsController(req, res) {
  try {
    const { clientId } = req.params
    const result = await getChartOfAccountsService({ clientId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
