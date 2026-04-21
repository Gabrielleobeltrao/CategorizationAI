import {
  createCategory,
  updateCategoryById,
  listCategoriesByClientId,
  getCategoryById,
  deleteCategoryById,
  deleteCategoriesByIds,
  deleteCategoriesByClientId,
} from "../repositories/category.repository.js"
import { getClientById } from "../repositories/clients.repository.js"
import {
  countTransactionsByCategoryId,
  listUsedCategoryIdsByClientId,
} from "../repositories/transactions.repository.js"
import { normalizeCategoryType } from "../config/categoryTypes.js"
import { AppError } from "../utils/appError.js"
import { getCategoryIdentityKey } from "../utils/categoryIdentity.js"
import {
  hydrateOfficeTagsForDocumentService,
  hydrateOfficeTagsForDocumentsService,
  resolveOfficeTagRefsService,
} from "./tagCatalog.service.js"

async function assertCategoryIsUnique({ clientId, name, type, excludeId = "" }) {
  const safeClientId = String(clientId || "").trim()
  const nextKey = getCategoryIdentityKey(name, type)

  if (!safeClientId || !nextKey) return

  const categories = await listCategoriesByClientId(safeClientId)
  const hasDuplicate = (Array.isArray(categories) ? categories : []).some((category) => (
    String(category?._id || "") !== String(excludeId || "") &&
    getCategoryIdentityKey(category?.name, category?.type) === nextKey
  ))

  if (hasDuplicate) {
    throw new Error("category already exists for this client")
  }
}

export async function createCategoryService(input, context = {}) {
  if (!input?.name) throw new Error("name is required")
  if (!input?.type) throw new Error("type is required")
  if (!input?.description) throw new Error("description is required")
  if (!input?.clientId) throw new Error("clientId is required")

  const client = await getClientById(input.clientId)
  if (!client) throw new Error("Client not found")

  const type = normalizeCategoryType(input.type)
  if (!type) throw new Error("type is invalid")
  const name = input.name.trim()
  const description = input.description.trim()

  await assertCategoryIsUnique({
    clientId: input.clientId,
    name,
    type,
  })

  const resolvedTags = await resolveOfficeTagRefsService(client.officeId, input.tags, context)

  const category = await createCategory({
    name,
    type,
    description,
    clientId: input.clientId,
    tagIds: resolvedTags.tagIds,
  })

  return hydrateOfficeTagsForDocumentService(client.officeId, category)
}

export async function updateCategoryByIdService(id, patch, context = {}) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const current = await getCategoryById(id)
  if (!current) throw new Error("Category not found")

  const currentClient = await getClientById(current.clientId)
  if (!currentClient) throw new Error("Client not found")

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

  let nextClient = currentClient

  if (typeof patch.clientId === "string") {
    const clientId = patch.clientId.trim()
    if (!clientId) throw new Error("clientId cannot be empty")

    const targetClient = await getClientById(clientId)
    if (!targetClient) throw new Error("Client not found")

    safePatch.clientId = clientId
    nextClient = targetClient
  }

  if (patch.tags !== undefined) {
    const resolvedTags = await resolveOfficeTagRefsService(nextClient.officeId, patch.tags, context)
    safePatch.tagIds = resolvedTags.tagIds
    safePatch.clearLegacyTags = true
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  const nextClientId = String(safePatch.clientId ?? current.clientId ?? "").trim()
  const nextName = String(safePatch.name ?? current.name ?? "").trim()
  const nextType = normalizeCategoryType(safePatch.type ?? current.type)

  await assertCategoryIsUnique({
    clientId: nextClientId,
    name: nextName,
    type: nextType,
    excludeId: id,
  })

  const updated = await updateCategoryById(id, safePatch)
  return hydrateOfficeTagsForDocumentService(nextClient.officeId, updated)
}

export async function listCategoriesByClientIdService(clientId) {
  if (!clientId) throw new Error("clientId is required")

  const client = await getClientById(clientId)
  if (!client) throw new Error("Client not found")

  const categories = await listCategoriesByClientId(clientId)
  return hydrateOfficeTagsForDocumentsService(client.officeId, categories)
}

export async function getCategoryByIdService(id) {
  if (!id) throw new Error("id is required")

  const category = await getCategoryById(id)
  if (!category) return null

  const client = await getClientById(category.clientId)
  if (!client) return category

  return hydrateOfficeTagsForDocumentService(client.officeId, category)
}

export async function deleteCategoryByIdService(id) {
  if (!id) throw new Error("id is required")

  const linkedTransactionsCount = await countTransactionsByCategoryId(id)
  if (linkedTransactionsCount > 0) {
    throw new AppError("Cannot delete category with linked transactions", 409, {
      linkedTransactionsCount,
    })
  }

  return deleteCategoryById(id)
}

export async function clearUnusedCategoriesByClientIdService(clientId) {
  if (!clientId) throw new Error("clientId is required")

  const client = await getClientById(clientId)
  if (!client) throw new Error("Client not found")

  const [categories, usedCategoryIds] = await Promise.all([
    listCategoriesByClientId(clientId),
    listUsedCategoryIdsByClientId(clientId),
  ])

  const usedIdsSet = new Set(usedCategoryIds)
  const unusedCategories = (Array.isArray(categories) ? categories : []).filter(
    (category) => !usedIdsSet.has(String(category?._id || ""))
  )

  const unusedIds = unusedCategories.map((category) => String(category?._id || "")).filter(Boolean)
  const unusedNames = unusedCategories.map((category) => String(category?.name || "").trim()).filter(Boolean)

  if (unusedIds.length === 0) {
    return {
      deletedCount: 0,
      deletedIds: [],
      deletedNames: [],
      keptCount: Array.isArray(categories) ? categories.length : 0,
    }
  }

  const result = await deleteCategoriesByIds(unusedIds)

  return {
    deletedCount: Number(result?.deletedCount || 0),
    deletedIds: unusedIds,
    deletedNames: unusedNames,
    keptCount: Math.max(0, (Array.isArray(categories) ? categories.length : 0) - unusedIds.length),
  }
}

export async function deleteCategoriesByClientIdService(clientId) {
  if (!clientId) throw new Error("clientId is required")
  return deleteCategoriesByClientId(clientId)
}
