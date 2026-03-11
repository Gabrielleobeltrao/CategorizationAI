import {
  createClient,
  updateClientById,
  listClientsByOfficeId,
  getClientById,
} from "../repositories/clients.repository.js"

export async function createClientService(input) {
  if (!input?.officeId) throw new Error("officeId is required")
  if (!input?.name) throw new Error("name is required")

  return createClient({
    officeId: input.officeId,
    name: input.name.trim(),
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

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateClientById(id, safePatch)
}

export async function listClientsByOfficeIdService(officeId) {
  if (!officeId) throw new Error("officeId is required")
  return listClientsByOfficeId(officeId)
}

export async function getClientByIdService(id) {
  if (!id) throw new Error("id is required")
  return getClientById(id)
}
