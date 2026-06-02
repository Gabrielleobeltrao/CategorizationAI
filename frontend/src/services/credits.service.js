import { api } from "../lib/api"

export async function getOfficeCredits(officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) throw new Error("officeId is required")
    return api(`/api/offices/${safeOfficeId}/credits?_ts=${Date.now()}`, {
        silentLoading: true,
    })
}

// Per-token credit rates — mirror backend config/credits.js so the
// Settings card can show an explicit "tokens × rate" simulation.
export const CREDITS_PER_INPUT_TOKEN = 0.0006
export const CREDITS_PER_OUTPUT_TOKEN = 0.0024

// Empirical midpoints observed in demo traffic. Used purely for the
// "typical LLM call" simulation shown in the Settings card.
export const TYPICAL_INPUT_TOKENS_PER_TX = 681
export const TYPICAL_OUTPUT_TOKENS_PER_TX = 107

// Rough credit cost estimate per categorized transaction. Derived
// from the typical token mix above at the current rates. Used as the
// fallback when there isn't enough history to compute a dynamic
// per-office average.
export const AVG_CREDITS_PER_TRANSACTION =
    Math.round(
        (TYPICAL_INPUT_TOKENS_PER_TX * CREDITS_PER_INPUT_TOKEN +
            TYPICAL_OUTPUT_TOKENS_PER_TX * CREDITS_PER_OUTPUT_TOKEN) *
            100
    ) / 100

// Memory hits (exact + semantic) skip the LLM but still charge a flat
// fee — same value used by backend CREDITS_PER_MEMORY_MATCH.
export const CREDITS_PER_MEMORY_MATCH = 0.20

// Zelle flow (counterparty extraction + dedicated categorization
// path) is priced higher than plain memory hits because the
// surrounding plumbing is more expensive. Mirrors backend
// CREDITS_PER_ZELLE_MATCH.
export const CREDITS_PER_ZELLE_MATCH = 0.30

export function estimateCreditCostForTransactions(count) {
    const safe = Math.max(0, Number(count) || 0)
    return Math.round(safe * AVG_CREDITS_PER_TRANSACTION * 100) / 100
}

export function formatCredits(value) {
    const n = Number(value) || 0
    return n.toLocaleString("en-US", {
        maximumFractionDigits: n >= 100 ? 0 : 2,
    })
}
