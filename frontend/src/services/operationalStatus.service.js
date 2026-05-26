import { api } from "../lib/api"

export async function getClientOperationalStatus(clientId) {
    const safeClientId = String(clientId || "").trim()
    if (!safeClientId) throw new Error("clientId is required")
    return api(`/api/clients/${safeClientId}/operational-status`, { silentLoading: true })
}

export async function setClientOperationalStatus(clientId, { status, reason } = {}) {
    const safeClientId = String(clientId || "").trim()
    if (!safeClientId) throw new Error("clientId is required")
    return api(`/api/clients/${safeClientId}/operational-status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
    })
}

export async function listOperationalStatusesByOfficeId(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) throw new Error("officeId is required")
    const payload = await api(`/api/offices/${safeOfficeId}/operational-status`, { silentLoading: true })
    return Array.isArray(payload?.items) ? payload.items : []
}
