import { api } from "../lib/api"

export async function listAccountsByClientId(clientId, { includeAllTypes = false } = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")
  const qs = includeAllTypes ? "?includeAllTypes=true" : ""
  return api(`/api/clients/${cleanClientId}/accounts${qs}`)
}

export async function createAccount(input) {
  const clientId = String(input?.clientId || "").trim()
  const name = String(input?.name || "").trim()
  const accountType = String(input?.accountType || "").trim()
  const description = String(input?.description || "").trim()

  if (!clientId) throw new Error("clientId is required")
  if (!name) throw new Error("name is required")
  if (!accountType) throw new Error("accountType is required")

  return api("/api/accounts", {
    method: "POST",
    body: JSON.stringify({ clientId, name, accountType, description }),
  })
}

export async function updateAccountById(accountId, patch) {
  const id = String(accountId || "").trim()
  if (!id) throw new Error("accountId is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  return api(`/api/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function deleteAccountById(accountId) {
  const id = String(accountId || "").trim()
  if (!id) throw new Error("accountId is required")

  return api(`/api/accounts/${id}`, {
    method: "DELETE",
  })
}

export async function deleteAccountsByIds(ids = []) {
  const targetIds = Array.isArray(ids) ? ids.map((id) => String(id || "").trim()).filter(Boolean) : []
  if (targetIds.length === 0) {
    throw new Error("ids must be a non-empty array")
  }

  return api("/api/accounts/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids: targetIds }),
  })
}
