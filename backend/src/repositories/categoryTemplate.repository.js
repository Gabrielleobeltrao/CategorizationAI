import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const COLLECTION = "category_templates"

export async function ensureCategoryTemplateIndexes() {
  const db = getDB()
  const collection = db.collection(COLLECTION)

  await Promise.all([
    collection.createIndex({ officeId: 1, createdAt: -1 }),
    collection.createIndex({ officeId: 1, tagIds: 1 }),
    collection.createIndex({ officeId: 1, name: 1, type: 1 }),
  ])
}

export async function createCategoryTemplate(input) {
  const db = getDB()

  const doc = {
    officeId: input.officeId,
    name: input.name,
    type: input.type,
    description: input.description,
    tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await db.collection(COLLECTION).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function listCategoryTemplatesByOfficeId(officeId) {
  const db = getDB()
  return db.collection(COLLECTION).find({ officeId }).sort({ createdAt: -1 }).toArray()
}

export async function listCategoryTemplatesByOfficeIdAndTags(officeId, tags = []) {
  const db = getDB()
  const safeTagIds = Array.isArray(tags) ? tags.filter(Boolean) : []
  if (safeTagIds.length === 0) return []

  return db.collection(COLLECTION).find({
    officeId,
    tagIds: { $in: safeTagIds },
  }).toArray()
}

export async function getCategoryTemplateById(id) {
  const db = getDB()
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function updateCategoryTemplateById(id, patch) {
  const db = getDB()

  const allowed = {
    name: patch.name,
    type: patch.type,
    description: patch.description,
    tagIds: patch.tagIds,
    updatedAt: new Date(),
  }

  const $set = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined)
  )

  const update = { $set }

  if (patch.clearLegacyTags) {
    update.$unset = { tags: "" }
  }

  return db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    update,
    { returnDocument: "after" }
  )
}

export async function deleteCategoryTemplateById(id) {
  const db = getDB()
  return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
}
