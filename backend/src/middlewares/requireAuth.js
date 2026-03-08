import { auth } from "../lib/auth.js"

export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.session || !session?.user) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    req.session = session.session
    req.user = session.user
    next()
  } catch {
    return res.status(401).json({ message: "Unauthorized" })
  }
}