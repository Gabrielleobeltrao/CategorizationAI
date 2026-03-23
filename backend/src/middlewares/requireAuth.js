import { getDB } from "../db.js"

export async function requireAuth(req, res, next) {
  try {
    const session = await req.app.locals.auth.api.getSession({ headers: req.headers })
    if (!session?.session || !session?.user) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const email = String(session.user.email || "").toLowerCase()
    if (email) {
      const db = getDB()
      const profile = await db.collection("user_profile").findOne({ email })
      if (profile?.status === "inactive") {
        return res.status(403).json({ message: "Account is inactive" })
      }
    }

    req.session = session.session
    req.user = session.user
    next()
  } catch {
    return res.status(401).json({ message: "Unauthorized" })
  }
}
