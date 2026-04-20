import { getUserProfileByEmail } from "../repositories/userProfile.repository.js"

export async function requireAuth(req, res, next) {
  try {
    const session = await req.app.locals.auth.api.getSession({ headers: req.headers })
    if (!session?.session || !session?.user) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const email = String(session.user.email || "").toLowerCase()
    const profile = email ? await getUserProfileByEmail(email) : null

    if (profile?.status === "inactive") {
      return res.status(403).json({ message: "Account is inactive" })
    }

    req.session = session.session
    req.user = session.user
    req.userProfile = profile || null
    next()
  } catch {
    return res.status(401).json({ message: "Unauthorized" })
  }
}
