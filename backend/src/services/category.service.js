import {
  createCategory,
  updateCategoryById,
  listCategoriesByClientId,
  getCategoryById,
} from "../repositories/category.repository.js"

export async function createCategoryService(input) {
  if (!input?.name) throw new Error("name is required")
  if (!input?.type) throw new Error("type is required")
  if (!input?.description) throw new Error("description is required")
  if (!input?.clientId) throw new Error("clientId is required")

  return createCategory({
    name: input.name.trim(),
    type: input.type.trim(),
    description: input.description.trim(),
    clientId: input.clientId,
  })
}

export async function updateCategoryByIdService(id, patch) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const safePatch = {}

  if (typeof patch.name === "string") {
    const name = patch.name.trim()
    if (!name) throw new Error("name cannot be empty")
    safePatch.name = name
  }

  if (typeof patch.type === "string") {
    const type = patch.type.trim()
    if (!type) throw new Error("type cannot be empty")
    safePatch.type = type
  }

  if (typeof patch.description === "string") {
    const description = patch.description.trim()
    if (!description) throw new Error("description cannot be empty")
    safePatch.description = description
  }

  if (typeof patch.clientId === "string") {
    const clientId = patch.clientId.trim()
    if (!clientId) throw new Error("clientId cannot be empty")
    safePatch.clientId = clientId
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateCategoryById(id, safePatch)
}

export async function listCategoriesByClientIdService(clientId) {
  if (!clientId) throw new Error("clientId is required")
  return listCategoriesByClientId(clientId)
}

export async function getCategoryByIdService(id) {
  if (!id) throw new Error("id is required")
  return getCategoryById(id)
}
