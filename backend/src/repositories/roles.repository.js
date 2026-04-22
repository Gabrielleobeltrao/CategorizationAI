import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const COLLECTION = "custom_roles"

export async function listCustomRolesByOfficeId(officeId) {
  const db = getDB()
  return db
    .collection(COLLECTION)
    .find({ officeId, isActive: { $ne: false } })
    .sort({ label: 1, createdAt: -1 })
    .toArray()
}

export async function getCustomRoleByOfficeIdAndKey(officeId, key) {
  const db = getDB()
  return db.collection(COLLECTION).findOne({
    officeId,
    key: String(key || "").toLowerCase(),
    isActive: { $ne: false },
  })
}

export async function getCustomRoleById(id) {
  const db = getDB()
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function createCustomRole(input) {
  const db = getDB()
  const doc = {
    officeId: input.officeId,
    key: String(input.key || "").toLowerCase(),
    label: input.label,
    description: input.description || "",
    permissions: Array.isArray(input.permissions) ? input.permissions : [],
    isSystem: false,
    isActive: true,
    createdBy: input.createdBy || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await db.collection(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function updateCustomRoleById(id, patch) {
  const db = getDB()
  return db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" }
  )
}

export async function deleteCustomRoleById(id) {
  const db = getDB()
  return db.collection(COLLECTION).findOneAndDelete({ _id: new ObjectId(id) })
}

