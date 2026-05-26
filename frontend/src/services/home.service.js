import { api } from "../lib/api"
import { readSessionCache, removeSessionCache, writeSessionCache } from "../utils/sessionCache"

const officeHomeDashboardCache = new Map()
const HOME_DASHBOARD_CACHE_PREFIX = "cache:home-dashboard:"

function getOfficeHomeDashboardCacheKey(officeId, options = {}) {
  return JSON.stringify({
    officeId: String(officeId || "").trim(),
    month: String(options?.month || "").trim(),
    actorId: String(options?.actorId || "").trim(),
    clientId: String(options?.clientId || "").trim(),
  })
}

function getPersistedOfficeHomeDashboardCacheKey(officeId, options = {}) {
  return `${HOME_DASHBOARD_CACHE_PREFIX}${getOfficeHomeDashboardCacheKey(officeId, options)}`
}

export function getCachedOfficeHomeDashboard(officeId, options = {}) {
  const key = getOfficeHomeDashboardCacheKey(officeId, options)
  if (officeHomeDashboardCache.has(key)) {
    return officeHomeDashboardCache.get(key) || null
  }

  const persisted = readSessionCache(getPersistedOfficeHomeDashboardCacheKey(officeId, options), null)
  if (persisted) {
    officeHomeDashboardCache.set(key, persisted)
    return persisted
  }

  return null
}

export function clearOfficeHomeDashboardCache(officeId = "") {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    officeHomeDashboardCache.clear()
    if (typeof window !== "undefined") {
      Object.keys(window.sessionStorage)
        .filter((key) => key.startsWith(HOME_DASHBOARD_CACHE_PREFIX))
        .forEach((key) => removeSessionCache(key))
    }
    return
  }

  for (const key of officeHomeDashboardCache.keys()) {
    if (key.includes(`"officeId":"${safeOfficeId}"`)) {
      officeHomeDashboardCache.delete(key)
      removeSessionCache(`${HOME_DASHBOARD_CACHE_PREFIX}${key}`)
    }
  }
}

export async function getOfficeHomeDashboardFeed(officeId, options = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    throw new Error("officeId is required")
  }

  const query = new URLSearchParams()
  if (options?.actorId) query.set("actorId", String(options.actorId))
  if (options?.clientId) query.set("clientId", String(options.clientId))
  query.set("_ts", String(Date.now()))

  return api(`/api/offices/${safeOfficeId}/dashboard/feed?${query.toString()}`, {
    silentLoading: true,
  })
}

export async function getOfficeHomeDashboardCustomRange(officeId, options = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    throw new Error("officeId is required")
  }

  const query = new URLSearchParams()
  if (options?.from) query.set("from", String(options.from))
  if (options?.to) query.set("to", String(options.to))
  if (options?.actorId) query.set("actorId", String(options.actorId))
  if (options?.clientId) query.set("clientId", String(options.clientId))
  query.set("_ts", String(Date.now()))

  return api(`/api/offices/${safeOfficeId}/dashboard/custom-range?${query.toString()}`, {
    silentLoading: true,
  })
}

export async function getOfficeOverview(officeId) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) throw new Error("officeId is required")

  return api(`/api/offices/${safeOfficeId}/overview?_ts=${Date.now()}`, {
    silentLoading: true,
  })
}

export async function getOfficeMyActivity(officeId, { limit = 30 } = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) throw new Error("officeId is required")

  const params = new URLSearchParams({ limit: String(limit), _ts: String(Date.now()) })
  return api(`/api/offices/${safeOfficeId}/me/activity?${params.toString()}`, {
    silentLoading: true,
  })
}

export async function getOfficeActivity(officeId, { actorId, action, targetType, from, to, limit = 100 } = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) throw new Error("officeId is required")

  const params = new URLSearchParams({ limit: String(limit), _ts: String(Date.now()) })
  if (actorId) params.set("actorId", String(actorId))
  if (action) params.set("action", String(action))
  if (targetType) params.set("targetType", String(targetType))
  if (from) params.set("from", String(from))
  if (to) params.set("to", String(to))

  return api(`/api/offices/${safeOfficeId}/activity?${params.toString()}`, {
    silentLoading: true,
  })
}

export async function getOfficeHomeDashboard(officeId, options = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    throw new Error("officeId is required")
  }

  const query = new URLSearchParams()
  if (options?.month) {
    query.set("month", String(options.month))
  }
  if (options?.actorId) {
    query.set("actorId", String(options.actorId))
  }
  if (options?.clientId) {
    query.set("clientId", String(options.clientId))
  }
  if (options?.noCache !== false) {
    query.set("_ts", String(Date.now()))
  }

  const queryString = query.toString()
  const path = queryString
    ? `/api/offices/${safeOfficeId}/dashboard?${queryString}`
    : `/api/offices/${safeOfficeId}/dashboard`

  const payload = await api(path, {
    silentLoading: true,
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  const cacheKey = getOfficeHomeDashboardCacheKey(safeOfficeId, options)
  officeHomeDashboardCache.set(cacheKey, payload)
  writeSessionCache(getPersistedOfficeHomeDashboardCacheKey(safeOfficeId, options), payload)
  return payload
}
