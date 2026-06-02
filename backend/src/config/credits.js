// Flat token-to-credit rates. Kept model-agnostic on purpose: the LLM
// can be swapped without touching billing math. When we move past the
// MVP and need per-model rates, the call sites already pass `model` to
// chargeForLlmCall so introducing a map here is a one-file change.

export const CREDITS_PER_INPUT_TOKEN = 0.0006
export const CREDITS_PER_OUTPUT_TOKEN = 0.0024

// Memory matches (exact / semantic) skip the LLM entirely but still
// consume infrastructure: we maintain the per-client memory store,
// run the fingerprint lookup, and apply the suggestion. Bill a flat
// fee per matched transaction so the value of the memory layer is
// captured in the credit ledger.
export const CREDITS_PER_MEMORY_MATCH = 0.20

// Zelle flow runs counterparty extraction + its own categorization
// path with stricter parsing than the generic LLM flow. Memory hits
// in this flow are priced higher than plain memory matches because
// the surrounding plumbing (zelle counterparty inference, special
// suspense routing) carries more cost.
export const CREDITS_PER_ZELLE_MATCH = 0.30

// Default credit balance for a freshly created office. Generous enough
// that nobody hits zero on the first day, low enough that we can
// observe usage in the ledger during private beta.
export const DEFAULT_NEW_OFFICE_CREDITS = 10000

// Rounded down to 4 decimals because credit balances are stored as
// JS numbers — keeps every ledger row stable under serialization and
// avoids "13.7999999" rounding drift accumulating over thousands of
// calls.
export function computeCreditCost({ tokensIn = 0, tokensOut = 0 } = {}) {
    const safeIn = Math.max(0, Number(tokensIn) || 0)
    const safeOut = Math.max(0, Number(tokensOut) || 0)
    const raw = safeIn * CREDITS_PER_INPUT_TOKEN + safeOut * CREDITS_PER_OUTPUT_TOKEN
    return Math.round(raw * 10000) / 10000
}
