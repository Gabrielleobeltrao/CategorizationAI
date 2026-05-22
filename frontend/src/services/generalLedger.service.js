import { api } from "../lib/api"

export async function getGeneralLedgerReport(clientId, { accountId, fromDate, toDate, silentLoading, signal } = {}) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    if (!accountId) throw new Error("accountId is required")
    const params = new URLSearchParams()
    params.set("accountId", String(accountId))
    if (fromDate) params.set("fromDate", fromDate)
    if (toDate) params.set("toDate", toDate)
    return api(`/api/clients/${id}/reports/general-ledger?${params.toString()}`, {
        silentLoading: Boolean(silentLoading),
        signal,
    })
}
