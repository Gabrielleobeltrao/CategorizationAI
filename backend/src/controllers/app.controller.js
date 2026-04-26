import { getCurrentUserProfileService } from "../services/userProfile.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getAppBootstrapController(req, res) {
  try {
    const sessionData = await req.app.locals.auth.api.getSession({ headers: req.headers })

    if (!sessionData?.session || !sessionData?.user) {
      return res.status(200).json({
        isAuthenticated: false,
        profile: null,
      })
    }

    const email = String(sessionData.user.email || "").trim().toLowerCase()
    const profile = email ? await getCurrentUserProfileService(email) : null

    if (profile?.status === "inactive") {
      return res.status(403).json({ message: "Account is inactive" })
    }

    return res.status(200).json({
      isAuthenticated: true,
      profile: profile || null,
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
