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
  const includeUncategorizedIncome = Boolean(options.includeUncategorizedIncome)
  const includeUncategorizedExpenses = Boolean(options.includeUncategorizedExpenses)
  const splitMode = String(options.splitMode || "all").trim().toLowerCase()
  const amountSign = String(options.amountSign || "all").trim().toLowerCase()
  const fromDate = String(options.fromDate || "").trim()
  const toDate = String(options.toDate || "").trim()
  const years = Array.isArray(options.years) ? options.years : []
  const months = Array.isArray(options.months) ? options.months : []
  const llmProcessed = String(options.llmProcessed || "all").trim().toLowerCase()
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
  if (includeUncategorizedIncome) {
    params.set("includeUncategorizedIncome", "true")
  }
  if (includeUncategorizedExpenses) {
    params.set("includeUncategorizedExpenses", "true")
  }
  if (splitMode && splitMode !== "all") {
    params.set("splitMode", splitMode)
  }
  if (amountSign !== "all") {
    params.set("amountSign", amountSign)
  }
  if (fromDate) {
    params.set("fromDate", fromDate)
  }
  if (toDate) {
    params.set("toDate", toDate)
  }
  if (years.length > 0) {
    params.set("years", years.join(","))
  }
  if (months.length > 0) {
    params.set("months", months.join(","))
  }
  if (llmProcessed !== "all") {
    params.set("llmProcessed", llmProcessed)
  }
  if (minAmount !== "") {
    params.set("minAmount", minAmount)
  }
  if (maxAmount !== "") {
    params.set("maxAmount", maxAmount)
  }

  return api(`/api/transactions?${params.toString()}`, { silentLoading })
}

export async function listTransactionPeriodOptions(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")
  const silentLoading = Boolean(options.silentLoading)

  const params = new URLSearchParams({
    clientId: cleanClientId,
  })

  return api(`/api/transactions/filter-options?${params.toString()}`, { silentLoading })
}

export async function summarizeTransactionsByClientId(clientId, options = {}) {
  const cleanClientId = String(clientId || "").trim()
  if (!cleanClientId) throw new Error("clientId is required")

  const silentLoading = Boolean(options.silentLoading)
  const search = String(options.search || "").trim()
  const accountIds = Array.isArray(options.accountIds) ? options.accountIds : []
  const categoryIds = Array.isArray(options.categoryIds) ? options.categoryIds : []
  const includeUncategorizedIncome = Boolean(options.includeUncategorizedIncome)
  const includeUncategorizedExpenses = Boolean(options.includeUncategorizedExpenses)
  const splitMode = String(options.splitMode || "all").trim().toLowerCase()
  const amountSign = String(options.amountSign || "all").trim().toLowerCase()
  const fromDate = String(options.fromDate || "").trim()
  const toDate = String(options.toDate || "").trim()
  const years = Array.isArray(options.years) ? options.years : []
  const months = Array.isArray(options.months) ? options.months : []
  const llmProcessed = String(options.llmProcessed || "all").trim().toLowerCase()
  const minAmount = options.minAmount !== undefined ? String(options.minAmount).trim() : ""
  const maxAmount = options.maxAmount !== undefined ? String(options.maxAmount).trim() : ""

  const params = new URLSearchParams({
    clientId: cleanClientId,
  })

  if (search) params.set("search", search)
  if (accountIds.length > 0) params.set("accountIds", accountIds.join(","))
  if (categoryIds.length > 0) params.set("categoryIds", categoryIds.join(","))
  if (includeUncategorizedIncome) params.set("includeUncategorizedIncome", "true")
  if (includeUncategorizedExpenses) params.set("includeUncategorizedExpenses", "true")
  if (splitMode !== "all") params.set("splitMode", splitMode)
  if (amountSign !== "all") params.set("amountSign", amountSign)
  if (fromDate) params.set("fromDate", fromDate)
  if (toDate) params.set("toDate", toDate)
  if (years.length > 0) params.set("years", years.join(","))
  if (months.length > 0) params.set("months", months.join(","))
  if (llmProcessed !== "all") params.set("llmProcessed", llmProcessed)
  if (minAmount !== "") params.set("minAmount", minAmount)
  if (maxAmount !== "") params.set("maxAmount", maxAmount)

  return api(`/api/transactions/summary?${params.toString()}`, { silentLoading })
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

export async function updateTransactionsByIds(updates = []) {
  const safeUpdates = Array.isArray(updates)
    ? updates
        .map((item) => ({
          id: String(item?.id || "").trim(),
          patch: item?.patch || {},
        }))
        .filter((item) => item.id)
    : []

  if (safeUpdates.length === 0) {
    throw new Error("updates must be a non-empty array")
  }

  return api("/api/transactions/batch-update", {
    method: "PATCH",
    body: JSON.stringify({ updates: safeUpdates }),
  })
}

export async function deleteTransactionById(transactionId) {
  const id = String(transactionId || "").trim()
  if (!id) throw new Error("transactionId is required")

  return api(`/api/transactions/${id}`, {
    method: "DELETE",
  })
}

export async function deleteTransactionsByIds(ids = []) {
  const targetIds = Array.isArray(ids) ? ids.map((id) => String(id || "").trim()).filter(Boolean) : []
  if (targetIds.length === 0) {
    throw new Error("ids must be a non-empty array")
  }

  return api("/api/transactions/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids: targetIds }),
  })
}

export async function createTransactionsBatch(transactions, options = {}) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error("transactions must be a non-empty array")
  }
  const silentLoading = options?.silentLoading !== undefined
    ? Boolean(options.silentLoading)
    : true

  return api("/api/transactions/batch", {
    method: "POST",
    body: JSON.stringify({ transactions }),
    silentLoading,
  })
}

export async function categorizeTransactionsWithLlm(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required")
  }

  return api("/api/transactions/categorize-llm", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function categorizeAllTransactionsWithLlm(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required")
  }

  return api("/api/transactions/categorize-all-llm", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function categorizeZelleTransactions(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required")
  }

  return api("/api/transactions/categorize-zelle", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
