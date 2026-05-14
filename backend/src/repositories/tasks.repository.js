import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const COLLECTION = "tasks"

function normalizeStatus(value) {
    const safe = String(value || "open").trim().toLowerCase()
    return safe === "done" ? "done" : "open"
}

function normalizeDueDate(value) {
    if (value === null || value === undefined || value === "") return null
    const safe = String(value).trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(safe) ? safe : null
}

function normalizeOptionalId(value) {
    if (value === null || value === undefined || value === "") return null
    const safe = String(value).trim()
    return safe || null
}

export async function ensureTasksIndexes() {
    const db = getDB()
    const collection = db.collection(COLLECTION)
    await Promise.all([
        collection.createIndex({ officeId: 1, status: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, clientId: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, assigneeId: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, dueDate: 1 }),
    ])
}

export async function createTask(input) {
    const db = getDB()
    const now = new Date()
    const status = normalizeStatus(input.status)

    const doc = {
        officeId: String(input.officeId || "").trim(),
        clientId: normalizeOptionalId(input.clientId),
        assigneeId: normalizeOptionalId(input.assigneeId),
        dueDate: normalizeDueDate(input.dueDate),
        title: String(input.title || "").trim(),
        description: String(input.description || "").trim(),
        status,
        doneAt: status === "done" ? now : null,
        createdBy: String(input.createdBy || "").trim(),
        createdAt: now,
        updatedAt: now,
    }

    const result = await db.collection(COLLECTION).insertOne(doc)
    return { ...doc, _id: result.insertedId }
}

export async function listTasksByOfficeId(officeId, filters = {}) {
    const db = getDB()
    const query = { officeId: String(officeId || "").trim() }

    if (filters.clientId) query.clientId = String(filters.clientId).trim()
    if (filters.assigneeId) query.assigneeId = String(filters.assigneeId).trim()
    if (filters.status === "open" || filters.status === "done") {
        query.status = filters.status
    }

    return db.collection(COLLECTION)
        .find(query)
        .sort({ status: 1, dueDate: 1, createdAt: -1 })
        .toArray()
}

export async function getTaskById(id) {
    if (!ObjectId.isValid(String(id))) return null
    const db = getDB()
    return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function updateTaskById(id, patch) {
    const db = getDB()
    const now = new Date()

    const $set = { updatedAt: now }

    if (patch.clientId !== undefined) $set.clientId = normalizeOptionalId(patch.clientId)
    if (patch.assigneeId !== undefined) $set.assigneeId = normalizeOptionalId(patch.assigneeId)
    if (patch.dueDate !== undefined) $set.dueDate = normalizeDueDate(patch.dueDate)
    if (patch.title !== undefined) $set.title = String(patch.title || "").trim()
    if (patch.description !== undefined) $set.description = String(patch.description || "").trim()

    if (patch.status !== undefined) {
        const nextStatus = normalizeStatus(patch.status)
        $set.status = nextStatus

        // Look at the existing doc so we only stamp doneAt when transitioning to done
        // and clear it when transitioning back to open.
        const existing = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
        const prevStatus = existing?.status === "done" ? "done" : "open"
        if (nextStatus === "done" && prevStatus !== "done") {
            $set.doneAt = now
        } else if (nextStatus !== "done" && prevStatus === "done") {
            $set.doneAt = null
        }
    }

    return db.collection(COLLECTION).findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
        { returnDocument: "after" }
    )
}

export async function deleteTaskById(id) {
    const db = getDB()
    return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
}
