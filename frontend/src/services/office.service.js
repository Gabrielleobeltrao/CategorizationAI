import { api } from "../lib/api"
import { readSessionCache, removeSessionCache, writeSessionCache } from "../utils/sessionCache"

const officeByIdCache = new Map()
const OFFICE_CACHE_PREFIX = "cache:office:"

function getOfficeCacheKey(officeId) {
  return String(officeId || "").trim()
}

export function getCachedOfficeById(officeId) {
  const key = getOfficeCacheKey(officeId)
  if (!key) return null

  if (officeByIdCache.has(key)) {
    return officeByIdCache.get(key) || null
  }

  const persisted = readSessionCache(`${OFFICE_CACHE_PREFIX}${key}`, null)
  if (persisted) {
    officeByIdCache.set(key, persisted)
    return persisted
  }

  return null
}

export function clearOfficeByIdCache(officeId = "") {
  const key = getOfficeCacheKey(officeId)
  if (!key) {
    officeByIdCache.clear()
    if (typeof window !== "undefined") {
      Object.keys(window.sessionStorage)
        .filter((storageKey) => storageKey.startsWith(OFFICE_CACHE_PREFIX))
        .forEach((storageKey) => removeSessionCache(storageKey))
    }
    return
  }

  officeByIdCache.delete(key)
  removeSessionCache(`${OFFICE_CACHE_PREFIX}${key}`)
}

export async function getOfficeById(officeId, options = {}) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  const payload = await api(`/api/offices/${id}`, {
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  officeByIdCache.set(id, payload)
  writeSessionCache(`${OFFICE_CACHE_PREFIX}${id}`, payload)
  return payload
}

export async function updateOfficeById(officeId, patch) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  return api(`/api/offices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((payload) => {
    officeByIdCache.set(id, payload)
    writeSessionCache(`${OFFICE_CACHE_PREFIX}${id}`, payload)
    return payload
  })
}

export async function listOfficeTags(officeId) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  const response = await api(`/api/offices/${id}/tags`)
  return Array.isArray(response?.items) ? response.items : []
}

export async function deleteOfficeTag(officeId, tag) {
  const id = String(officeId || "").trim()
  const safeTag = String(tag || "").trim()

  if (!id) throw new Error("officeId is required")
  if (!safeTag) throw new Error("tag is required")

  return api(`/api/offices/${id}/tags`, {
    method: "DELETE",
    body: JSON.stringify({ tag: safeTag }),
  })
}
