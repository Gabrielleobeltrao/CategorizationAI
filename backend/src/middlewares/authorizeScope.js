import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

function resolveValue(req, from, field) {
  if (from === "params") return req.params?.[field]
  if (from === "query") return req.query?.[field]
  if (from === "body") return req.body?.[field]
  return undefined
}

export function ensureResourceExists({ collection, from = "params", field = "id", assignKey }) {
  return async (req, res, next) => {
    const value = resolveValue(req, from, field)

    const db = getDB()
    const doc = await db.collection(collection).findOne({ _id: new ObjectId(value) })

    if (!doc) {
      return res.status(404).json({
        message: `${collection} not found`,
      })
    }

    if (assignKey) {
      req.scope = req.scope || {}
      req.scope[assignKey] = doc
    }

    next()
  }
}
