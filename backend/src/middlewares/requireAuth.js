import { getUserProfileByEmail } from "../repositories/userProfile.repository.js"

const PROFILE_CACHE_TTL_MS = Number(process.env.AUTH_PROFILE_CACHE_TTL_MS || 10000)
const profileCache = new Map()

function getCachedProfile(email) {
  const safeEmail = String(email || "").trim().toLowerCase()
  if (!safeEmail || PROFILE_CACHE_TTL_MS <= 0) return null

  const cached = profileCache.get(safeEmail)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    profileCache.delete(safeEmail)
    return null
  }

  return cached.profile
}

function setCachedProfile(email, profile) {
  const safeEmail = String(email || "").trim().toLowerCase()
  if (!safeEmail || PROFILE_CACHE_TTL_MS <= 0) return profile || null

  profileCache.set(safeEmail, {
    profile: profile || null,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  })

  return profile || null
}

export async function requireAuth(req, res, next) {
  try {
    const session = await req.app.locals.auth.api.getSession({ headers: req.headers })
    if (!session?.session || !session?.user) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const email = String(session.user.email || "").toLowerCase()
    const profile = email
      ? (getCachedProfile(email) ?? setCachedProfile(email, await getUserProfileByEmail(email)))
      : null

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
