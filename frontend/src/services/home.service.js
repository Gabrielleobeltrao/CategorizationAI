import { api } from "../lib/api"
import { readSessionCache, removeSessionCache, writeSessionCache } from "../utils/sessionCache"

const officeHomeDashboardCache = new Map()
const HOME_DASHBOARD_CACHE_PREFIX = "cache:home-dashboard:"

function getOfficeHomeDashboardCacheKey(officeId, options = {}) {
  return JSON.stringify({
    officeId: String(officeId || "").trim(),
    month: String(options?.month || "").trim(),
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

export async function getOfficeHomeDashboard(officeId, options = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    throw new Error("officeId is required")
  }

  const query = new URLSearchParams()
  if (options?.month) {
    query.set("month", String(options.month))
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
