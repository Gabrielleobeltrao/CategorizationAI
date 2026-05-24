import { api, apiUrl } from "../lib/api"

const MAX_CHAT_FILE_BYTES = 100 * 1024 * 1024 // 100MB — matches the backend cap

export async function uploadChatFile(officeId, file) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) throw new Error("officeId is required")
    if (!file) throw new Error("file is required")
    if (file.size > MAX_CHAT_FILE_BYTES) {
        throw new Error("File exceeds the 100MB limit")
    }
    const form = new FormData()
    form.append("file", file, file.name)
    const response = await fetch(apiUrl(`/api/offices/${safeOfficeId}/chat/files`), {
        method: "POST",
        credentials: "include",
        body: form,
    })
    if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(text || `Upload failed (${response.status})`)
    }
    return response.json()
}

export function getChatFileDownloadUrl(officeId, fileId, { inline = false } = {}) {
    const safeOfficeId = String(officeId || "").trim()
    const safeFileId = String(fileId || "").trim()
    if (!safeOfficeId || !safeFileId) return ""
    const path = `/api/offices/${safeOfficeId}/chat/files/${safeFileId}${inline ? "?inline=true" : ""}`
    return apiUrl(path)
}

export async function listConversations(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) throw new Error("officeId is required")
    return api(`/api/offices/${safeOfficeId}/chat/conversations?_ts=${Date.now()}`, {
        silentLoading: true,
    })
}

export async function openDmConversation(officeId, withUserId) {
    const safeOfficeId = String(officeId || "").trim()
    const safeUserId = String(withUserId || "").trim()
    if (!safeOfficeId || !safeUserId) throw new Error("officeId and withUserId are required")
    return api(`/api/offices/${safeOfficeId}/chat/conversations/dm`, {
        method: "POST",
        body: JSON.stringify({ withUserId: safeUserId }),
        silentLoading: true,
    })
}

export async function createGroupConversation(officeId, { name, memberIds }) {
    const safeOfficeId = String(officeId || "").trim()
    const safeName = String(name || "").trim()
    const ids = Array.isArray(memberIds) ? memberIds.map((id) => String(id || "").trim()).filter(Boolean) : []
    if (!safeOfficeId) throw new Error("officeId is required")
    if (!safeName) throw new Error("group name is required")
    if (ids.length === 0) throw new Error("pick at least one other member")
    return api(`/api/offices/${safeOfficeId}/chat/conversations/group`, {
        method: "POST",
        body: JSON.stringify({ name: safeName, memberIds: ids }),
        silentLoading: true,
    })
}

export async function listConversationMessages(officeId, conversationId, { limit = 50, since } = {}) {
    const safeOfficeId = String(officeId || "").trim()
    const safeConversationId = String(conversationId || "").trim()
    if (!safeOfficeId || !safeConversationId) throw new Error("officeId and conversationId are required")
    const params = new URLSearchParams({ limit: String(limit), _ts: String(Date.now()) })
    if (since) params.set("since", String(since))
    return api(`/api/offices/${safeOfficeId}/chat/conversations/${safeConversationId}/messages?${params.toString()}`, {
        silentLoading: true,
    })
}

export async function sendConversationMessage(officeId, conversationId, body, { attachment } = {}) {
    const safeOfficeId = String(officeId || "").trim()
    const safeConversationId = String(conversationId || "").trim()
    const safeBody = String(body || "").trim()
    if (!safeOfficeId || !safeConversationId) throw new Error("officeId and conversationId are required")
    if (!safeBody && !attachment) throw new Error("body or attachment is required")
    return api(`/api/offices/${safeOfficeId}/chat/conversations/${safeConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: safeBody, attachment: attachment || undefined }),
        silentLoading: true,
    })
}

export async function adminListConversations(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) throw new Error("officeId is required")
    return api(`/api/offices/${safeOfficeId}/chat/admin/conversations?_ts=${Date.now()}`, {
        silentLoading: true,
    })
}

export async function adminListConversationMessages(officeId, conversationId, { limit = 200 } = {}) {
    const safeOfficeId = String(officeId || "").trim()
    const safeConversationId = String(conversationId || "").trim()
    if (!safeOfficeId || !safeConversationId) throw new Error("officeId and conversationId are required")
    const params = new URLSearchParams({ limit: String(limit), _ts: String(Date.now()) })
    return api(`/api/offices/${safeOfficeId}/chat/admin/conversations/${safeConversationId}/messages?${params.toString()}`, {
        silentLoading: true,
    })
}

export async function adminDeleteConversation(officeId, conversationId) {
    const safeOfficeId = String(officeId || "").trim()
    const safeConversationId = String(conversationId || "").trim()
    if (!safeOfficeId || !safeConversationId) throw new Error("officeId and conversationId are required")
    return api(`/api/offices/${safeOfficeId}/chat/admin/conversations/${safeConversationId}`, {
        method: "DELETE",
        silentLoading: true,
    })
}

export async function markConversationRead(officeId, conversationId) {
    const safeOfficeId = String(officeId || "").trim()
    const safeConversationId = String(conversationId || "").trim()
    if (!safeOfficeId || !safeConversationId) throw new Error("officeId and conversationId are required")
    return api(`/api/offices/${safeOfficeId}/chat/conversations/${safeConversationId}/read`, {
        method: "POST",
        silentLoading: true,
    })
}

export async function updateChatMessage(officeId, messageId, body) {
    const safeOfficeId = String(officeId || "").trim()
    const safeMessageId = String(messageId || "").trim()
    const safeBody = String(body || "").trim()
    if (!safeOfficeId || !safeMessageId) throw new Error("officeId and messageId are required")
    if (!safeBody) throw new Error("body is required")
    return api(`/api/offices/${safeOfficeId}/chat/messages/${safeMessageId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: safeBody }),
        silentLoading: true,
    })
}

export async function deleteConversation(officeId, conversationId) {
    const safeOfficeId = String(officeId || "").trim()
    const safeConversationId = String(conversationId || "").trim()
    if (!safeOfficeId || !safeConversationId) throw new Error("officeId and conversationId are required")
    return api(`/api/offices/${safeOfficeId}/chat/conversations/${safeConversationId}`, {
        method: "DELETE",
        silentLoading: true,
    })
}

export async function updateGroupMembers(officeId, conversationId, memberIds) {
    const safeOfficeId = String(officeId || "").trim()
    const safeConversationId = String(conversationId || "").trim()
    const ids = Array.isArray(memberIds) ? memberIds.map((id) => String(id || "").trim()).filter(Boolean) : []
    if (!safeOfficeId || !safeConversationId) throw new Error("officeId and conversationId are required")
    return api(`/api/offices/${safeOfficeId}/chat/conversations/${safeConversationId}/members`, {
        method: "PATCH",
        body: JSON.stringify({ memberIds: ids }),
        silentLoading: true,
    })
}

export async function deleteChatMessage(officeId, messageId) {
    const safeOfficeId = String(officeId || "").trim()
    const safeMessageId = String(messageId || "").trim()
    if (!safeOfficeId || !safeMessageId) throw new Error("officeId and messageId are required")
    return api(`/api/offices/${safeOfficeId}/chat/messages/${safeMessageId}`, {
        method: "DELETE",
        silentLoading: true,
    })
}
