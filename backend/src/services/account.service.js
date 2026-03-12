import {
  createAccount,
  updateAccountById,
  listAccountsByClientId,
  getAccountById,
} from "../repositories/account.repository.js"

export async function createAccountService(input) {
  if (!input?.name) throw new Error("name is required")
  if (!input?.type) throw new Error("type is required")
  if (!input?.clientId) throw new Error("clientId is required")

  return createAccount({
    name: input.name.trim(),
    type: input.type.trim(),
    clientId: input.clientId,
  })
}

export async function updateAccountByIdService(id, patch) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const safePatch = {}

  if (typeof patch.name === "string") {
    const name = patch.name.trim()
    if (!name) throw new Error("name cannot be empty")
    safePatch.name = name
  }

  if (typeof patch.type === "string") {
    const type = patch.type.trim()
    if (!type) throw new Error("type cannot be empty")
    safePatch.type = type
  }

  if (typeof patch.clientId === "string") {
    const clientId = patch.clientId.trim()
    if (!clientId) throw new Error("clientId cannot be empty")
    safePatch.clientId = clientId
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateAccountById(id, safePatch)
}

export async function listAccountsByClientIdService(clientId) {
  if (!clientId) throw new Error("clientId is required")
  return listAccountsByClientId(clientId)
}

export async function getAccountByIdService(id) {
  if (!id) throw new Error("id is required")
  return getAccountById(id)
}
