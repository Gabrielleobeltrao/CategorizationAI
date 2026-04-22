import { ObjectId } from "mongodb"
import {
  findOfficeTagsByOfficeIdAndIds,
  findOfficeTagsByOfficeIdAndSlugs,
  listCategoryTagsByOfficeId,
  listCategoryTemplateTagsByOfficeId,
  listClientTagsByOfficeId,
  upsertOfficeTagsByOfficeId,
} from "../repositories/tag.repository.js"
import {
  getTagSlug,
  normalizeTagIds,
  normalizeTags,
} from "../utils/tags.js"

function normalizeCreatedBy(value) {
  const safeValue = String(value || "").trim()
  return safeValue || null
}

function getContextCreatedBy(context = {}) {
  return normalizeCreatedBy(
    context?.createdBy ||
    context?.actorProfileId ||
    context?.actorUserId
  )
}

function normalizeOfficeId(officeId) {
  return String(officeId || "").trim()
}

async function loadOfficeTagsByIds(officeId, tagIds = []) {
  const safeOfficeId = normalizeOfficeId(officeId)
  const safeTagIds = normalizeTagIds(tagIds)
  if (!safeOfficeId || safeTagIds.length === 0) return []

  const objectIds = safeTagIds
    .filter((tagId) => ObjectId.isValid(tagId))
    .map((tagId) => new ObjectId(tagId))

  if (objectIds.length === 0) return []

  return findOfficeTagsByOfficeIdAndIds(safeOfficeId, objectIds)
}

function buildTagsFromDocument(doc, officeTagsById = new Map()) {
  const labelsFromIds = normalizeTagIds(doc?.tagIds)
    .map((tagId) => officeTagsById.get(tagId)?.label)
    .filter(Boolean)

  const legacyLabels = normalizeTags(doc?.tags)

  return normalizeTags([
    ...labelsFromIds,
    ...legacyLabels,
  ])
}

export async function ensureOfficeTagCatalogFromLegacyService(officeId, context = {}) {
  const safeOfficeId = normalizeOfficeId(officeId)
  if (!safeOfficeId) throw new Error("officeId is required")

  const [clientTags, categoryTags, templateTags] = await Promise.all([
    listClientTagsByOfficeId(safeOfficeId),
    listCategoryTagsByOfficeId(safeOfficeId),
    listCategoryTemplateTagsByOfficeId(safeOfficeId),
  ])

  const normalizedLabels = normalizeTags([
    ...(Array.isArray(clientTags) ? clientTags : []),
    ...(Array.isArray(categoryTags) ? categoryTags : []),
    ...(Array.isArray(templateTags) ? templateTags : []),
  ])

  if (normalizedLabels.length === 0) return []

  await upsertOfficeTagsByOfficeId(
    safeOfficeId,
    normalizedLabels.map((label) => ({
      label,
      slug: getTagSlug(label),
      createdBy: getContextCreatedBy(context),
    }))
  )

  return normalizedLabels
}

export async function resolveOfficeTagRefsService(officeId, labels = [], context = {}) {
  const safeOfficeId = normalizeOfficeId(officeId)
  if (!safeOfficeId) throw new Error("officeId is required")

  const normalizedLabels = normalizeTags(labels)
  if (normalizedLabels.length === 0) {
    return {
      tags: [],
      tagIds: [],
    }
  }

  const targetItems = normalizedLabels.map((label) => ({
    label,
    slug: getTagSlug(label),
    createdBy: getContextCreatedBy(context),
  }))

  await upsertOfficeTagsByOfficeId(safeOfficeId, targetItems)

  const officeTags = await findOfficeTagsByOfficeIdAndSlugs(
    safeOfficeId,
    targetItems.map((item) => item.slug)
  )

  const officeTagsBySlug = new Map(
    officeTags.map((tag) => [String(tag?.slug || ""), tag])
  )

  const hydratedTags = []
  const hydratedTagIds = []

  for (const item of targetItems) {
    const match = officeTagsBySlug.get(item.slug)
    if (!match?._id) continue

    hydratedTags.push(String(match.label || item.label))
    hydratedTagIds.push(String(match._id))
  }

  return {
    tags: normalizeTags(hydratedTags),
    tagIds: normalizeTagIds(hydratedTagIds),
  }
}

export async function hydrateOfficeTagsForDocumentService(officeId, doc) {
  if (!doc) return doc

  const officeTags = await loadOfficeTagsByIds(officeId, doc?.tagIds)
  const officeTagsById = new Map(
    officeTags.map((tag) => [String(tag?._id || ""), tag])
  )

  return {
    ...doc,
    tagIds: normalizeTagIds(doc?.tagIds),
    tags: buildTagsFromDocument(doc, officeTagsById),
  }
}

export async function hydrateOfficeTagsForDocumentsService(officeId, docs = []) {
  const safeDocs = Array.isArray(docs) ? docs : []
  if (safeDocs.length === 0) return []

  const officeTags = await loadOfficeTagsByIds(
    officeId,
    safeDocs.flatMap((doc) => normalizeTagIds(doc?.tagIds))
  )

  const officeTagsById = new Map(
    officeTags.map((tag) => [String(tag?._id || ""), tag])
  )

  return safeDocs.map((doc) => ({
    ...doc,
    tagIds: normalizeTagIds(doc?.tagIds),
    tags: buildTagsFromDocument(doc, officeTagsById),
  }))
}
