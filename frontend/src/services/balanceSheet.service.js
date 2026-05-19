import { api } from "../lib/api"

export async function getBalanceSheetReport(clientId, options = {}) {
    const cleanClientId = String(clientId || "").trim()
    if (!cleanClientId) throw new Error("clientId is required")

    const params = new URLSearchParams()
    if (options.asOfDate) params.set("asOfDate", String(options.asOfDate))

    const qs = params.toString()
    const url = qs
        ? `/api/clients/${cleanClientId}/reports/balance-sheet?${qs}`
        : `/api/clients/${cleanClientId}/reports/balance-sheet`

    return api(url, {
        silentLoading: Boolean(options?.silentLoading),
        signal: options?.signal,
    })
}
