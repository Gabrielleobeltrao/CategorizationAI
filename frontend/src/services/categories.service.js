import { api } from "../lib/api"
import { normalizeCategoryType } from "../constants/categoryTypes"

export async function listCategoriesByClientId(clientId) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  return api(`/api/clients/${cleanClientId}/categories`)
}

export async function createCategory(input) {
  const clientId = String(input?.clientId || "").trim()
  const name = String(input?.name || "").trim()
  const type = normalizeCategoryType(input?.type)
  const description = String(input?.description || "").trim()
  const tags = Array.isArray(input?.tags)
    ? input.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
    : []

  if (!clientId) throw new Error("clientId is required")
  if (!name) throw new Error("name is required")
  if (!type) throw new Error("type is required")
  if (!description) throw new Error("description is required")

  return api("/api/categories", {
    method: "POST",
    body: JSON.stringify({ clientId, name, type, description, tags }),
  })
}

export async function updateCategoryById(categoryId, patch) {
  const id = String(categoryId || "").trim()
  if (!id) throw new Error("categoryId is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const nextPatch = { ...patch }
  if (typeof patch.type === "string") {
    nextPatch.type = normalizeCategoryType(patch.type)
  }
  if (Array.isArray(patch?.tags)) {
    nextPatch.tags = patch.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
  }

  return api(`/api/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(nextPatch),
  })
}

export async function deleteCategoryById(categoryId) {
  const id = String(categoryId || "").trim()
  if (!id) throw new Error("categoryId is required")

  return api(`/api/categories/${id}`, {
    method: "DELETE",
  })
}
