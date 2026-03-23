import { api } from "../lib/api"

export async function listTransactionsByClientId(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  const page = Number(options.page || 1)
  const limit = Number(options.limit || 200)
  const search = String(options.search || "").trim()

  const params = new URLSearchParams({
    clientId: cleanClientId,
    page: String(page),
    limit: String(limit),
  })

  if (search) {
    params.set("search", search)
  }

  return api(`/api/transactions?${params.toString()}`)
}

export async function updateTransactionById(transactionId, patch) {
  const id = String(transactionId || "").trim()
  if (!id) throw new Error("transactionId is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  return api(`/api/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function deleteTransactionById(transactionId) {
  const id = String(transactionId || "").trim()
  if (!id) throw new Error("transactionId is required")

  return api(`/api/transactions/${id}`, {
    method: "DELETE",
  })
}
