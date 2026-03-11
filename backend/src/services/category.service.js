import {
  createCategory,
  updateCategiryById,
  listCategoriesByClientId,
  getCategoryById,
} from "../repositories/category.repository.js"

export async function createCategoryService(input) {
  if (!input?.name) throw new Error("name is required")

  return createCategory({
    name: input.name.trim(),
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

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateCategiryById(id, safePatch)
}

export async function listCategoriesByClientIdService(clientId) {
  if (!clientId) throw new Error("clientId is required")
  return listCategoriesByClientId(clientId)
}

export async function getCategoryByIdService(id) {
  if (!id) throw new Error("id is required")
  return getCategoryById(id)
}
