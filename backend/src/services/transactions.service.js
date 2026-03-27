import {
  insertTransactionsInBatches,
  updateTransactionById,
  getTransactionById,
  listTransactionsPaginated,
  listTransactionPeriodOptions,
  deleteTransactionById,
} from "../repositories/transactions.repository.js"
import { ObjectId } from "mongodb"

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

  const currentTransaction = await getTransactionById(id)
  if (!currentTransaction) throw new Error("transaction not found")

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

  if (patch.splits !== undefined) {
    if (!Array.isArray(patch.splits)) {
      throw new Error("splits must be an array")
    }

    if (patch.splits.length < 2) {
      throw new Error("splits must have at least 2 items")
    }

    const normalizedSplits = patch.splits.map((split, index) => {
      const amount = Number(split?.amount)
      if (!Number.isFinite(amount)) {
        throw new Error(`splits[${index}].amount must be a number`)
      }

      const categoryId = split?.categoryId ?? null
      if (categoryId !== null && categoryId !== "" && !ObjectId.isValid(String(categoryId))) {
        throw new Error(`splits[${index}].categoryId is invalid`)
      }

      const category = split?.category == null ? null : String(split.category).trim()

      return {
        categoryId: categoryId ? String(categoryId) : null,
        category: category || null,
        amount: Number(amount.toFixed(2)),
      }
    })

    const parentAmount = Number(
      typeof safePatch.amount === "number" ? safePatch.amount : currentTransaction.amount
    )
    const splitTotal = normalizedSplits.reduce((sum, split) => sum + Number(split.amount || 0), 0)

    if (Math.abs(Number(splitTotal.toFixed(2)) - Number(parentAmount.toFixed(2))) > 0.01) {
      throw new Error("sum of split amounts must match transaction amount")
    }

    safePatch.splits = normalizedSplits
    safePatch.isSplit = true
    safePatch.categoryId = null
    safePatch.category = null
  }

  const isCurrentSplit =
    Boolean(currentTransaction?.isSplit) ||
    (Array.isArray(currentTransaction?.splits) && currentTransaction.splits.length > 1)
  const isTryingToChangeParentCategory =
    safePatch.category !== undefined || safePatch.categoryId !== undefined

  if (isCurrentSplit && patch.splits === undefined && isTryingToChangeParentCategory) {
    throw new Error("cannot update parent category for split transaction")
  }

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
  const splitMode = String(query?.splitMode || "all").trim().toLowerCase()
  const years = parseCsv(query?.years)
  const months = parseCsv(query?.months)
  const fromDate = String(query?.fromDate || "").trim()
  const toDate = String(query?.toDate || "").trim()
  const minAmountRaw = String(query?.minAmount ?? "").trim()
  const maxAmountRaw = String(query?.maxAmount ?? "").trim()
  const minAmount = minAmountRaw === "" ? null : Number(minAmountRaw)
  const maxAmount = maxAmountRaw === "" ? null : Number(maxAmountRaw)

  if (!clientId) throw new Error("clientId is required")
  if (!["all", "split", "regular"].includes(splitMode)) {
    throw new Error("splitMode must be one of: all, split, regular")
  }
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
    splitMode,
    years,
    months,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
  })
}

export async function listTransactionPeriodOptionsService(query) {
  const clientId = String(query?.clientId || "").trim()
  if (!clientId) throw new Error("clientId is required")
  return listTransactionPeriodOptions(clientId)
}

export async function deleteTransactionByIdService(id) {
  if (!id) throw new Error("id is required")
  return deleteTransactionById(id)
}
