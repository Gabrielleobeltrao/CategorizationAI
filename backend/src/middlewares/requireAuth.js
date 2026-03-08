import { auth } from "../lib/auth.js"

export async function requireAuth(req, res, next) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return res.status(401).json({ message: "Unauthorized" })
  req.session = session
  next()
}