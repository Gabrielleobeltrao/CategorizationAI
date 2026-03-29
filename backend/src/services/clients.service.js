import {
  createClient,
  updateClientById,
  listClientsByOfficeId,
  getClientById,
  deleteClientById,
} from "../repositories/clients.repository.js"

function normalizeOwners(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(
    value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )]
}

export async function createClientService(input) {
  if (!input?.officeId) throw new Error("officeId is required")
  if (!input?.name) throw new Error("name is required")
  if (!input?.businessType) throw new Error("businessType is required")
  if (!input?.description) throw new Error("description is required")
  if (!input?.mainActivity) throw new Error("mainActivity is required")
  if (!input?.state) throw new Error("state is required")
  if (input?.owners !== undefined && !Array.isArray(input.owners)) {
    throw new Error("owners must be an array")
  }

  return createClient({
    officeId: input.officeId,
    name: input.name.trim(),
    businessType: input.businessType.trim(),
    description: input.description.trim(),
    mainActivity: input.mainActivity.trim(),
    state: input.state.trim(),
    owners: normalizeOwners(input.owners),
  })
}

export async function updateClientByIdService(id, patch) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

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

  if (patch.owners !== undefined) {
    if (!Array.isArray(patch.owners)) {
      throw new Error("owners must be an array")
    }
    safePatch.owners = normalizeOwners(patch.owners)
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateClientById(id, safePatch)
}

export async function listClientsByOfficeIdService(officeId, query = {}) {
  if (!officeId) throw new Error("officeId is required")

  const rawPage = Number(query.page ?? 1)
  const rawLimit = Number(query.limit ?? 10)
  const search = String(query.search ?? "").trim().slice(0, 100)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
  const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 10
  const limit = Math.min(safeLimit, 100)

  return listClientsByOfficeId(officeId, { page, limit, search })
}

export async function getClientByIdService(id) {
  if (!id) throw new Error("id is required")
  return getClientById(id)
}

export async function deleteClientByIdService(id) {
  if (!id) throw new Error("id is required")
  return deleteClientById(id)
}
