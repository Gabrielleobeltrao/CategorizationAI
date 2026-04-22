import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

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

export function ensureResourceExists({ collection, from = "params", field = "id", assignKey }) {
  return async (req, res, next) => {
    const value = resolveValue(req, from, field)
    const safeValue = String(value || "").trim()

    if (assignKey) {
      const scopedDoc = req.scope?.[assignKey]
      if (scopedDoc && String(scopedDoc?._id || "") === safeValue) {
        return next()
      }
    }

    const cache = getResourceCache(req)
    const cacheKey = `${collection}:${safeValue}`
    const cachedDoc = cache.get(cacheKey)

    if (cachedDoc) {
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

    cache.set(cacheKey, doc)

    if (assignKey) {
      req.scope = req.scope || {}
      req.scope[assignKey] = doc
    }

    next()
  }
}
