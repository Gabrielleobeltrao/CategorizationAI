import {
  insertTransactionsInBatches,
  updateTransactionById,
  listTransactionsPaginated,
  deleteTransactionById,
} from "../repositories/transactions.repository.js"

export async function createTransactionsBatchService(transactions) {
  if (!Array.isArray(transactions)) {
    throw new Error("transactions must be an array")
  }

  if (transactions.length === 0) {
    throw new Error("transactions cannot be empty")
  }

  return insertTransactionsInBatches(transactions)
}

export async function updateTransactionByIdService(id, patch) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const safePatch = {}

  if (typeof patch.accountName === "string") {
    const accountName = patch.accountName.trim()
    if (!accountName) throw new Error("accountName cannot be empty")
    safePatch.accountName = accountName
  }
  if (patch.accountId !== undefined) safePatch.accountId = patch.accountId

  if (typeof patch.date === "string") safePatch.date = patch.date
  if (typeof patch.description === "string") safePatch.description = patch.description.trim()
  if (typeof patch.amount === "number") safePatch.amount = patch.amount
  if (patch.categoryId !== undefined) safePatch.categoryId = patch.categoryId
  if (patch.category !== undefined) safePatch.category = patch.category

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateTransactionById(id, safePatch)
}

export async function listTransactionsPaginatedService(query) {
  const parseCsv = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

  const clientId = query?.clientId
  const page = query?.page
  const limit = query?.limit
  const search = String(query?.search || "").trim().slice(0, 100)
  const accountIds = parseCsv(query?.accountIds)
  const categoryIds = parseCsv(query?.categoryIds)
  const includeUncategorized = String(query?.includeUncategorized || "").toLowerCase() === "true"
  const fromDate = String(query?.fromDate || "").trim()
  const toDate = String(query?.toDate || "").trim()
  const minAmountRaw = String(query?.minAmount ?? "").trim()
  const maxAmountRaw = String(query?.maxAmount ?? "").trim()
  const minAmount = minAmountRaw === "" ? null : Number(minAmountRaw)
  const maxAmount = maxAmountRaw === "" ? null : Number(maxAmountRaw)

  if (!clientId) throw new Error("clientId is required")
  if (minAmountRaw !== "" && Number.isNaN(minAmount)) throw new Error("minAmount must be a number")
  if (maxAmountRaw !== "" && Number.isNaN(maxAmount)) throw new Error("maxAmount must be a number")

  return listTransactionsPaginated({
    clientId,
    page,
    limit,
    search,
    accountIds,
    categoryIds,
    includeUncategorized,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
  })
}

export async function deleteTransactionByIdService(id) {
  if (!id) throw new Error("id is required")
  return deleteTransactionById(id)
}
