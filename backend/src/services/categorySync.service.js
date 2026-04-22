import {
  createCategory,
  deleteCategoryById,
  listCategoriesByClientId,
  updateCategoryById,
} from "../repositories/category.repository.js"
import { listCategoryTemplatesByOfficeId } from "../repositories/categoryTemplate.repository.js"
import { getClientById, listAllClientsByOfficeId } from "../repositories/clients.repository.js"
import { countTransactionsByCategoryId } from "../repositories/transactions.repository.js"
import { getCategoryIdentityKey } from "../utils/categoryIdentity.js"
import { hasIntersection, normalizeTagIds, normalizeTags } from "../utils/tags.js"
import {
  hydrateOfficeTagsForDocumentService,
  hydrateOfficeTagsForDocumentsService,
} from "./tagCatalog.service.js"

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return ""
  return String(value).trim()
}

function shouldUpdateCategoryFromTemplate(category, template, templateId) {
  return (
    String(category?.name || "") !== String(template?.name || "").trim() ||
    String(category?.type || "") !== String(template?.type || "").trim() ||
    String(category?.description || "") !== normalizeOptionalText(template?.description) ||
    JSON.stringify(normalizeTagIds(category?.tagIds)) !== JSON.stringify(normalizeTagIds(template?.tagIds)) ||
    JSON.stringify(normalizeTags(category?.tags)) !== JSON.stringify(normalizeTags(template?.tags)) ||
    String(category?.templateCategoryId || "") !== templateId ||
    !category?.isTemplateSynced
  )
}

export async function syncClientCategoriesByTagsService(input = {}) {
  const safeClientId = String(input?.clientId || "").trim()
  if (!safeClientId) throw new Error("clientId is required")

  const rawClient = await getClientById(safeClientId)
  if (!rawClient) throw new Error("Client not found")

  const officeId = String(input?.officeId || rawClient?.officeId || "").trim()
  if (!officeId) throw new Error("officeId is required")

  const client = await hydrateOfficeTagsForDocumentService(officeId, rawClient)
  const clientTags = normalizeTags(client?.tags)

  const [rawTemplates, rawCategories] = await Promise.all([
    listCategoryTemplatesByOfficeId(officeId),
    listCategoriesByClientId(safeClientId),
  ])

  const [templates, categories] = await Promise.all([
    hydrateOfficeTagsForDocumentsService(officeId, rawTemplates),
    hydrateOfficeTagsForDocumentsService(officeId, rawCategories),
  ])

  const desiredTemplates = (Array.isArray(templates) ? templates : []).filter((template) =>
    hasIntersection(template?.tags, clientTags)
  )

  const desiredTemplateIds = new Set(
    desiredTemplates.map((template) => String(template?._id || "")).filter(Boolean)
  )

  const categoriesByTemplateId = new Map(
    (Array.isArray(categories) ? categories : [])
      .filter((category) => String(category?.templateCategoryId || "").trim())
      .map((category) => [String(category.templateCategoryId), category])
  )

  const categoryIdentityKeys = new Set(
    (Array.isArray(categories) ? categories : [])
      .map((category) => getCategoryIdentityKey(category?.name, category?.type))
      .filter(Boolean)
  )

  for (const template of desiredTemplates) {
    const templateId = String(template?._id || "").trim()
    if (!templateId) continue

    const linkedCategory = categoriesByTemplateId.get(templateId)
    const desiredIdentityKey = getCategoryIdentityKey(template?.name, template?.type)

    if (linkedCategory) {
      const hasCollision = (Array.isArray(categories) ? categories : []).some((category) => (
        String(category?._id || "") !== String(linkedCategory?._id || "") &&
        getCategoryIdentityKey(category?.name, category?.type) === desiredIdentityKey
      ))

      if (!hasCollision && shouldUpdateCategoryFromTemplate(linkedCategory, template, templateId)) {
        const updated = await updateCategoryById(String(linkedCategory._id), {
          name: String(template?.name || "").trim(),
          type: String(template?.type || "").trim(),
          description: normalizeOptionalText(template?.description),
          tagIds: normalizeTagIds(template?.tagIds),
          templateCategoryId: templateId,
          isTemplateSynced: true,
          clearLegacyTags: true,
        })

        categoriesByTemplateId.set(templateId, {
          ...linkedCategory,
          ...updated,
          tags: normalizeTags(template?.tags),
          tagIds: normalizeTagIds(template?.tagIds),
        })
      } else if (!linkedCategory?.isTemplateSynced) {
        const updated = await updateCategoryById(String(linkedCategory._id), {
          tagIds: hasCollision ? normalizeTagIds(linkedCategory?.tagIds) : normalizeTagIds(template?.tagIds),
          templateCategoryId: templateId,
          isTemplateSynced: true,
          clearLegacyTags: true,
        })

        categoriesByTemplateId.set(templateId, {
          ...linkedCategory,
          ...updated,
          tags: hasCollision ? normalizeTags(linkedCategory?.tags) : normalizeTags(template?.tags),
          tagIds: hasCollision ? normalizeTagIds(linkedCategory?.tagIds) : normalizeTagIds(template?.tagIds),
        })
      }

      continue
    }

    if (desiredIdentityKey && categoryIdentityKeys.has(desiredIdentityKey)) {
      continue
    }

    await createCategory({
      clientId: safeClientId,
      name: String(template?.name || "").trim(),
      type: String(template?.type || "").trim(),
      description: normalizeOptionalText(template?.description),
      tagIds: normalizeTagIds(template?.tagIds),
      templateCategoryId: templateId,
      isTemplateSynced: true,
    })

    if (desiredIdentityKey) {
      categoryIdentityKeys.add(desiredIdentityKey)
    }
  }

  for (const category of Array.isArray(categories) ? categories : []) {
    const templateId = String(category?.templateCategoryId || "").trim()
    if (!templateId || !category?.isTemplateSynced) continue
    if (desiredTemplateIds.has(templateId)) continue

    const linkedTransactionsCount = await countTransactionsByCategoryId(String(category._id))

    if (linkedTransactionsCount > 0) {
      await updateCategoryById(String(category._id), {
        tagIds: [],
        isTemplateSynced: false,
        clearLegacyTags: true,
      })
      continue
    }

    await deleteCategoryById(String(category._id))
  }
}

export async function syncOfficeClientsByTagsService(officeId) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) throw new Error("officeId is required")

  const clients = await listAllClientsByOfficeId(safeOfficeId)

  for (const client of Array.isArray(clients) ? clients : []) {
    const clientId = String(client?._id || "").trim()
    if (!clientId) continue

    await syncClientCategoriesByTagsService({
      officeId: safeOfficeId,
      clientId,
    })
  }
}
