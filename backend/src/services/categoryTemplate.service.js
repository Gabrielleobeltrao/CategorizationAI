import {
  createCategoryTemplate,
  deleteCategoryTemplateById,
  getCategoryTemplateById,
  listCategoryTemplatesByOfficeId,
  listCategoryTemplatesByOfficeIdAndTags,
  updateCategoryTemplateById,
} from "../repositories/categoryTemplate.repository.js"
import { normalizeCategoryType } from "../config/categoryTypes.js"
import { getCategoryIdentityKey } from "../utils/categoryIdentity.js"
import { hasIntersection, normalizeTags } from "../utils/tags.js"
import { syncOfficeClientsByTagsService } from "./categorySync.service.js"
import {
  hydrateOfficeTagsForDocumentService,
  hydrateOfficeTagsForDocumentsService,
  resolveOfficeTagRefsService,
} from "./tagCatalog.service.js"

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return ""
  return String(value).trim()
}

async function assertCategoryTemplateIsUnique({ officeId, name, type, excludeId = "" }) {
  const safeOfficeId = String(officeId || "").trim()
  const nextKey = getCategoryIdentityKey(name, type)

  if (!safeOfficeId || !nextKey) return

  const templates = await listCategoryTemplatesByOfficeId(safeOfficeId)
  const hasDuplicate = (Array.isArray(templates) ? templates : []).some((template) => (
    String(template?._id || "") !== String(excludeId || "") &&
    getCategoryIdentityKey(template?.name, template?.type) === nextKey
  ))

  if (hasDuplicate) {
    throw new Error("global category already exists for this office")
  }
}

export async function createCategoryTemplateService(input, context = {}) {
  const officeId = String(input?.officeId || "").trim()
  const actorOfficeId = String(context?.actorOfficeId || "").trim()

  if (!officeId) throw new Error("officeId is required")
  if (actorOfficeId && actorOfficeId !== officeId) {
    throw new Error("Forbidden for this office")
  }
  if (!input?.name) throw new Error("name is required")
  if (!input?.type) throw new Error("type is required")
  if (!input?.description) throw new Error("description is required")

  const type = normalizeCategoryType(input.type)
  if (!type) throw new Error("type is invalid")
  const name = String(input.name).trim()
  const description = String(input.description).trim()

  await assertCategoryTemplateIsUnique({
    officeId,
    name,
    type,
  })

  const resolvedTags = await resolveOfficeTagRefsService(officeId, input.tags, context)

  const template = await createCategoryTemplate({
    officeId,
    name,
    type,
    description,
    tagIds: resolvedTags.tagIds,
  })

  await syncOfficeClientsByTagsService(officeId)

  return hydrateOfficeTagsForDocumentService(officeId, template)
}

export async function listCategoryTemplatesByOfficeIdService(officeId, context = {}) {
  const safeOfficeId = String(officeId || "").trim()
  const actorOfficeId = String(context?.actorOfficeId || "").trim()

  if (!safeOfficeId) throw new Error("officeId is required")
  if (actorOfficeId && actorOfficeId !== safeOfficeId) {
    throw new Error("Forbidden for this office")
  }

  const templates = await listCategoryTemplatesByOfficeId(safeOfficeId)
  return hydrateOfficeTagsForDocumentsService(safeOfficeId, templates)
}

export async function updateCategoryTemplateByIdService(id, patch, context = {}) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const current = await getCategoryTemplateById(id)
  if (!current) throw new Error("Category template not found")

  const actorOfficeId = String(context?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== String(current.officeId || "")) {
    throw new Error("Forbidden for this office")
  }

  const safePatch = {}

  if (typeof patch.name === "string") {
    const name = patch.name.trim()
    if (!name) throw new Error("name cannot be empty")
    safePatch.name = name
  }

  if (typeof patch.type === "string") {
    const type = normalizeCategoryType(patch.type)
    if (!type) throw new Error("type is invalid")
    safePatch.type = type
  }

  if (typeof patch.description === "string") {
    const description = patch.description.trim()
    if (!description) throw new Error("description cannot be empty")
    safePatch.description = description
  }

  if (patch.tags !== undefined) {
    const resolvedTags = await resolveOfficeTagRefsService(current.officeId, patch.tags, context)
    safePatch.tagIds = resolvedTags.tagIds
    safePatch.clearLegacyTags = true
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  const nextName = String(safePatch.name ?? current.name ?? "").trim()
  const nextType = normalizeCategoryType(safePatch.type ?? current.type)

  await assertCategoryTemplateIsUnique({
    officeId: current.officeId,
    name: nextName,
    type: nextType,
    excludeId: id,
  })

  const updated = await updateCategoryTemplateById(id, safePatch)
  await syncOfficeClientsByTagsService(String(current.officeId || ""))

  return hydrateOfficeTagsForDocumentService(current.officeId, updated)
}

export async function deleteCategoryTemplateByIdService(id, context = {}) {
  if (!id) throw new Error("id is required")

  const current = await getCategoryTemplateById(id)
  if (!current) throw new Error("Category template not found")

  const actorOfficeId = String(context?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== String(current.officeId || "")) {
    throw new Error("Forbidden for this office")
  }

  const result = await deleteCategoryTemplateById(id)
  await syncOfficeClientsByTagsService(String(current.officeId || ""))
  return result
}

export async function listMatchingCategoryTemplatesForClientService(input = {}) {
  const officeId = String(input?.officeId || "").trim()
  const clientTags = normalizeTags(input?.clientTags)

  if (!officeId) throw new Error("officeId is required")
  if (clientTags.length === 0) return []

  const resolvedTags = await resolveOfficeTagRefsService(officeId, clientTags, input?.context)
  const templates = await listCategoryTemplatesByOfficeIdAndTags(officeId, resolvedTags.tagIds)
  const hydratedTemplates = await hydrateOfficeTagsForDocumentsService(officeId, templates)

  return hydratedTemplates.filter((template) => hasIntersection(template?.tags, clientTags))
}

export function mapCategoryTemplateToClientCategoryInput(template, clientId) {
  return {
    clientId,
    name: String(template?.name || "").trim(),
    type: String(template?.type || "").trim(),
    description: normalizeOptionalText(template?.description),
    tags: normalizeTags(template?.tags),
    tagIds: Array.isArray(template?.tagIds) ? template.tagIds : [],
  }
}
