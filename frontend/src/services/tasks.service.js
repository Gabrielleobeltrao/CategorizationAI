import { api } from "../lib/api"

function sanitizePayload(input = {}) {
  const payload = {}
  if (input.title !== undefined) payload.title = String(input.title || "")
  if (input.description !== undefined) payload.description = String(input.description || "")
  if (input.clientId !== undefined) payload.clientId = input.clientId || null
  if (input.assigneeId !== undefined) payload.assigneeId = input.assigneeId || null
  if (input.dueDate !== undefined) payload.dueDate = input.dueDate || null
  if (input.status !== undefined) payload.status = input.status
  return payload
}

export async function listTasks(filters = {}) {
  const params = new URLSearchParams()
  if (filters.clientId) params.set("clientId", String(filters.clientId).trim())
  if (filters.assigneeId) params.set("assigneeId", String(filters.assigneeId).trim())
  if (filters.status) params.set("status", String(filters.status).trim())

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
