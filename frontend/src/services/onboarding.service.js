import { api } from "../lib/api"

export async function getOnboardingState(clientId, { silentLoading = true, signal } = {}) {
    const id = String(clientId || "").trim()
    if (!id) throw new Error("clientId is required")
    return api(`/api/clients/${id}/onboarding-state`, {
        silentLoading: Boolean(silentLoading),
        signal,
    })
}
