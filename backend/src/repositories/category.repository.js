import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import { PNL_ACCOUNT_TYPES } from "../config/accountTypes.js"

// After the double-entry migration the `categories` collection is gone —
// what we called "categories" are just accounts with a P&L accountType
// (income / cost_of_goods_sold / operating_expense / other_income /
// other_expense / tax_expense). This repository keeps the old function
// names so callers don't have to change all at once, but every query
// targets the `account` collection. Output docs are adapted back to the
// legacy { type, ... } shape so consumers (services, controllers,
// reports during transition) keep working.

function accountToCategory(doc) {
  if (!doc) return null
  return {
    _id: doc._id,
    name: doc.name || "",
    type: doc.accountType || "",
    description: typeof doc.description === "string" ? doc.description : "",
    clientId: doc.clientId,
    tagIds: Array.isArray(doc.tagIds) ? doc.tagIds : [],
    templateCategoryId: doc.templateCategoryId ?? null,
    isTemplateSynced: Boolean(doc.isTemplateSynced),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

const PNL_FILTER = { accountType: { $in: PNL_ACCOUNT_TYPES } }

export async function ensureCategoryIndexes() {
  // No-op: indexes live on the `account` collection now (set up by
  // ensureAccountIndexes in account.repository.js).
}

export async function createCategory(input) {
  const db = getDB()

  const doc = {
    name: input.name,
    accountType: input.type,
    description: input.description,
    clientId: input.clientId,
    tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
    templateCategoryId: input.templateCategoryId ?? null,
    isTemplateSynced: Boolean(input.isTemplateSynced),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await db.collection("coa_accounts").insertOne(doc)
  return accountToCategory({ ...doc, _id: result.insertedId })
}

export async function updateCategoryById(id, patch) {
  const db = getDB()

  const allowed = {
    name: patch.name,
    accountType: patch.type,
    description: patch.description,
    clientId: patch.clientId,
    tagIds: patch.tagIds,
    templateCategoryId: patch.templateCategoryId,
    isTemplateSynced: patch.isTemplateSynced,
    isActive: patch.isActive,
    updatedAt: new Date(),
  }

  const $set = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined),
  )

  const update = { $set }
  if (patch.clearLegacyTags) {
    update.$unset = { tags: "" }
  }

  const result = await db.collection("coa_accounts").findOneAndUpdate(
    { _id: new ObjectId(id) },
    update,
    { returnDocument: "after" },
  )
  return accountToCategory(result?.value ?? result)
}

export async function createCategoriesBulk(input = []) {
  const db = getDB()
  if (!Array.isArray(input) || input.length === 0) return []

  const docs = input.map((item) => ({
    name: item.name,
    accountType: item.type,
    description: item.description,
    clientId: item.clientId,
    tagIds: Array.isArray(item.tagIds) ? item.tagIds : [],
    templateCategoryId: item.templateCategoryId ?? null,
    isTemplateSynced: Boolean(item.isTemplateSynced),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  await db.collection("coa_accounts").insertMany(docs)
  return docs.map(accountToCategory)
}

export async function listCategoriesByClientId(clientId) {
  const db = getDB()
  const docs = await db
    .collection("coa_accounts")
    .find({ clientId, ...PNL_FILTER })
    .sort({ createdAt: -1 })
    .toArray()
  return docs.map(accountToCategory)
}

export async function getCategoryById(id) {
  const db = getDB()
  const doc = await db.collection("coa_accounts").findOne({ _id: new ObjectId(id) })
  return accountToCategory(doc)
}

export async function listCategoriesByIds(ids = []) {
  const db = getDB()
  if (!Array.isArray(ids) || ids.length === 0) return []

  const objectIds = ids
    .filter((id) => id && ObjectId.isValid(String(id)))
    .map((id) => new ObjectId(String(id)))

  if (objectIds.length === 0) return []

  const docs = await db.collection("coa_accounts").find({ _id: { $in: objectIds } }).toArray()
  return docs.map(accountToCategory)
}

export async function deleteCategoryById(id) {
  const db = getDB()
  return db.collection("coa_accounts").deleteOne({ _id: new ObjectId(id) })
}

export async function deleteCategoriesByIds(ids = []) {
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

export async function deleteCategoriesByClientId(clientId) {
  const db = getDB()
  return db.collection("coa_accounts").deleteMany({ clientId, ...PNL_FILTER })
}
