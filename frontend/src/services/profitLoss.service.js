import { api } from "../lib/api"

export async function getProfitLossByClientId(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  const params = new URLSearchParams()
  params.set("period", String(options.period || "MONTH").toUpperCase())

  if (options.month) params.set("month", String(options.month))
  if (options.year) params.set("year", String(options.year))
  if (options.fromDate) params.set("fromDate", String(options.fromDate))
  if (options.toDate) params.set("toDate", String(options.toDate))

  return api(`/api/clients/${cleanClientId}/profit-loss?${params.toString()}`)
}
