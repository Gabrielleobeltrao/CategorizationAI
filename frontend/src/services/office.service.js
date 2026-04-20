import { api } from "../lib/api"

export async function getOfficeById(officeId) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  return api(`/api/offices/${id}`)
}

export async function updateOfficeById(officeId, patch) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  return api(`/api/offices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function listOfficeTags(officeId) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  const response = await api(`/api/offices/${id}/tags`)
  return Array.isArray(response?.items) ? response.items : []
}

export async function deleteOfficeTag(officeId, tag) {
  const id = String(officeId || "").trim()
  const safeTag = String(tag || "").trim()

  if (!id) throw new Error("officeId is required")
  if (!safeTag) throw new Error("tag is required")

  return api(`/api/offices/${id}/tags`, {
    method: "DELETE",
    body: JSON.stringify({ tag: safeTag }),
  })
}
