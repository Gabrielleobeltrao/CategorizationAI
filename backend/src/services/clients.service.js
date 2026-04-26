import {
  createClient,
  updateClientById,
  listClientsByOfficeId,
  getClientById,
  deleteClientById,
  buildOwnerSearch,
} from "../repositories/clients.repository.js"
import { listAccountsByClientIdService } from "./account.service.js"
import { listCategoriesByClientIdService } from "./category.service.js"
import {
  listTransactionsPaginatedService,
  listTransactionPeriodOptionsService,
  summarizeTransactionsService,
} from "./transactions.service.js"
import { deleteAccountsByClientIdService } from "./account.service.js"
import { deleteCategoriesByClientIdService } from "./category.service.js"
import { deleteTransactionsByClientId } from "../repositories/transactions.repository.js"
import { deleteTransactionMemoriesByClientId } from "../repositories/transactionMemory.repository.js"
import { deleteCategorizationJobsByClientId } from "../repositories/categorizationJob.repository.js"
import {
  hydrateOfficeTagsForDocumentService,
  hydrateOfficeTagsForDocumentsService,
  resolveOfficeTagRefsService,
} from "./tagCatalog.service.js"
import { enqueueClientCategorySync } from "../workers/categorySync.worker.js"

function normalizeOwners(value) {
  if (!Array.isArray(value)) return []

  const normalized = []
  const dedupe = new Set()

  for (const item of value) {
    let name = ""
    let email = ""
    let phone = ""

    if (typeof item === "string") {
      name = item.trim()
    } else if (item && typeof item === "object") {
      name = String(item.name || "").trim()
      email = String(item.email || "").trim()
      phone = String(item.phone || "").trim()
    } else {
      continue
    }

    if (!name && !email && !phone) continue

    const dedupeKey = `${name.toLowerCase()}|${email.toLowerCase()}|${phone.toLowerCase()}`
    if (dedupe.has(dedupeKey)) continue
    dedupe.add(dedupeKey)

    normalized.push({
      name,
      email,
      phone,
    })
  }

  return normalized
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return ""
  return String(value).trim()
}

export async function createClientService(input, context = {}) {
  if (!input?.officeId) throw new Error("officeId is required")
  if (!input?.name) throw new Error("name is required")
  if (!input?.businessType) throw new Error("businessType is required")
  if (!input?.description) throw new Error("description is required")
  if (!input?.mainActivity) throw new Error("mainActivity is required")
  if (!input?.state) throw new Error("state is required")
  if (input?.owners !== undefined && !Array.isArray(input.owners)) {
    throw new Error("owners must be an array")
  }

  const resolvedTags = await resolveOfficeTagRefsService(input.officeId, input.tags, context)

  const client = await createClient({
    officeId: input.officeId,
    name: input.name.trim(),
    businessType: input.businessType.trim(),
    description: input.description.trim(),
    mainActivity: input.mainActivity.trim(),
    state: input.state.trim(),
    tagIds: resolvedTags.tagIds,
    owners: normalizeOwners(input.owners),
    ownerEmail: normalizeOptionalText(input.ownerEmail),
    ownerPhone: normalizeOptionalText(input.ownerPhone),
  })

  enqueueClientCategorySync({
    officeId: client.officeId,
    clientId: String(client._id),
  })

  return hydrateOfficeTagsForDocumentService(client.officeId, client)
}

export async function updateClientByIdService(id, patch, context = {}) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const current = await getClientById(id)
  if (!current) throw new Error("Client not found")

  const safePatch = {}

  if (typeof patch.name === "string") {
    const name = patch.name.trim()
    if (!name) throw new Error("name cannot be empty")
    safePatch.name = name
  }

  if (typeof patch.businessType === "string") {
    const businessType = patch.businessType.trim()
    if (!businessType) throw new Error("businessType cannot be empty")
    safePatch.businessType = businessType
  }

  if (typeof patch.description === "string") {
    const description = patch.description.trim()
    if (!description) throw new Error("description cannot be empty")
    safePatch.description = description
  }

  if (typeof patch.mainActivity === "string") {
    const mainActivity = patch.mainActivity.trim()
    if (!mainActivity) throw new Error("mainActivity cannot be empty")
    safePatch.mainActivity = mainActivity
  }

  if (typeof patch.state === "string") {
    const state = patch.state.trim()
    if (!state) throw new Error("state cannot be empty")
    safePatch.state = state
  }

  if (patch.tags !== undefined) {
    const resolvedTags = await resolveOfficeTagRefsService(current.officeId, patch.tags, context)
    safePatch.tagIds = resolvedTags.tagIds
    safePatch.clearLegacyTags = true
  }

  if (patch.owners !== undefined) {
    if (!Array.isArray(patch.owners)) {
      throw new Error("owners must be an array")
    }
    safePatch.owners = normalizeOwners(patch.owners)
  }

  if (patch.ownerEmail !== undefined) {
    safePatch.ownerEmail = normalizeOptionalText(patch.ownerEmail)
  }

  if (patch.ownerPhone !== undefined) {
    safePatch.ownerPhone = normalizeOptionalText(patch.ownerPhone)
  }

  if (
    safePatch.owners !== undefined ||
    safePatch.ownerEmail !== undefined ||
    safePatch.ownerPhone !== undefined
  ) {
    safePatch.ownerSearch = buildOwnerSearch(
      safePatch.owners !== undefined ? safePatch.owners : current.owners,
      safePatch.ownerEmail !== undefined ? safePatch.ownerEmail : current.ownerEmail,
      safePatch.ownerPhone !== undefined ? safePatch.ownerPhone : current.ownerPhone
    )
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  const updatedClient = await updateClientById(id, safePatch)

  if (safePatch.tagIds !== undefined) {
    enqueueClientCategorySync({
      officeId: updatedClient?.officeId,
      clientId: String(updatedClient?._id || id),
    })
  }

  return hydrateOfficeTagsForDocumentService(current.officeId, updatedClient)
}

export async function listClientsByOfficeIdService(officeId, query = {}) {
  if (!officeId) throw new Error("officeId is required")

  const rawPage = Number(query.page ?? 1)
  const rawLimit = Number(query.limit ?? 10)
  const search = String(query.search ?? "").trim().slice(0, 100)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
  const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 10
  const limit = Math.min(safeLimit, 100)

  const result = await listClientsByOfficeId(officeId, { page, limit, search })
  const items = await hydrateOfficeTagsForDocumentsService(officeId, result?.items)

  return {
    ...result,
    items,
  }
}

export async function getClientByIdService(id) {
  if (!id) throw new Error("id is required")

  const client = await getClientById(id)
  if (!client) return null

  return hydrateOfficeTagsForDocumentService(client.officeId, client)
}

export async function getClientLedgerBootstrapService(clientId, query = {}) {
  if (!clientId) throw new Error("clientId is required")

  const [client, accounts, categories, transactions, periodOptions, summary] = await Promise.all([
    getClientByIdService(clientId),
    listAccountsByClientIdService(clientId),
    listCategoriesByClientIdService(clientId),
    listTransactionsPaginatedService({
      ...query,
      clientId,
    }),
    listTransactionPeriodOptionsService({ clientId }),
    summarizeTransactionsService({
      clientId,
      accountIds: query?.accountIds,
    }),
  ])

  if (!client) throw new Error("Client not found")

  return {
    client,
    accounts,
    categories,
    transactions,
    periodOptions,
    summary,
  }
}

export async function deleteClientByIdService(id) {
  if (!id) throw new Error("id is required")

  await Promise.all([
    deleteTransactionsByClientId(id),
    deleteAccountsByClientIdService(id),
    deleteCategoriesByClientIdService(id),
    deleteTransactionMemoriesByClientId(id),
    deleteCategorizationJobsByClientId(id),
  ])

  return deleteClientById(id)
}
