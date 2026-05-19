import { api } from "../lib/api"

export async function getChartOfAccounts(clientId, options = {}) {
    const cleanClientId = String(clientId || "").trim()
    if (!cleanClientId) throw new Error("clientId is required")

    return api(`/api/clients/${cleanClientId}/chart-of-accounts`, {
        silentLoading: Boolean(options?.silentLoading),
        signal: options?.signal,
    })
}
