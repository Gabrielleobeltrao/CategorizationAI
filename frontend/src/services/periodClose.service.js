import { api } from "../lib/api"

export async function getCurrentState(clientId) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    return api(`/api/clients/${id}/period-close`)
}

export async function getPreCloseChecks(clientId, throughDate) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    if (!throughDate) throw new Error("throughDate is required")
    return api(
        `/api/clients/${id}/period-close/pre-close-checks?throughDate=${encodeURIComponent(throughDate)}`,
        { silentLoading: true },
    )
}

export async function listPeriodCloseHistory(clientId, { limit } = {}) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    const params = new URLSearchParams()
    if (limit) params.set("limit", String(limit))
    const qs = params.toString()
    return api(`/api/clients/${id}/period-close/history${qs ? `?${qs}` : ""}`)
}

export async function closePeriod(clientId, { throughDate, note }) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    if (!throughDate) throw new Error("throughDate is required")
    return api(`/api/clients/${id}/period-close/close`, {
        method: "POST",
        body: JSON.stringify({ throughDate, note: note || "" }),
    })
}

export async function reopenPeriod(clientId, { note } = {}) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    return api(`/api/clients/${id}/period-close/reopen`, {
        method: "POST",
        body: JSON.stringify({ note: note || "" }),
    })
}
