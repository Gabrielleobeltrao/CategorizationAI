import { getDB } from "../db.js"
import {
    DEFAULT_OPERATIONAL_STATUS,
    isValidOperationalStatus,
} from "../lib/operationalStatuses.js"

const COLLECTION = "client_operational_status"

export async function ensureClientOperationalStatusIndexes() {
    const db = getDB()
    const collection = db.collection(COLLECTION)
    await Promise.all([
        collection.createIndex({ clientId: 1 }, { unique: true }),
        collection.createIndex({ officeId: 1, updatedAt: -1 }),
    ])
}

function normalizeRecord(doc) {
    if (!doc) return null
    const computedStatus = isValidOperationalStatus(doc.computedStatus)
        ? doc.computedStatus
        : null
    const manualStatus = isValidOperationalStatus(doc.manualStatus)
        ? doc.manualStatus
        : null
    return {
        clientId: String(doc.clientId || ""),
        officeId: String(doc.officeId || ""),
        computedStatus,
        computedAt: doc.computedAt || null,
        computedReason: String(doc.computedReason || ""),
        manualStatus,
        manualReason: String(doc.manualReason || ""),
        manualSetAt: doc.manualSetAt || null,
        manualSetBy: String(doc.manualSetBy || ""),
        // The year the manual override was set against. Used by the
        // service to auto-clear "completed" overrides when the rules
        // window rolls into a new year — "I finished 2026" shouldn't
        // mean "I'm permanently finished".
        manualForYear: Number.isFinite(Number(doc.manualForYear))
            ? Number(doc.manualForYear)
            : null,
        effectiveStatus: manualStatus || computedStatus || DEFAULT_OPERATIONAL_STATUS,
        updatedAt: doc.updatedAt || null,
    }
}

export async function getClientOperationalStatus(clientId) {
    const safeClientId = String(clientId || "").trim()
    if (!safeClientId) return null
    const db = getDB()
    const doc = await db.collection(COLLECTION).findOne({ clientId: safeClientId })
    return normalizeRecord(doc)
}

export async function listOperationalStatusesByOfficeId(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) return []
    const db = getDB()
    const docs = await db.collection(COLLECTION).find({ officeId: safeOfficeId }).toArray()
    return docs.map(normalizeRecord).filter(Boolean)
}

export async function upsertComputedStatus(input) {
    const clientId = String(input?.clientId || "").trim()
    const officeId = String(input?.officeId || "").trim()
    if (!clientId || !officeId) {
        throw new Error("clientId and officeId are required")
    }

    const computedStatus = isValidOperationalStatus(input?.status)
        ? String(input.status)
        : null
    if (!computedStatus) {
        throw new Error("invalid operational status")
    }

    const db = getDB()
    const now = new Date()
    const setPayload = {
        officeId,
        computedStatus,
        computedAt: now,
        computedReason: String(input?.reason || ""),
        updatedAt: now,
    }
    const setOnInsert = {
        clientId,
        manualStatus: null,
        manualReason: "",
        manualSetAt: null,
        manualSetBy: "",
    }
    const result = await db.collection(COLLECTION).findOneAndUpdate(
        { clientId },
        { $set: setPayload, $setOnInsert: setOnInsert },
        { upsert: true, returnDocument: "after" }
    )
    return normalizeRecord(result)
}

export async function setManualStatus(input) {
    const clientId = String(input?.clientId || "").trim()
    const officeId = String(input?.officeId || "").trim()
    if (!clientId || !officeId) {
        throw new Error("clientId and officeId are required")
    }

    const manualStatus = input?.status === null || input?.status === ""
        ? null
        : (isValidOperationalStatus(input?.status) ? String(input.status) : undefined)
    if (manualStatus === undefined) {
        throw new Error("invalid operational status")
    }

    const db = getDB()
    const now = new Date()
    // Only "completed" carries a year stamp. "paused" is intentional
    // hold and isn't tied to a fiscal cycle. Clearing the override
    // (manualStatus === null) also clears the year.
    const manualForYear = manualStatus === "completed"
        ? Number(input?.forYear) || now.getUTCFullYear()
        : null
    const setPayload = {
        officeId,
        manualStatus,
        manualReason: manualStatus ? String(input?.reason || "") : "",
        manualSetAt: manualStatus ? now : null,
        manualSetBy: manualStatus ? String(input?.setBy || "") : "",
        manualForYear,
        updatedAt: now,
    }
    const setOnInsert = {
        clientId,
        computedStatus: null,
        computedAt: null,
        computedReason: "",
    }
    const result = await db.collection(COLLECTION).findOneAndUpdate(
        { clientId },
        { $set: setPayload, $setOnInsert: setOnInsert },
        { upsert: true, returnDocument: "after" }
    )
    return normalizeRecord(result)
}

export async function deleteOperationalStatusByClientId(clientId) {
    const safeClientId = String(clientId || "").trim()
    if (!safeClientId) return
    const db = getDB()
    await db.collection(COLLECTION).deleteOne({ clientId: safeClientId })
}
