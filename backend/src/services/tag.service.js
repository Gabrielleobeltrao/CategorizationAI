import {
  deleteOfficeTagById,
  deleteTagFromCategoriesByOfficeId,
  deleteTagFromCategoryTemplatesByOfficeId,
  deleteTagFromClientsByOfficeId,
  deleteTagIdFromCategoriesByOfficeId,
  deleteTagIdFromCategoryTemplatesByOfficeId,
  deleteTagIdFromClientsByOfficeId,
  findOfficeTagsByOfficeIdAndSlugs,
  listOfficeTagsByOfficeId,
} from "../repositories/tag.repository.js"
import { getTagSlug, normalizeTags } from "../utils/tags.js"
import { syncOfficeClientsByTagsService } from "./categorySync.service.js"
import { ensureOfficeTagCatalogFromLegacyService } from "./tagCatalog.service.js"

export async function listOfficeTagsService(officeId, context = {}) {
  const safeOfficeId = String(officeId || "").trim()
  const actorOfficeId = String(context?.actorOfficeId || "").trim()

  if (!safeOfficeId) throw new Error("officeId is required")
  if (actorOfficeId && actorOfficeId !== safeOfficeId) {
    throw new Error("Forbidden for this office")
  }

  await ensureOfficeTagCatalogFromLegacyService(safeOfficeId, context)

  const officeTags = await listOfficeTagsByOfficeId(safeOfficeId)
  return (Array.isArray(officeTags) ? officeTags : [])
    .map((tag) => String(tag?.label || "").trim())
    .filter(Boolean)
}

export async function deleteOfficeTagService(officeId, tag, context = {}) {
  const safeOfficeId = String(officeId || "").trim()
  const actorOfficeId = String(context?.actorOfficeId || "").trim()
  const normalizedTag = normalizeTags([tag])[0] || ""
  const targetSlug = getTagSlug(normalizedTag)

  if (!safeOfficeId) throw new Error("officeId is required")
  if (!normalizedTag) throw new Error("tag is required")
  if (actorOfficeId && actorOfficeId !== safeOfficeId) {
    throw new Error("Forbidden for this office")
  }

  await ensureOfficeTagCatalogFromLegacyService(safeOfficeId, context)

  const existingTag = (
    await findOfficeTagsByOfficeIdAndSlugs(safeOfficeId, [targetSlug])
  )[0]

  const tagId = String(existingTag?._id || "")

  await Promise.all([
    deleteTagFromClientsByOfficeId(safeOfficeId, normalizedTag),
    deleteTagIdFromClientsByOfficeId(safeOfficeId, tagId),
    deleteTagFromCategoriesByOfficeId(safeOfficeId, normalizedTag),
    deleteTagIdFromCategoriesByOfficeId(safeOfficeId, tagId),
    deleteTagFromCategoryTemplatesByOfficeId(safeOfficeId, normalizedTag),
    deleteTagIdFromCategoryTemplatesByOfficeId(safeOfficeId, tagId),
  ])

  if (existingTag?._id) {
    await deleteOfficeTagById(existingTag._id)
  }

  await syncOfficeClientsByTagsService(safeOfficeId)

  return {
    deletedTag: String(existingTag?.label || normalizedTag),
  }
}
