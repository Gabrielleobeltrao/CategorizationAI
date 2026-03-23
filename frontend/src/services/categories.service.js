import { api } from "../lib/api"

export async function listCategoriesByClientId(clientId) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  return api(`/api/clients/${cleanClientId}/categories`)
}

export async function createCategory(input) {
  const clientId = String(input?.clientId || "").trim()
  const name = String(input?.name || "").trim()
  const type = String(input?.type || "").trim()
  const description = String(input?.description || "").trim()

  if (!clientId) throw new Error("clientId is required")
  if (!name) throw new Error("name is required")
  if (!type) throw new Error("type is required")
  if (!description) throw new Error("description is required")

  return api("/api/categories", {
    method: "POST",
    body: JSON.stringify({ clientId, name, type, description }),
  })
}

export async function updateCategoryById(categoryId, patch) {
  const id = String(categoryId || "").trim()
  if (!id) throw new Error("categoryId is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  return api(`/api/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function deleteCategoryById(categoryId) {
  const id = String(categoryId || "").trim()
  if (!id) throw new Error("categoryId is required")

  return api(`/api/categories/${id}`, {
    method: "DELETE",
  })
}
