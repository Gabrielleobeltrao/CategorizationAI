import { ObjectId } from "mongodb"
import {
  createClient,
  updateClientById,
  listClientsByOfficeId,
  getClientById,
  deleteClientById,
  buildOwnerSearch,
  addClientNote,
  updateClientNote,
  deleteClientNote,
} from "../repositories/clients.repository.js"
import { AppError } from "../utils/appError.js"
import { hasPermissionFromListService, isClientScopeRestricted } from "./roles.service.js"
import { recordActivity } from "../repositories/activityLog.repository.js"
import { listAccountsByClientIdService } from "./account.service.js"
import { listCategoriesByClientIdService } from "./category.service.js"
import {
  listTransactionsPaginatedService,
  listTransactionPeriodOptionsService,
} from "./transactions.service.js"
import { deleteAccountsByClientIdService } from "./account.service.js"
import { deleteCategoriesByClientIdService } from "./category.service.js"
import { deleteTransactionsByClientId } from "../repositories/transactions.repository.js"
import { deleteTransactionMemoriesByClientId } from "../repositories/transactionMemory.repository.js"
import { deleteCategorizationJobsByClientId } from "../repositories/categorizationJob.repository.js"
import { deleteOperationalStatusByClientId } from "../repositories/clientOperationalStatus.repository.js"

const LEDGER_BOOTSTRAP_OPTIONAL_TIMEOUT_MS = Math.max(
  0,
  Number(process.env.LEDGER_BOOTSTRAP_OPTIONAL_TIMEOUT_MS || 1200)
)

function withOptionalTimeout(promise, timeoutMs = LEDGER_BOOTSTRAP_OPTIONAL_TIMEOUT_MS) {
  if (!timeoutMs || timeoutMs <= 0) return promise

  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), timeoutMs)
    }),
  ])
}

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

  const client = await createClient({
    officeId: input.officeId,
    name: input.name.trim(),
    businessType: input.businessType.trim(),
    description: input.description.trim(),
    mainActivity: input.mainActivity.trim(),
    state: input.state.trim(),
    address: normalizeOptionalText(input.address),
    owners: normalizeOwners(input.owners),
    ownerEmail: normalizeOptionalText(input.ownerEmail),
    ownerPhone: normalizeOptionalText(input.ownerPhone),
    createdBy: String(context?.actorProfileId || ""),
  })

  recordActivity({
    officeId: client.officeId,
    actorId: context?.actorProfileId,
    actorName: context?.actorName,
    action: "client.created",
    targetType: "client",
    targetId: client._id,
    clientId: client._id,
    label: String(client.name || "Client"),
  })

  return client
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

  if (patch.address !== undefined) {
    safePatch.address = normalizeOptionalText(patch.address)
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

  return updatedClient
}

export async function listClientsByOfficeIdService(officeId, query = {}, options = {}) {
  if (!officeId) throw new Error("officeId is required")

  const rawPage = Number(query.page ?? 1)
  const rawLimit = Number(query.limit ?? 10)
  const search = String(query.search ?? "").trim().slice(0, 100)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
  const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 10
  const limit = Math.min(safeLimit, 100)

  const result = await listClientsByOfficeId(officeId, { page, limit, search })
  let items = Array.isArray(result?.items) ? result.items : []

  // Restrict to the actor's assigned client whitelist when applicable. We
  // filter in-memory so existing pagination logic (search index, offsets)
  // stays untouched — the trade-off is the returned page may be shorter than
  // the requested limit when most matches aren't assigned to the user.
  const actorProfile = options?.actorProfile
  if (actorProfile && isClientScopeRestricted(actorProfile)) {
    const assigned = new Set(
      (Array.isArray(actorProfile.assignedClientIds) ? actorProfile.assignedClientIds : [])
        .map((id) => String(id)),
    )
    items = (items || []).filter((doc) => assigned.has(String(doc?._id)))
  }

  return {
    ...result,
    items,
  }
}

export async function getClientByIdService(id) {
  if (!id) throw new Error("id is required")

  const client = await getClientById(id)
  if (!client) return null

  return client
}

export async function getClientLedgerBootstrapService(clientId, query = {}) {
  if (!clientId) throw new Error("clientId is required")

  const [client, accounts, categories, transactions] = await Promise.all([
    getClientByIdService(clientId),
    listAccountsByClientIdService(clientId),
    listCategoriesByClientIdService(clientId),
    listTransactionsPaginatedService({
      ...query,
      clientId,
    }),
  ])

  if (!client) throw new Error("Client not found")

  const [periodOptionsResult] = await Promise.allSettled([
    withOptionalTimeout(listTransactionPeriodOptionsService({ clientId })),
  ])

  const periodOptions = periodOptionsResult.status === "fulfilled" ? periodOptionsResult.value : null

  return {
    client,
    accounts,
    categories,
    transactions,
    ...(periodOptions ? { periodOptions } : {}),
  }
}

export async function deleteClientByIdService(id, context = {}) {
  if (!id) throw new Error("id is required")

  const existing = await getClientById(id)

  await Promise.all([
    deleteTransactionsByClientId(id),
    deleteAccountsByClientIdService(id),
    deleteCategoriesByClientIdService(id),
    deleteTransactionMemoriesByClientId(id),
    deleteCategorizationJobsByClientId(id),
    deleteOperationalStatusByClientId(id),
  ])

  const result = await deleteClientById(id)

  if (existing) {
    recordActivity({
      officeId: existing.officeId,
      actorId: context?.actorProfileId,
      actorName: context?.actorName,
      action: "client.deleted",
      targetType: "client",
      targetId: id,
      clientId: id,
      label: String(existing.name || "Client"),
    })
  }

  return result
}

// ── Notes ───────────────────────────────────────────────────────────────────
// Free-form client log entries embedded on the client doc as `notes`. Authors
// can always edit/delete their own notes; touching someone else's requires
// the clients:update permission.

const MAX_NOTE_LENGTH = 4000

function findClientNote(client, noteId) {
  const notes = Array.isArray(client?.notes) ? client.notes : []
  return notes.find((note) => String(note?.id || "") === String(noteId)) || null
}

function ensureNoteActionAllowed({ note, context, permissionKey }) {
  const actorId = String(context?.actorProfileId || "").trim()
  const authorId = String(note?.authorId || "").trim()
  if (actorId && authorId && actorId === authorId) return
  const permissions = Array.isArray(context?.actorPermissions) ? context.actorPermissions : []
  if (hasPermissionFromListService(permissions, permissionKey)) return
  throw new AppError("Forbidden", 403)
}

export async function addClientNoteService(clientId, input, context = {}) {
  if (!clientId) throw new Error("clientId is required")
  const body = String(input?.body || "").trim()
  if (!body) throw new Error("note body is required")
  if (body.length > MAX_NOTE_LENGTH) {
    throw new Error(`note body must be ${MAX_NOTE_LENGTH} characters or fewer`)
  }

  const existing = await getClientById(clientId)
  if (!existing) throw new AppError("Client not found", 404)

  const now = new Date()
  const note = {
    id: new ObjectId().toString(),
    body,
    authorId: String(context?.actorProfileId || "").trim(),
    authorName: String(context?.actorName || "").trim(),
    createdAt: now,
    updatedAt: null,
  }

  const result = await addClientNote(clientId, note)

  recordActivity({
    officeId: existing.officeId,
    actorId: context?.actorProfileId,
    actorName: context?.actorName,
    action: "client.note.added",
    targetType: "client",
    targetId: clientId,
    clientId,
    label: String(existing.name || "Client"),
  })

  return result
}

export async function updateClientNoteService(clientId, noteId, input, context = {}) {
  if (!clientId) throw new Error("clientId is required")
  if (!noteId) throw new Error("noteId is required")
  const body = String(input?.body || "").trim()
  if (!body) throw new Error("note body is required")
  if (body.length > MAX_NOTE_LENGTH) {
    throw new Error(`note body must be ${MAX_NOTE_LENGTH} characters or fewer`)
  }

  const existing = await getClientById(clientId)
  if (!existing) throw new AppError("Client not found", 404)

  const note = findClientNote(existing, noteId)
  if (!note) throw new AppError("Note not found", 404)
  ensureNoteActionAllowed({ note, context, permissionKey: "clientsNotes:update" })

  const result = await updateClientNote(clientId, noteId, { body })

  recordActivity({
    officeId: existing.officeId,
    actorId: context?.actorProfileId,
    actorName: context?.actorName,
    action: "client.note.updated",
    targetType: "client",
    targetId: clientId,
    clientId,
    label: String(existing.name || "Client"),
  })

  return result
}

export async function deleteClientNoteService(clientId, noteId, context = {}) {
  if (!clientId) throw new Error("clientId is required")
  if (!noteId) throw new Error("noteId is required")

  const existing = await getClientById(clientId)
  if (!existing) throw new AppError("Client not found", 404)

  const note = findClientNote(existing, noteId)
  if (!note) throw new AppError("Note not found", 404)
  ensureNoteActionAllowed({ note, context, permissionKey: "clientsNotes:delete" })

  const result = await deleteClientNote(clientId, noteId)

  recordActivity({
    officeId: existing.officeId,
    actorId: context?.actorProfileId,
    actorName: context?.actorName,
    action: "client.note.deleted",
    targetType: "client",
    targetId: clientId,
    clientId,
    label: String(existing.name || "Client"),
  })

  return result
}
