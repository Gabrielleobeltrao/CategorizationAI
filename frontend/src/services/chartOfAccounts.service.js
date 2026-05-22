import { api } from "../lib/api"

export async function getChartOfAccounts(clientId, options = {}) {
    const cleanClientId = String(clientId || "").trim()
    if (!cleanClientId) throw new Error("clientId is required")

    return api(`/api/clients/${cleanClientId}/chart-of-accounts`, {
        silentLoading: Boolean(options?.silentLoading),
        signal: options?.signal,
    })
}

export async function listCoaPresets() {
    return api(`/api/coa-presets`)
}

export async function applyCoaPreset(clientId, presetId) {
    const cleanClientId = String(clientId || "").trim()
    if (!cleanClientId) throw new Error("clientId is required")
    if (!presetId) throw new Error("presetId is required")
    return api(`/api/clients/${cleanClientId}/chart-of-accounts/apply-preset`, {
        method: "POST",
        body: JSON.stringify({ presetId }),
    })
}

export async function createCustomCoaPreset({ name, description, accounts }) {
    if (!name) throw new Error("name is required")
    if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error("at least one account is required")
    }
    return api(`/api/coa-presets`, {
        method: "POST",
        body: JSON.stringify({ name, description: description || "", accounts }),
    })
}

export async function deleteCustomCoaPreset(presetId) {
    const id = String(presetId || "").replace(/^custom:/, "").trim()
    if (!id) throw new Error("presetId is required")
    return api(`/api/coa-presets/${id}`, { method: "DELETE" })
}
