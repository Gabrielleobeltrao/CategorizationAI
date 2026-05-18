import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const COLLECTION = "board_collections"

// Board collections are office-scoped "columns" the user can drag tasks into.
// Each column has a position so the UI keeps the user-defined ordering between
// reloads. Tasks reference a column via `task.collectionId` — null/missing
// means the task lives in the implicit first "All tasks" column.

export async function ensureBoardCollectionsIndexes() {
    const db = getDB()
    const collection = db.collection(COLLECTION)
    await Promise.all([
        collection.createIndex({ officeId: 1, position: 1 }),
        collection.createIndex({ officeId: 1, name: 1 }),
    ])
}

function decorate(doc) {
    if (!doc) return doc
    return {
        ...doc,
        _id: doc._id,
        id: String(doc._id || ""),
    }
}

export async function listBoardCollectionsByOfficeId(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) return []
    const db = getDB()
    const docs = await db.collection(COLLECTION)
        .find({ officeId: safeOfficeId })
        .sort({ position: 1, createdAt: 1 })
        .toArray()
    return docs.map(decorate)
}

export async function createBoardCollection({ officeId, name, createdBy }) {
    const db = getDB()
    const now = new Date()
    const safeOfficeId = String(officeId || "").trim()
    const safeName = String(name || "").trim()
    if (!safeOfficeId) throw new Error("officeId is required")
    if (!safeName) throw new Error("name is required")

    // Append at the end of the current list.
    const last = await db.collection(COLLECTION)
        .find({ officeId: safeOfficeId })
        .sort({ position: -1 })
        .limit(1)
        .toArray()
    const nextPosition = last.length > 0 ? Number(last[0].position || 0) + 1 : 1

    const doc = {
        officeId: safeOfficeId,
        name: safeName,
        position: nextPosition,
        createdBy: String(createdBy || "").trim(),
        createdAt: now,
        updatedAt: now,
    }
    const result = await db.collection(COLLECTION).insertOne(doc)
    return decorate({ ...doc, _id: result.insertedId })
}

export async function updateBoardCollectionById(id, patch = {}) {
    const db = getDB()
    const now = new Date()
    const $set = { updatedAt: now }

    if (typeof patch.name === "string") {
        const name = patch.name.trim()
        if (!name) throw new Error("name cannot be empty")
        $set.name = name
    }
    if (patch.position !== undefined) {
        const position = Number(patch.position)
        if (!Number.isFinite(position)) throw new Error("position must be a number")
        $set.position = position
    }

    if (Object.keys($set).length === 1) {
        // Only `updatedAt` would change — caller passed nothing meaningful.
        return getBoardCollectionById(id)
    }

    const updated = await db.collection(COLLECTION).findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
        { returnDocument: "after" }
    )
    return updated ? decorate(updated) : null
}

export async function getBoardCollectionById(id) {
    if (!ObjectId.isValid(String(id))) return null
    const db = getDB()
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
    return doc ? decorate(doc) : null
}

export async function deleteBoardCollectionById(id) {
    const db = getDB()
    return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
}

// When a column is deleted, the tasks living in it should fall back to the
// implicit "All tasks" inbox. We do that by clearing collectionId on every
// task that referenced this column.
export async function unsetCollectionIdOnAllTasks(collectionId) {
    const db = getDB()
    return db.collection("tasks").updateMany(
        { collectionId: String(collectionId || "") },
        { $set: { collectionId: null, updatedAt: new Date() } }
    )
}
