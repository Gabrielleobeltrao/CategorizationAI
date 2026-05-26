import { api } from "../lib/api"

export async function listJournalEntries(clientId, options = {}) {
    const cleanClientId = String(clientId || "").trim()
    if (!cleanClientId) throw new Error("clientId is required")

    const params = new URLSearchParams()
    if (options.fromDate) params.set("fromDate", String(options.fromDate))
    if (options.toDate) params.set("toDate", String(options.toDate))
    if (options.accountId) params.set("accountId", String(options.accountId))
    if (options.limit) params.set("limit", String(options.limit))
    if (options.skip) params.set("skip", String(options.skip))

    const qs = params.toString()
    const url = qs
        ? `/api/clients/${cleanClientId}/journal-entries?${qs}`
        : `/api/clients/${cleanClientId}/journal-entries`

    return api(url, {
        silentLoading: Boolean(options?.silentLoading),
        signal: options?.signal,
    })
}

export async function createJournalEntry(input) {
    if (!input?.clientId) throw new Error("clientId is required")
    return api("/api/journal-entries", {
        method: "POST",
        body: JSON.stringify(input),
    })
}

export async function updateJournalEntry(id, patch) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/journal-entries/${safeId}`, {
        method: "PATCH",
        body: JSON.stringify(patch || {}),
    })
}

export async function deleteJournalEntry(id) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/journal-entries/${safeId}`, {
        method: "DELETE",
    })
}

// === Inbox / categorization flow ===

export async function createHalfEntry(input) {
    if (!input?.clientId) throw new Error("clientId is required")
    if (!input?.bankAccountId) throw new Error("bankAccountId is required")
    return api("/api/journal-entries/half", {
        method: "POST",
        body: JSON.stringify(input),
    })
}

export async function categorizeEntry(entryId, contraAccountId) {
    const safeId = String(entryId || "").trim()
    if (!safeId) throw new Error("entryId is required")
    if (!contraAccountId) throw new Error("contraAccountId is required")
    return api(`/api/journal-entries/${safeId}/categorize`, {
        method: "POST",
        body: JSON.stringify({ contraAccountId }),
    })
}

export async function listUncategorizedEntries(clientId, options = {}) {
    const safeClientId = String(clientId || "").trim()
    if (!safeClientId) throw new Error("clientId is required")
    const params = new URLSearchParams()
    if (options.limit) params.set("limit", String(options.limit))
    const qs = params.toString()
    const url = qs
        ? `/api/clients/${safeClientId}/journal-entries/uncategorized?${qs}`
        : `/api/clients/${safeClientId}/journal-entries/uncategorized`
    return api(url, {
        silentLoading: Boolean(options?.silentLoading),
        signal: options?.signal,
    })
}

export async function categorizeWithAi(clientId, options = {}) {
    const safeClientId = String(clientId || "").trim()
    if (!safeClientId) throw new Error("clientId is required")
    return api(`/api/clients/${safeClientId}/journal-entries/categorize-with-ai`, {
        method: "POST",
        body: JSON.stringify(options || {}),
    })
}
