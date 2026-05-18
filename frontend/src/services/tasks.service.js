import { api } from "../lib/api"

function sanitizeIdList(value) {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

function sanitizePayload(input = {}) {
  const payload = {}
  if (input.title !== undefined) payload.title = String(input.title || "")
  if (input.description !== undefined) payload.description = String(input.description || "")
  if (input.clientIds !== undefined) payload.clientIds = sanitizeIdList(input.clientIds)
  if (input.assigneeIds !== undefined) payload.assigneeIds = sanitizeIdList(input.assigneeIds)
  if (input.dueDate !== undefined) payload.dueDate = input.dueDate || null
  if (input.status !== undefined) payload.status = input.status
  if (input.priority !== undefined) payload.priority = input.priority || "low"
  if (input.collectionId !== undefined) {
    payload.collectionId = input.collectionId ? String(input.collectionId).trim() : null
  }
  return payload
}

export async function listTasks(filters = {}) {
  const params = new URLSearchParams()
  if (filters.clientId) params.set("clientId", String(filters.clientId).trim())
  if (filters.assigneeId) params.set("assigneeId", String(filters.assigneeId).trim())
  if (filters.status) params.set("status", String(filters.status).trim())
  if (filters.priority) params.set("priority", String(filters.priority).trim())
  if (filters.from) params.set("from", String(filters.from).trim())
  if (filters.to) params.set("to", String(filters.to).trim())

  const qs = params.toString()
  const payload = await api(`/api/tasks${qs ? `?${qs}` : ""}`)
  return Array.isArray(payload?.items) ? payload.items : []
}

export async function createTask(input = {}) {
  return api("/api/tasks", {
    method: "POST",
    body: JSON.stringify(sanitizePayload(input)),
  })
}

export async function updateTaskById(taskId, patch = {}) {
  const id = String(taskId || "").trim()
  if (!id) throw new Error("taskId is required")

  return api(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(sanitizePayload(patch)),
  })
}

export async function deleteTaskById(taskId) {
  const id = String(taskId || "").trim()
  if (!id) throw new Error("taskId is required")

  return api(`/api/tasks/${id}`, {
    method: "DELETE",
  })
}

export async function addTaskComment(taskId, body) {
  const id = String(taskId || "").trim()
  if (!id) throw new Error("taskId is required")
  const safeBody = String(body || "").trim()
  if (!safeBody) throw new Error("comment body is required")
  return api(`/api/tasks/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: safeBody }),
  })
}

export async function updateTaskComment(taskId, commentId, body) {
  const id = String(taskId || "").trim()
  const safeCommentId = String(commentId || "").trim()
  if (!id) throw new Error("taskId is required")
  if (!safeCommentId) throw new Error("commentId is required")
  const safeBody = String(body || "").trim()
  if (!safeBody) throw new Error("comment body is required")
  return api(`/api/tasks/${id}/comments/${safeCommentId}`, {
    method: "PATCH",
    body: JSON.stringify({ body: safeBody }),
  })
}

export async function deleteTaskComment(taskId, commentId) {
  const id = String(taskId || "").trim()
  const safeCommentId = String(commentId || "").trim()
  if (!id) throw new Error("taskId is required")
  if (!safeCommentId) throw new Error("commentId is required")
  return api(`/api/tasks/${id}/comments/${safeCommentId}`, {
    method: "DELETE",
  })
}
