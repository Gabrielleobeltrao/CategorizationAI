import { api } from "../lib/api"

export async function getClientHome(clientId, { silentLoading = true, signal } = {}) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    return api(`/api/clients/${id}/home`, {
        silentLoading: Boolean(silentLoading),
        signal,
    })
}
