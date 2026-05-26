import { getClientHomeService } from "../services/clientHome.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getClientHomeController(req, res) {
  try {
    const { clientId } = req.params
    const result = await getClientHomeService({ clientId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
