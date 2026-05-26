import { api } from "../lib/api"

export async function getTrialBalanceReport(clientId, { asOfDate, silentLoading, signal } = {}) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    const params = new URLSearchParams()
    if (asOfDate) params.set("asOfDate", asOfDate)
    const qs = params.toString()
    return api(
        `/api/clients/${id}/reports/trial-balance${qs ? `?${qs}` : ""}`,
        {
            silentLoading: Boolean(silentLoading),
            signal,
        },
    )
}
