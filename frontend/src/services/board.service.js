import { api } from "../lib/api"

export async function listBoardCollections() {
    const payload = await api("/api/board/collections")
    return Array.isArray(payload?.items) ? payload.items : []
}

export async function createBoardCollection(name) {
    const safe = String(name || "").trim()
    if (!safe) throw new Error("name is required")
    return api("/api/board/collections", {
        method: "POST",
        body: JSON.stringify({ name: safe }),
    })
}

export async function renameBoardCollection(id, name) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    const safe = String(name || "").trim()
    if (!safe) throw new Error("name is required")
    return api(`/api/board/collections/${safeId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: safe }),
    })
}

export async function deleteBoardCollection(id) {
    const safeId = String(id || "").trim()
    if (!safeId) throw new Error("id is required")
    return api(`/api/board/collections/${safeId}`, { method: "DELETE" })
}
