import { bootstrapRegistrationService } from "../services/registration.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function bootstrapRegistrationController(req, res) {
  try {
    const result = await bootstrapRegistrationService(req.body, {
      user: req.user,
      currentProfile: req.userProfile,
    })

    return res.status(result?.alreadyCompleted ? 200 : 201).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
