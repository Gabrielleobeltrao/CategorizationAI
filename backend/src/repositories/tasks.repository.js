import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const COLLECTION = "tasks"

const TASK_STATUSES = new Set(["open", "in_progress", "done"])
const TASK_PRIORITIES = new Set(["low", "medium", "high", "urgent"])
const PRIORITY_RANK = { urgent: 4, high: 3, medium: 2, low: 1 }

function normalizeStatus(value) {
    const safe = String(value || "open").trim().toLowerCase()
    return TASK_STATUSES.has(safe) ? safe : "open"
}

function normalizePriority(value) {
    const safe = String(value || "low").trim().toLowerCase()
    return TASK_PRIORITIES.has(safe) ? safe : "low"
}

function normalizeDueDate(value) {
    if (value === null || value === undefined || value === "") return null
    const safe = String(value).trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(safe) ? safe : null
}

function normalizeIdArray(value, fallbackSingular = null) {
    if (value === undefined) {
        // No value provided — use the fallback singular (for back-compat shapes)
        if (fallbackSingular === null || fallbackSingular === undefined || fallbackSingular === "") return []
        const safe = String(fallbackSingular).trim()
        return safe ? [safe] : []
    }
    if (value === null || value === "") return []
    if (Array.isArray(value)) {
        const cleaned = value
            .map((entry) => String(entry || "").trim())
            .filter(Boolean)
        return Array.from(new Set(cleaned))
    }
    const safe = String(value).trim()
    return safe ? [safe] : []
}

function decorateTask(task) {
    if (!task || typeof task !== "object") return task
    const clientIds = Array.isArray(task.clientIds) && task.clientIds.length > 0
        ? task.clientIds
        : (task.clientId ? [String(task.clientId)] : [])
    const assigneeIds = Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0
        ? task.assigneeIds
        : (task.assigneeId ? [String(task.assigneeId)] : [])
    return {
        ...task,
        clientIds,
        assigneeIds,
        clientId: clientIds[0] || null,
        assigneeId: assigneeIds[0] || null,
    }
}

export async function ensureTasksIndexes() {
    const db = getDB()
    const collection = db.collection(COLLECTION)
    await Promise.all([
        collection.createIndex({ officeId: 1, status: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, clientIds: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, assigneeIds: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, dueDate: 1 }),
        collection.createIndex({ officeId: 1, priority: 1, createdAt: -1 }),
    ])

    // One-shot backfill: migrate legacy singular fields into the new arrays
    await collection.updateMany(
        { clientIds: { $exists: false }, clientId: { $type: "string" } },
        [{ $set: { clientIds: ["$clientId"] } }]
    )
    await collection.updateMany(
        { clientIds: { $exists: false } },
        { $set: { clientIds: [] } }
    )
    await collection.updateMany(
        { assigneeIds: { $exists: false }, assigneeId: { $type: "string" } },
        [{ $set: { assigneeIds: ["$assigneeId"] } }]
    )
    await collection.updateMany(
        { assigneeIds: { $exists: false } },
        { $set: { assigneeIds: [] } }
    )
    await collection.updateMany(
        { priority: { $exists: false } },
        { $set: { priority: "low" } }
    )
}

export async function createTask(input) {
    const db = getDB()
    const now = new Date()
    const status = normalizeStatus(input.status)
    const priority = normalizePriority(input.priority)
    const clientIds = normalizeIdArray(input.clientIds, input.clientId)
    const assigneeIds = normalizeIdArray(input.assigneeIds, input.assigneeId)

    const doc = {
        officeId: String(input.officeId || "").trim(),
        clientIds,
        assigneeIds,
        clientId: clientIds[0] || null,
        assigneeId: assigneeIds[0] || null,
        dueDate: normalizeDueDate(input.dueDate),
        title: String(input.title || "").trim(),
        description: String(input.description || "").trim(),
        status,
        priority,
        doneAt: status === "done" ? now : null,
        createdBy: String(input.createdBy || "").trim(),
        createdAt: now,
        updatedAt: now,
    }

    const result = await db.collection(COLLECTION).insertOne(doc)
    return decorateTask({ ...doc, _id: result.insertedId })
}

export async function listTasksByOfficeId(officeId, filters = {}) {
    const db = getDB()
    const query = { officeId: String(officeId || "").trim() }

    if (filters.clientId) {
        const id = String(filters.clientId).trim()
        query.$or = [{ clientIds: id }, { clientId: id }]
    }
    if (filters.assigneeId) {
        const id = String(filters.assigneeId).trim()
        const assigneeOr = [{ assigneeIds: id }, { assigneeId: id }]
        if (query.$or) {
            query.$and = [{ $or: query.$or }, { $or: assigneeOr }]
            delete query.$or
        } else {
            query.$or = assigneeOr
        }
    }
    if (TASK_STATUSES.has(filters.status)) {
        query.status = filters.status
    } else if (filters.status === "active") {
        query.status = { $ne: "done" }
    }
    if (TASK_PRIORITIES.has(filters.priority)) {
        query.priority = filters.priority
    }

    const dateRange = {}
    const fromRaw = String(filters.from || "").trim()
    const toRaw = String(filters.to || "").trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromRaw)) {
        dateRange.$gte = new Date(`${fromRaw}T00:00:00.000Z`)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
        dateRange.$lte = new Date(`${toRaw}T23:59:59.999Z`)
    }
    if (Object.keys(dateRange).length > 0) {
        query.createdAt = dateRange
    }

    const docs = await db.collection(COLLECTION)
        .find(query)
        .toArray()

    docs.sort((a, b) => {
        const statusA = String(a.status || "open")
        const statusB = String(b.status || "open")
        if (statusA !== statusB) return statusA.localeCompare(statusB)
        const priorityDiff = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)
        if (priorityDiff !== 0) return priorityDiff
        const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
        const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
        if (dueA !== dueB) return dueA - dueB
        const createdA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
        const createdB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
        return createdB - createdA
    })

    return docs.map(decorateTask)
}

export async function getTaskById(id) {
    if (!ObjectId.isValid(String(id))) return null
    const db = getDB()
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
    return doc ? decorateTask(doc) : null
}

export async function updateTaskById(id, patch) {
    const db = getDB()
    const now = new Date()

    const $set = { updatedAt: now }

    if (patch.clientIds !== undefined || patch.clientId !== undefined) {
        const clientIds = normalizeIdArray(
            patch.clientIds !== undefined ? patch.clientIds : undefined,
            patch.clientId !== undefined ? patch.clientId : undefined
        )
        $set.clientIds = clientIds
        $set.clientId = clientIds[0] || null
    }
    if (patch.assigneeIds !== undefined || patch.assigneeId !== undefined) {
        const assigneeIds = normalizeIdArray(
            patch.assigneeIds !== undefined ? patch.assigneeIds : undefined,
            patch.assigneeId !== undefined ? patch.assigneeId : undefined
        )
        $set.assigneeIds = assigneeIds
        $set.assigneeId = assigneeIds[0] || null
    }
    if (patch.dueDate !== undefined) $set.dueDate = normalizeDueDate(patch.dueDate)
    if (patch.title !== undefined) $set.title = String(patch.title || "").trim()
    if (patch.description !== undefined) $set.description = String(patch.description || "").trim()
    if (patch.priority !== undefined) $set.priority = normalizePriority(patch.priority)

    if (patch.status !== undefined) {
        const nextStatus = normalizeStatus(patch.status)
        $set.status = nextStatus

        const existing = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
        const prevStatus = existing?.status === "done" ? "done" : "open"
        if (nextStatus === "done" && prevStatus !== "done") {
            $set.doneAt = now
        } else if (nextStatus !== "done" && prevStatus === "done") {
            $set.doneAt = null
        }
    }

    const updated = await db.collection(COLLECTION).findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
        { returnDocument: "after" }
    )
    return updated ? decorateTask(updated) : updated
}

export async function deleteTaskById(id) {
    const db = getDB()
    return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
}
