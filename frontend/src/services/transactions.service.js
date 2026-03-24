import { api } from "../lib/api"

export async function listTransactionsByClientId(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  const page = Number(options.page || 1)
  const limit = Number(options.limit || 200)
  const search = String(options.search || "").trim()
  const silentLoading = Boolean(options.silentLoading)
  const accountIds = Array.isArray(options.accountIds) ? options.accountIds : []
  const categoryIds = Array.isArray(options.categoryIds) ? options.categoryIds : []
  const includeUncategorized = Boolean(options.includeUncategorized)
  const fromDate = String(options.fromDate || "").trim()
  const toDate = String(options.toDate || "").trim()
  const minAmount = options.minAmount !== undefined ? String(options.minAmount).trim() : ""
  const maxAmount = options.maxAmount !== undefined ? String(options.maxAmount).trim() : ""

  const params = new URLSearchParams({
    clientId: cleanClientId,
    page: String(page),
    limit: String(limit),
  })

  if (search) {
    params.set("search", search)
  }
  if (accountIds.length > 0) {
    params.set("accountIds", accountIds.join(","))
  }
  if (categoryIds.length > 0) {
    params.set("categoryIds", categoryIds.join(","))
  }
  if (includeUncategorized) {
    params.set("includeUncategorized", "true")
  }
  if (fromDate) {
    params.set("fromDate", fromDate)
  }
  if (toDate) {
    params.set("toDate", toDate)
  }
  if (minAmount !== "") {
    params.set("minAmount", minAmount)
  }
  if (maxAmount !== "") {
    params.set("maxAmount", maxAmount)
  }

  return api(`/api/transactions?${params.toString()}`, { silentLoading })
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
