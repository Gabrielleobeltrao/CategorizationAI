import { api } from "../lib/api"
import { readSessionCache, writeSessionCache } from "../utils/sessionCache"

const profitLossCache = new Map()
const profitLossPeriodOptionsCache = new Map()
const PROFIT_LOSS_CACHE_PREFIX = "cache:profit-loss:"
const PROFIT_LOSS_PERIOD_OPTIONS_CACHE_PREFIX = "cache:profit-loss-period-options:"

function getProfitLossCacheKey(clientId, options = {}) {
  return JSON.stringify({
    clientId: String(clientId || "").trim(),
    period: String(options.period || "MONTH").toUpperCase(),
    month: String(options.month || ""),
    year: String(options.year || ""),
    fromDate: String(options.fromDate || ""),
    toDate: String(options.toDate || ""),
  })
}

function getPeriodOptionsCacheKey(clientId) {
  return String(clientId || "").trim()
}

export function getCachedProfitLossByClientId(clientId, options = {}) {
  const key = getProfitLossCacheKey(clientId, options)
  if (profitLossCache.has(key)) return profitLossCache.get(key) || null

  const persisted = readSessionCache(`${PROFIT_LOSS_CACHE_PREFIX}${key}`, null)
  if (persisted) {
    profitLossCache.set(key, persisted)
    return persisted
  }

  return null
}

export function getCachedProfitLossPeriodOptionsByClientId(clientId) {
  const key = getPeriodOptionsCacheKey(clientId)
  if (!key) return null
  if (profitLossPeriodOptionsCache.has(key)) return profitLossPeriodOptionsCache.get(key) || null

  const persisted = readSessionCache(`${PROFIT_LOSS_PERIOD_OPTIONS_CACHE_PREFIX}${key}`, null)
  if (persisted) {
    profitLossPeriodOptionsCache.set(key, persisted)
    return persisted
  }

  return null
}

export async function getProfitLossByClientId(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  const params = new URLSearchParams()
  params.set("period", String(options.period || "MONTH").toUpperCase())

  if (options.month) params.set("month", String(options.month))
  if (options.year) params.set("year", String(options.year))
  if (options.fromDate) params.set("fromDate", String(options.fromDate))
  if (options.toDate) params.set("toDate", String(options.toDate))

  const payload = await api(`/api/clients/${cleanClientId}/profit-loss?${params.toString()}`, {
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  const cacheKey = getProfitLossCacheKey(cleanClientId, options)
  profitLossCache.set(cacheKey, payload)
  writeSessionCache(`${PROFIT_LOSS_CACHE_PREFIX}${cacheKey}`, payload)
  return payload
}

export async function getProfitLossPeriodOptionsByClientId(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")
  const silentLoading = Boolean(options.silentLoading)

  const payload = await api(`/api/clients/${cleanClientId}/profit-loss/period-options`, {
    silentLoading,
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  const cacheKey = getPeriodOptionsCacheKey(cleanClientId)
  profitLossPeriodOptionsCache.set(cacheKey, payload)
  writeSessionCache(`${PROFIT_LOSS_PERIOD_OPTIONS_CACHE_PREFIX}${cacheKey}`, payload)
  return payload
}
