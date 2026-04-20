import { getDB } from "../db.js"

const OFFICE_TAGS_COLLECTION = "office_tags"

export async function ensureOfficeTagIndexes() {
  const db = getDB()
  const collection = db.collection(OFFICE_TAGS_COLLECTION)

  await Promise.all([
    collection.createIndex(
      { officeId: 1, slug: 1 },
      { unique: true }
    ),
    collection.createIndex({ officeId: 1, label: 1 }),
    collection.createIndex({ officeId: 1, createdAt: -1 }),
  ])
}

export async function listOfficeTagsByOfficeId(officeId) {
  const db = getDB()
  return db.collection(OFFICE_TAGS_COLLECTION)
    .find({ officeId })
    .sort({ label: 1 })
    .toArray()
}

export async function findOfficeTagsByOfficeIdAndSlugs(officeId, slugs = []) {
  const db = getDB()
  const safeSlugs = Array.isArray(slugs) ? slugs.filter(Boolean) : []
  if (safeSlugs.length === 0) return []

  return db.collection(OFFICE_TAGS_COLLECTION).find({
    officeId,
    slug: { $in: safeSlugs },
  }).toArray()
}

export async function findOfficeTagsByOfficeIdAndIds(officeId, ids = []) {
  const db = getDB()
  const safeIds = Array.isArray(ids) ? ids.filter(Boolean) : []
  if (safeIds.length === 0) return []

  return db.collection(OFFICE_TAGS_COLLECTION).find({
    officeId,
    _id: { $in: safeIds },
  }).toArray()
}

export async function upsertOfficeTagsByOfficeId(officeId, items = []) {
  const db = getDB()
  const safeItems = Array.isArray(items)
    ? items.filter((item) => item?.label && item?.slug)
    : []

  if (safeItems.length === 0) {
    return { acknowledged: true }
  }

  return db.collection(OFFICE_TAGS_COLLECTION).bulkWrite(
    safeItems.map((item) => ({
      updateOne: {
        filter: {
          officeId,
          slug: item.slug,
        },
        update: {
          $setOnInsert: {
            officeId,
            label: item.label,
            slug: item.slug,
            createdBy: String(item.createdBy || "").trim() || null,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  )
}

export async function deleteOfficeTagById(id) {
  const db = getDB()
  return db.collection(OFFICE_TAGS_COLLECTION).deleteOne({ _id: id })
}

export async function listClientTagsByOfficeId(officeId) {
  const db = getDB()
  return db.collection("clients").distinct("tags", { officeId })
}

export async function deleteTagFromClientsByOfficeId(officeId, tag) {
  const db = getDB()
  return db.collection("clients").updateMany(
    { officeId, tags: tag },
    { $pull: { tags: tag } }
  )
}

export async function deleteTagIdFromClientsByOfficeId(officeId, tagId) {
  const db = getDB()
  if (!tagId) {
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
  }

  return db.collection("clients").updateMany(
    { officeId, tagIds: tagId },
    { $pull: { tagIds: tagId } }
  )
}

export async function listCategoryTemplateTagsByOfficeId(officeId) {
  const db = getDB()
  return db.collection("category_templates").distinct("tags", { officeId })
}

export async function deleteTagFromCategoryTemplatesByOfficeId(officeId, tag) {
  const db = getDB()
  return db.collection("category_templates").updateMany(
    { officeId, tags: tag },
    { $pull: { tags: tag } }
  )
}

export async function deleteTagIdFromCategoryTemplatesByOfficeId(officeId, tagId) {
  const db = getDB()
  if (!tagId) {
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
  }

  return db.collection("category_templates").updateMany(
    { officeId, tagIds: tagId },
    { $pull: { tagIds: tagId } }
  )
}

export async function listCategoryTagsByOfficeId(officeId) {
  const db = getDB()

  const clientIds = await db.collection("clients")
    .find({ officeId }, { projection: { _id: 1 } })
    .toArray()

  const safeClientIds = clientIds
    .map((item) => String(item?._id || "").trim())
    .filter(Boolean)

  if (safeClientIds.length === 0) return []

  return db.collection("categories").distinct("tags", {
    clientId: { $in: safeClientIds },
  })
}

export async function deleteTagFromCategoriesByOfficeId(officeId, tag) {
  const db = getDB()

  const clientIds = await db.collection("clients")
    .find({ officeId }, { projection: { _id: 1 } })
    .toArray()

  const safeClientIds = clientIds
    .map((item) => String(item?._id || "").trim())
    .filter(Boolean)

  if (safeClientIds.length === 0) {
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
  }

  return db.collection("categories").updateMany(
    {
      clientId: { $in: safeClientIds },
      tags: tag,
    },
    {
      $pull: { tags: tag },
    }
  )
}

export async function deleteTagIdFromCategoriesByOfficeId(officeId, tagId) {
  const db = getDB()
  if (!tagId) {
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
  }

  const clientIds = await db.collection("clients")
    .find({ officeId }, { projection: { _id: 1 } })
    .toArray()

  const safeClientIds = clientIds
    .map((item) => String(item?._id || "").trim())
    .filter(Boolean)

  if (safeClientIds.length === 0) {
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
  }

  return db.collection("categories").updateMany(
    {
      clientId: { $in: safeClientIds },
      tagIds: tagId,
    },
    {
      $pull: { tagIds: tagId },
    }
  )
}
