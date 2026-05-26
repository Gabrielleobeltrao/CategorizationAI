import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import { userClientScopeAllowsClient } from "../services/roles.service.js"

function resolveValue(req, from, field) {
  if (from === "params") return req.params?.[field]
  if (from === "query") return req.query?.[field]
  if (from === "body") return req.body?.[field]
  return undefined
}

function getResourceCache(req) {
  if (!req.resourceCache) {
    req.resourceCache = new Map()
  }

  return req.resourceCache
}

// When loading a client document, also enforce the per-user client-scope
// whitelist. Restricted users get a 404 (not 403) so we don't leak existence.
function enforceClientScopeIfNeeded(req, res, collection, doc) {
  if (collection !== "clients" || !doc) return true
  const profile = req.userProfile
  // No profile loaded yet means an earlier middleware already rejected the
  // request; let the normal flow continue and surface that auth error.
  if (!profile) return true
  if (userClientScopeAllowsClient(profile, doc._id)) return true
  res.status(404).json({ message: "clients not found" })
  return false
}

export function ensureResourceExists({ collection, from = "params", field = "id", assignKey }) {
  return async (req, res, next) => {
    const value = resolveValue(req, from, field)
    const safeValue = String(value || "").trim()

    if (assignKey) {
      const scopedDoc = req.scope?.[assignKey]
      if (scopedDoc && String(scopedDoc?._id || "") === safeValue) {
        if (!enforceClientScopeIfNeeded(req, res, collection, scopedDoc)) return
        return next()
      }
    }

    const cache = getResourceCache(req)
    const cacheKey = `${collection}:${safeValue}`
    const cachedDoc = cache.get(cacheKey)

    if (cachedDoc) {
      if (!enforceClientScopeIfNeeded(req, res, collection, cachedDoc)) return
      if (assignKey) {
        req.scope = req.scope || {}
        req.scope[assignKey] = cachedDoc
      }

      return next()
    }

    const db = getDB()
    const doc = await db.collection(collection).findOne({ _id: new ObjectId(safeValue) })

    if (!doc) {
      return res.status(404).json({
        message: `${collection} not found`,
      })
    }

    if (!enforceClientScopeIfNeeded(req, res, collection, doc)) return

    cache.set(cacheKey, doc)

    if (assignKey) {
      req.scope = req.scope || {}
      req.scope[assignKey] = doc
    }

    next()
  }
}
