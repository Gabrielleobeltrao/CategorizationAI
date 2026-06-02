// Office credit balance for AI categorization.
//
// Balance source of truth is `offices.credits.balance`. The credit
// ledger is the immutable audit trail. Every write here updates BOTH —
// the office doc for fast reads, the ledger for history.
//
// Reads are cheap. Writes use $inc so concurrent jobs racing to charge
// at the same time produce a correct final balance.

import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import { AppError } from "../utils/appError.js"
import {
    appendLedgerEntry,
    listRecentLedgerEntries,
} from "../repositories/creditLedger.repository.js"
import {
    computeCreditCost,
    CREDITS_PER_MEMORY_MATCH,
    CREDITS_PER_ZELLE_MATCH,
    DEFAULT_NEW_OFFICE_CREDITS,
} from "../config/credits.js"

export const OUT_OF_CREDITS_ERROR_CODE = "OUT_OF_CREDITS"

function officeFilter(officeId) {
    const safe = String(officeId || "").trim()
    if (!safe || !ObjectId.isValid(safe)) {
        throw new AppError("invalid officeId", 400)
    }
    return { _id: new ObjectId(safe) }
}

// Reads the office credits. If the field doesn't exist yet (legacy
// office created before this feature), normalize to a default-shaped
// object so the rest of the code doesn't branch on null.
export async function getOfficeCredits(officeId) {
    const db = getDB()
    const office = await db.collection("offices").findOne(officeFilter(officeId), {
        projection: { credits: 1 },
    })
    const stored = office?.credits || {}
    return {
        balance: Number(stored.balance) || 0,
        lastToppedUpAt: stored.lastToppedUpAt || null,
        lastChargedAt: stored.lastChargedAt || null,
    }
}

// Recent N ledger entries — debits and credits interleaved, newest
// first. Used by the future Top-Up UI / audit panel.
export async function listRecentCreditEntries(officeId, { limit = 20 } = {}) {
    return listRecentLedgerEntries(officeId, { limit })
}

// Static blended fallback used when there isn't enough history to
// derive an office-specific average. Mirrors AVG_CREDITS_PER_TRANSACTION
// on the frontend (kept in sync manually for now — both move together
// when pricing changes).
const FALLBACK_AVG_PER_TX = 0.65

// Minimum number of categorized transactions before we trust the
// computed average. Below this the sample is too noisy and we use the
// static fallback. Tuned conservatively — a brand-new office shouldn't
// see a wildly skewed estimate just because their first job happened
// to be all memory hits or all cold LLM calls.
const MIN_TX_SAMPLE = 50

// Looks at the last N debits in the credit_ledger and computes an
// office-specific average credit cost per categorized transaction.
//
// Each debit row stores a count in meta (memory.match / zelle.match
// already had it; LLM rows now do too via transactions.service.js).
// For older LLM rows missing count, we estimate count from
// tokensIn assuming ~700 input tokens per transaction — close enough
// for the average to converge on real numbers as fresh rows accumulate.
//
// Returns { avgPerTx, sampleTxCount, sampleSpend, isFallback }. The
// caller can decide whether to show "≈ X transactions left" using the
// returned value or fall back to the static estimate.
export async function computeOfficeAvgPerTx(officeId, { lookback = 500 } = {}) {
    const db = getDB()
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) {
        return { avgPerTx: FALLBACK_AVG_PER_TX, sampleTxCount: 0, sampleSpend: 0, isFallback: true }
    }

    const recent = await db.collection("credit_ledger")
        .find({ officeId: safeOfficeId, direction: "debit" })
        .sort({ at: -1 })
        .limit(lookback)
        .toArray()

    let totalSpend = 0
    let totalTx = 0
    for (const row of recent) {
        const amount = Number(row?.amount) || 0
        if (amount <= 0) continue
        let count = Number(row?.meta?.count) || 0
        if (count <= 0) {
            // Legacy LLM rows: estimate tx count from tokensIn.
            // ~700 input tokens per categorized transaction is the
            // empirical midpoint observed in the demo data.
            const tokensIn = Number(row?.tokensIn) || 0
            if (tokensIn > 0) {
                count = Math.max(1, Math.round(tokensIn / 700))
            }
        }
        if (count <= 0) continue
        totalSpend += amount
        totalTx += count
    }

    if (totalTx < MIN_TX_SAMPLE || totalSpend <= 0) {
        return { avgPerTx: FALLBACK_AVG_PER_TX, sampleTxCount: totalTx, sampleSpend: totalSpend, isFallback: true }
    }

    const avgPerTx = Math.round((totalSpend / totalTx) * 10000) / 10000
    return { avgPerTx, sampleTxCount: totalTx, sampleSpend: totalSpend, isFallback: false }
}

// Throws AppError(402) when the office is out of credits. Callers
// should run this BEFORE kicking off any LLM batch so we never start a
// job we can't pay for. The cap is "balance > 0" (not "balance >=
// estimated cost") because we don't know upfront how many tokens a
// batch will consume — the worker re-checks after each call and bails
// when the balance dips to zero.
export async function assertHasCredits(officeId) {
    const { balance } = await getOfficeCredits(officeId)
    if (balance > 0) return balance
    throw new AppError("Office is out of AI credits", 402, {
        code: OUT_OF_CREDITS_ERROR_CODE,
    })
}

// Records a debit for a single LLM call. Atomic on the office doc so
// concurrent jobs can't double-spend. The ledger entry is written
// after the decrement; if the ledger write throws we don't roll back
// the balance — better to over-charge than to under-charge during a
// transient mongo error, and the totals helper still reconciles.
export async function chargeForLlmCall(input) {
    const officeId = String(input?.officeId || "").trim()
    if (!officeId) return null
    const tokensIn = Number(input?.tokensIn) || 0
    const tokensOut = Number(input?.tokensOut) || 0
    const cost = computeCreditCost({ tokensIn, tokensOut })
    if (cost <= 0) return null

    const db = getDB()
    const now = new Date()
    await db.collection("offices").updateOne(officeFilter(officeId), {
        $inc: { "credits.balance": -cost },
        $set: { "credits.lastChargedAt": now },
    })

    await appendLedgerEntry({
        officeId,
        at: now,
        direction: "debit",
        amount: cost,
        kind: input?.kind || "llm.categorize",
        jobId: input?.jobId || null,
        tokensIn,
        tokensOut,
        model: input?.model || null,
        meta: input?.meta || null,
    })

    return { cost, tokensIn, tokensOut }
}

// Bills a flat per-transaction fee when categorizations resolve from
// memory instead of hitting the LLM. Skips quietly when count is 0 so
// callers can fire-and-forget after every memory pass.
export async function chargeForMemoryMatches(input) {
    const officeId = String(input?.officeId || "").trim()
    if (!officeId) return null
    const count = Math.max(0, Number(input?.count) || 0)
    if (count === 0) return null
    // Callers can override the per-match rate (e.g. Zelle flow uses
    // CREDITS_PER_ZELLE_MATCH because its surrounding plumbing is
    // pricier than a plain memory hit).
    const rate = Number(input?.rate) > 0 ? Number(input.rate) : CREDITS_PER_MEMORY_MATCH
    const cost = Math.round(count * rate * 10000) / 10000
    if (cost <= 0) return null

    const db = getDB()
    const now = new Date()
    await db.collection("offices").updateOne(officeFilter(officeId), {
        $inc: { "credits.balance": -cost },
        $set: { "credits.lastChargedAt": now },
    })

    await appendLedgerEntry({
        officeId,
        at: now,
        direction: "debit",
        amount: cost,
        kind: input?.kind || "memory.match",
        jobId: input?.jobId || null,
        tokensIn: null,
        tokensOut: null,
        model: null,
        meta: { count, ...(input?.meta || {}) },
    })

    return { cost, count }
}

// Thin wrapper that bills Zelle-flow memory hits at the higher
// CREDITS_PER_ZELLE_MATCH rate. Same idempotency rules as
// chargeForMemoryMatches.
export async function chargeForZelleMatches(input) {
    return chargeForMemoryMatches({
        ...input,
        rate: CREDITS_PER_ZELLE_MATCH,
        kind: input?.kind || "zelle.match",
    })
}

// Adds credits to an office (manual grant / future Stripe top-up
// webhook). Symmetric to chargeForLlmCall.
export async function grantCredits(input) {
    const officeId = String(input?.officeId || "").trim()
    if (!officeId) return null
    const amount = Math.max(0, Number(input?.amount) || 0)
    if (amount <= 0) return null

    const db = getDB()
    const now = new Date()
    await db.collection("offices").updateOne(officeFilter(officeId), {
        $inc: { "credits.balance": amount },
        $set: { "credits.lastToppedUpAt": now },
    })

    await appendLedgerEntry({
        officeId,
        at: now,
        direction: "credit",
        amount,
        kind: input?.kind || "manual_grant",
        jobId: null,
        tokensIn: null,
        tokensOut: null,
        model: null,
        meta: input?.meta || null,
    })

    return { amount }
}

// Initial bucket for a freshly created office. Called from
// createOfficeService so a brand-new office can run AI from day one.
export async function seedInitialCreditsForNewOffice(officeId) {
    return grantCredits({
        officeId,
        amount: DEFAULT_NEW_OFFICE_CREDITS,
        kind: "initial_grant",
        meta: { reason: "new office signup" },
    })
}
