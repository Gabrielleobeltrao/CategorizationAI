import { api } from "../lib/api"

export async function getAccountBalancesReport(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  const params = new URLSearchParams()
  if (options.asOfDate) params.set("asOfDate", String(options.asOfDate))
  if (options.compareDate) params.set("compareDate", String(options.compareDate))

  const qs = params.toString()
  const url = qs
    ? `/api/clients/${cleanClientId}/reports/account-balances?${qs}`
    : `/api/clients/${cleanClientId}/reports/account-balances`

  return api(url, {
    silentLoading: Boolean(options?.silentLoading),
    signal: options?.signal,
  })
}
