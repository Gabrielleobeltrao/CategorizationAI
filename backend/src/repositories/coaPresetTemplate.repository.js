import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

// User-defined CoA presets, scoped per office so an accountant's
// custom templates are reusable across all their clients but isolated
// from other offices.

const COLLECTION = "coa_preset_templates"

export async function ensureCoaPresetTemplateIndexes() {
  const db = getDB()
  await db.collection(COLLECTION).createIndex({ officeId: 1, name: 1 })
}

function normalizeAccount(account, index) {
  if (!account || typeof account !== "object") {
    throw new TypeError(`accounts[${index}]: must be an object`)
  }
  const name = String(account.name || "").trim()
  const accountType = String(account.accountType || "").trim()
  const description = String(account.description || "").trim()
  if (!name) throw new TypeError(`accounts[${index}].name is required`)
  if (!accountType) throw new TypeError(`accounts[${index}].accountType is required`)
  return { name, accountType, description }
}

export async function createCoaPresetTemplate({ officeId, name, description, accounts, createdBy }) {
  const safeOfficeId = String(officeId || "").trim()
  const safeName = String(name || "").trim()
  if (!safeOfficeId) throw new TypeError("officeId is required")
  if (!safeName) throw new TypeError("name is required")
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new TypeError("accounts must be a non-empty array")
  }
  const normalizedAccounts = accounts.map((a, i) => normalizeAccount(a, i))

  const doc = {
    officeId: safeOfficeId,
    name: safeName,
    description: String(description || "").trim(),
    accounts: normalizedAccounts,
    createdBy: String(createdBy || ""),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const db = getDB()
  const result = await db.collection(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function listCoaPresetTemplatesByOfficeId(officeId) {
  const db = getDB()
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) return []
  return db
    .collection(COLLECTION)
    .find({ officeId: safeOfficeId })
    .sort({ name: 1 })
    .toArray()
}

export async function getCoaPresetTemplateById(id) {
  if (!ObjectId.isValid(String(id))) return null
  const db = getDB()
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function deleteCoaPresetTemplateById(id) {
  if (!ObjectId.isValid(String(id))) return { deletedCount: 0 }
  const db = getDB()
  return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
}
