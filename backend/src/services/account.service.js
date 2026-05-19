import {
  createAccount,
  updateAccountById,
  listAccountsByClientId,
  getAccountById,
  deleteAccountById,
  deleteAccountsByIds,
  deleteAccountsByClientId,
} from "../repositories/account.repository.js"
import {
  countTransactionsByAccountId,
  listLinkedAccountIds,
} from "../repositories/transactions.repository.js"
import { AppError } from "../utils/appError.js"
import { isValidBalanceSheetType } from "../config/balanceSheetTypes.js"

export async function createAccountService(input) {
  if (!input?.name) throw new Error("name is required")
  if (!input?.type) throw new Error("type is required")
  if (!input?.clientId) throw new Error("clientId is required")

  const balanceSheetType = String(input.balanceSheetType || "").trim()
  if (balanceSheetType && !isValidBalanceSheetType(balanceSheetType)) {
    throw new AppError("Invalid balanceSheetType", 400)
  }

  return createAccount({
    name: input.name.trim(),
    type: input.type.trim(),
    balanceSheetType,
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

  if (typeof patch.balanceSheetType === "string") {
    const balanceSheetType = patch.balanceSheetType.trim()
    if (balanceSheetType && !isValidBalanceSheetType(balanceSheetType)) {
      throw new AppError("Invalid balanceSheetType", 400)
    }
    safePatch.balanceSheetType = balanceSheetType
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

export async function deleteAccountByIdService(id) {
  if (!id) throw new Error("id is required")

  const linkedTransactionsCount = await countTransactionsByAccountId(id)
  if (linkedTransactionsCount > 0) {
    throw new AppError("Cannot delete account with linked transactions", 409, {
      linkedTransactionsCount,
    })
  }

  return deleteAccountById(id)
}

export async function deleteAccountsByIdsService(ids = []) {
  const safeIds = Array.isArray(ids)
    ? [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))]
    : []

  if (safeIds.length === 0) {
    throw new Error("ids must be a non-empty array")
  }

  const linkedAccountIds = await listLinkedAccountIds(safeIds)
  if (linkedAccountIds.length > 0) {
    throw new AppError("Cannot delete accounts with linked transactions", 409, {
      linkedAccountIds,
    })
  }

  const result = await deleteAccountsByIds(safeIds)
  return {
    requestedCount: safeIds.length,
    deletedCount: Number(result?.deletedCount || 0),
  }
}

export async function deleteAccountsByClientIdService(clientId) {
  if (!clientId) throw new Error("clientId is required")
  return deleteAccountsByClientId(clientId)
}
