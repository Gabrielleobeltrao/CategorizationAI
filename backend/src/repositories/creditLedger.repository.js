// Per-event credit ledger. Each row is a debit (LLM usage, etc.) or a
// credit (top-up, manual grant). The office's balance is kept on the
// offices document for fast reads — the ledger is the audit trail.
//
// Schema:
//   officeId   : string
//   at         : Date
//   direction  : "debit" | "credit"
//   amount     : Number (always positive — `direction` decides the sign)
//   kind       : string (e.g. "llm.categorize", "top_up", "manual_grant")
//   jobId?     : string   (categorization_jobs._id for LLM debits)
//   tokensIn?  : Number
//   tokensOut? : Number
//   model?     : string
//   meta?      : any      (free-form for top-up source / actor / notes)

import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const COLLECTION = "credit_ledger"

export async function ensureCreditLedgerIndexes() {
    const db = getDB()
    const collection = db.collection(COLLECTION)
    await Promise.all([
        collection.createIndex({ officeId: 1, at: -1 }),
        collection.createIndex({ officeId: 1, direction: 1, at: -1 }),
        collection.createIndex({ jobId: 1 }),
    ])
}

export async function appendLedgerEntry(input) {
    const officeId = String(input?.officeId || "").trim()
    if (!officeId) throw new Error("officeId is required")
    const direction = input?.direction === "credit" ? "credit" : "debit"
    const amount = Math.max(0, Number(input?.amount) || 0)
    const kind = String(input?.kind || "").trim() || "unknown"

    const doc = {
        officeId,
        at: input?.at instanceof Date ? input.at : new Date(),
        direction,
        amount,
        kind,
        jobId: input?.jobId ? String(input.jobId) : null,
        tokensIn: Number.isFinite(Number(input?.tokensIn)) ? Number(input.tokensIn) : null,
        tokensOut: Number.isFinite(Number(input?.tokensOut)) ? Number(input.tokensOut) : null,
        model: input?.model ? String(input.model) : null,
        meta: input?.meta ?? null,
    }
    const db = getDB()
    const result = await db.collection(COLLECTION).insertOne(doc)
    return { ...doc, _id: result.insertedId }
}

// Recent entries for a single office, newest first. Returned shape is
// the raw stored doc plus `_id` stringified for JSON responses.
export async function listRecentLedgerEntries(officeId, { limit = 20 } = {}) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) return []
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20))
    const db = getDB()
    const rows = await db
        .collection(COLLECTION)
        .find({ officeId: safeOfficeId })
        .sort({ at: -1, _id: -1 })
        .limit(safeLimit)
        .toArray()
    return rows.map((row) => ({ ...row, _id: String(row._id) }))
}

// Aggregate total usage for the office. Useful for diagnostics / Stripe
// reconciliation later.
export async function getOfficeLedgerTotals(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) return { debit: 0, credit: 0 }
    const db = getDB()
    const rows = await db
        .collection(COLLECTION)
        .aggregate([
            { $match: { officeId: safeOfficeId } },
            { $group: { _id: "$direction", total: { $sum: "$amount" } } },
        ])
        .toArray()
    const out = { debit: 0, credit: 0 }
    for (const r of rows) out[r._id] = Number(r.total) || 0
    return out
}

export async function deleteLedgerEntriesByOfficeId(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) return
    const db = getDB()
    await db.collection(COLLECTION).deleteMany({ officeId: safeOfficeId })
}

// Helper for scripts that need to backfill the demo ledger.
export async function insertLedgerEntriesRaw(entries) {
    const safe = (Array.isArray(entries) ? entries : []).map((e) => ({
        ...e,
        _id: e._id ? new ObjectId(e._id) : new ObjectId(),
    }))
    if (safe.length === 0) return
    const db = getDB()
    await db.collection(COLLECTION).insertMany(safe)
}
