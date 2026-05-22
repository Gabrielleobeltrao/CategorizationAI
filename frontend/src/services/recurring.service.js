import { api } from "../lib/api"

export async function listRecurringEntries(clientId) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    return api(`/api/clients/${id}/recurring-entries`)
}

export async function createRecurringEntry(clientId, payload) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    return api(`/api/clients/${id}/recurring-entries`, {
        method: "POST",
        body: JSON.stringify(payload || {}),
    })
}

export async function updateRecurringEntry(id, patch) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/recurring-entries/${safeId}`, {
        method: "PATCH",
        body: JSON.stringify(patch || {}),
    })
}

export async function deleteRecurringEntry(id) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/recurring-entries/${safeId}`, { method: "DELETE" })
}

export async function setRecurringEntryActive(id, isActive) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/recurring-entries/${safeId}/active`, {
        method: "POST",
        body: JSON.stringify({ isActive: Boolean(isActive) }),
    })
}

export async function runRecurringEntry(id) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/recurring-entries/${safeId}/run`, { method: "POST" })
}

export async function skipRecurringEntry(id) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/recurring-entries/${safeId}/skip`, { method: "POST" })
}
