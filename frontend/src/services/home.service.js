import { api } from "../lib/api"

const officeHomeDashboardCache = new Map()

function getOfficeHomeDashboardCacheKey(officeId, options = {}) {
  return JSON.stringify({
    officeId: String(officeId || "").trim(),
    month: String(options?.month || "").trim(),
  })
}

export function getCachedOfficeHomeDashboard(officeId, options = {}) {
  return officeHomeDashboardCache.get(getOfficeHomeDashboardCacheKey(officeId, options)) || null
}

export function clearOfficeHomeDashboardCache(officeId = "") {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    officeHomeDashboardCache.clear()
    return
  }

  for (const key of officeHomeDashboardCache.keys()) {
    if (key.includes(`"officeId":"${safeOfficeId}"`)) {
      officeHomeDashboardCache.delete(key)
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

  const payload = await api(path, { silentLoading: true })
  officeHomeDashboardCache.set(getOfficeHomeDashboardCacheKey(safeOfficeId, options), payload)
  return payload
}
