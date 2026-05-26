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
import { isValidAccountType } from "../config/accountTypes.js"

export async function createAccountService(input) {
  if (!input?.name) throw new AppError("name is required", 400)
  if (!input?.accountType) throw new AppError("accountType is required", 400)
  if (!isValidAccountType(input.accountType)) {
    throw new AppError("Invalid accountType", 400)
  }
  if (!input?.clientId) throw new AppError("clientId is required", 400)

  return createAccount({
    name: String(input.name).trim(),
    accountType: String(input.accountType).trim(),
    description: typeof input.description === "string" ? input.description.trim() : "",
    isActive: input.isActive !== false,
    clientId: input.clientId,
  })
}

export async function updateAccountByIdService(id, patch) {
  if (!id) throw new AppError("id is required", 400)
  if (!patch || typeof patch !== "object") throw new AppError("patch is required", 400)

  const safePatch = {}

  if (typeof patch.name === "string") {
    const name = patch.name.trim()
    if (!name) throw new AppError("name cannot be empty", 400)
    safePatch.name = name
  }

  if (typeof patch.accountType === "string") {
    const accountType = patch.accountType.trim()
    if (!isValidAccountType(accountType)) {
      throw new AppError("Invalid accountType", 400)
    }
    safePatch.accountType = accountType
  }

  if (typeof patch.description === "string") {
    safePatch.description = patch.description.trim()
  }

  if (typeof patch.isActive === "boolean") {
    safePatch.isActive = patch.isActive
  }

  if (typeof patch.clientId === "string") {
    const clientId = patch.clientId.trim()
    if (!clientId) throw new AppError("clientId cannot be empty", 400)
    safePatch.clientId = clientId
  }

  if (Object.keys(safePatch).length === 0) {
    throw new AppError("no valid fields to update", 400)
  }

  return updateAccountById(id, safePatch)
}

export async function listAccountsByClientIdService(clientId, options = {}) {
  if (!clientId) throw new AppError("clientId is required", 400)
  return listAccountsByClientId(clientId, options)
}

export async function getAccountByIdService(id) {
  if (!id) throw new AppError("id is required", 400)
  return getAccountById(id)
}

export async function deleteAccountByIdService(id) {
  if (!id) throw new AppError("id is required", 400)

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
    throw new AppError("ids must be a non-empty array", 400)
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
  if (!clientId) throw new AppError("clientId is required", 400)
  return deleteAccountsByClientId(clientId)
}
