import { api } from "../lib/api"
import { normalizeCategoryType } from "../constants/categoryTypes"

export async function listCategoryTemplatesByOfficeId(officeId) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  return api(`/api/offices/${id}/category-templates`)
}

export async function createCategoryTemplate(input) {
  const officeId = String(input?.officeId || "").trim()
  const name = String(input?.name || "").trim()
  const type = normalizeCategoryType(input?.type)
  const description = String(input?.description || "").trim()
  const tags = Array.isArray(input?.tags) ? input.tags : []

  if (!officeId) throw new Error("officeId is required")
  if (!name) throw new Error("name is required")
  if (!type) throw new Error("type is required")
  if (!description) throw new Error("description is required")

  return api("/api/category-templates", {
    method: "POST",
    body: JSON.stringify({ officeId, name, type, description, tags }),
  })
}

export async function updateCategoryTemplateById(templateId, patch) {
  const id = String(templateId || "").trim()
  if (!id) throw new Error("templateId is required")

  const nextPatch = { ...patch }
  if (typeof patch?.type === "string") {
    nextPatch.type = normalizeCategoryType(patch.type)
  }

  return api(`/api/category-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(nextPatch),
  })
}

export async function deleteCategoryTemplateById(templateId) {
  const id = String(templateId || "").trim()
  if (!id) throw new Error("templateId is required")

  return api(`/api/category-templates/${id}`, {
    method: "DELETE",
  })
}
