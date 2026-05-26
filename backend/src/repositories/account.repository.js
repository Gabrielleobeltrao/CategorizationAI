import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

export async function ensureAccountIndexes() {
  const db = getDB()
  const collection = db.collection("coa_accounts")
  // Note: bookkeeping accounts live in `coa_accounts`. The `account`
  // collection is Better Auth's — never query it directly from this
  // repo.

  await Promise.all([
    collection.createIndex({ clientId: 1, createdAt: -1 }),
    collection.createIndex({ clientId: 1, accountType: 1 }),
    collection.createIndex({ clientId: 1, isActive: 1 }),
  ])
}

export async function createAccount(input) {
  const db = getDB()

  const doc = {
    name: input.name,
    accountType: input.accountType,
    description: typeof input.description === "string" ? input.description : "",
    isActive: input.isActive !== false,
    clientId: input.clientId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await db.collection("coa_accounts").insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function updateAccountById(id, patch) {
  const db = getDB()

  const allowed = {
    name: patch.name,
    accountType: patch.accountType,
    description: patch.description,
    isActive: patch.isActive,
    clientId: patch.clientId,
    updatedAt: new Date(),
  }

  const $set = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined),
  )

  return db.collection("coa_accounts").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: "after" },
  )
}

// Post-migration both bank accounts AND P&L "categories" live in
// `coa_accounts`. Default to balance-sheet types only (assets, liabilities,
// equity) so legacy callers expecting the old `accounts` shape don't see
// categories. Pass `includeAllTypes: true` to get every account type
// (needed by AI categorization which sees the full chart).
export async function listAccountsByClientId(
  clientId,
  { accountType, includeInactive = false, includeAllTypes = false } = {},
) {
  const db = getDB()
  // The per-client "Uncategorized" suspense account is a system row
  // (auto-created on first bank import / first categorize call). Hide it
  // from the legacy accounts list. We match both the explicit flag and
  // the canonical name because migrated rows may not have the flag.
  const filter = {
    clientId,
    isSuspense: { $ne: true },
    name: { $ne: "Uncategorized" },
  }
  if (accountType) {
    filter.accountType = accountType
  } else if (!includeAllTypes) {
    const { BALANCE_SHEET_ACCOUNT_TYPES } = await import("../config/accountTypes.js")
    filter.accountType = { $in: BALANCE_SHEET_ACCOUNT_TYPES }
  }
  if (!includeInactive) filter.isActive = { $ne: false }
  return db.collection("coa_accounts").find(filter).sort({ accountType: 1, name: 1 }).toArray()
}

export async function getAccountById(id) {
  const db = getDB()
  return db.collection("coa_accounts").findOne({ _id: new ObjectId(id) })
}

export async function deleteAccountById(id) {
  const db = getDB()
  return db.collection("coa_accounts").deleteOne({ _id: new ObjectId(id) })
}

export async function deleteAccountsByIds(ids = []) {
  const db = getDB()
  const objectIds = Array.isArray(ids)
    ? ids
        .filter((id) => id && ObjectId.isValid(String(id)))
        .map((id) => new ObjectId(String(id)))
    : []

  if (objectIds.length === 0) {
    return { deletedCount: 0 }
  }

  return db.collection("coa_accounts").deleteMany({ _id: { $in: objectIds } })
}

export async function deleteAccountsByClientId(clientId) {
  const db = getDB()
  return db.collection("coa_accounts").deleteMany({ clientId })
}
