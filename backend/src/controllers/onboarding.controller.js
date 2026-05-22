import { getOnboardingStateService } from "../services/onboarding.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getOnboardingStateController(req, res) {
  try {
    const { clientId } = req.params
    const result = await getOnboardingStateService({ clientId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
