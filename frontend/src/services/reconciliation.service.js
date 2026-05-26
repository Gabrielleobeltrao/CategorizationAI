import { api } from "../lib/api"

export async function listReconciliations(clientId, { accountId, limit } = {}) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    const params = new URLSearchParams()
    if (accountId) params.set("accountId", String(accountId))
    if (limit) params.set("limit", String(limit))
    const qs = params.toString()
    return api(`/api/clients/${id}/reconciliations${qs ? `?${qs}` : ""}`)
}

export async function getActiveReconciliation(clientId, accountId) {
    const id = String(clientId || "").trim()
    if (!id || !accountId) return { reconciliation: null }
    return api(`/api/clients/${id}/reconciliations/active?accountId=${encodeURIComponent(accountId)}`)
}

export async function getOpeningBalance(clientId, accountId) {
    const id = String(clientId || "").trim()
    if (!id || !accountId) return { openingBalance: 0 }
    return api(
        `/api/clients/${id}/reconciliations/opening-balance?accountId=${encodeURIComponent(accountId)}`,
    )
}

export async function startReconciliation(clientId, payload) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    return api(`/api/clients/${id}/reconciliations`, {
        method: "POST",
        body: JSON.stringify(payload || {}),
    })
}

export async function getReconciliationWorksheet(reconciliationId) {
    const id = String(reconciliationId || "").trim()
    if (!id) throw new Error("reconciliationId is required")
    return api(`/api/reconciliations/${id}`)
}

export async function updateReconciliation(reconciliationId, legRefs) {
    const id = String(reconciliationId || "").trim()
    if (!id) throw new Error("reconciliationId is required")
    return api(`/api/reconciliations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ legRefs: legRefs || [] }),
    })
}

export async function completeReconciliation(reconciliationId, legRefs) {
    const id = String(reconciliationId || "").trim()
    if (!id) throw new Error("reconciliationId is required")
    return api(`/api/reconciliations/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({ legRefs: legRefs || [] }),
    })
}

export async function reopenReconciliation(reconciliationId) {
    const id = String(reconciliationId || "").trim()
    if (!id) throw new Error("reconciliationId is required")
    return api(`/api/reconciliations/${id}/reopen`, { method: "POST" })
}

export async function cancelReconciliation(reconciliationId) {
    const id = String(reconciliationId || "").trim()
    if (!id) throw new Error("reconciliationId is required")
    return api(`/api/reconciliations/${id}`, { method: "DELETE" })
}
