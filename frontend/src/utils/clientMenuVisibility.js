// Client-scoped visibility for the per-client sidebar menu items. Pure
// visual layer — backed by localStorage, no server persistence. Lets a
// bookkeeper hide pages they don't use on a given client without
// changing global app settings.
//
// Storage shape: an object keyed by menu-item id with boolean values.
// Missing keys default to true (visible). The Info page itself is NOT
// toggleable — otherwise the user could lock themselves out.

const STORAGE_PREFIX = "client-menu-visibility:"
export const VISIBILITY_CHANGED_EVENT = "client-menu-visibility-changed"

// IDs of items that can be hidden. Order is also the order shown on
// the visibility settings card, mirroring the sidebar order. The
// `section` field groups the items the same way the sidebar groups
// them (Bookkeeping / Closing / Reports).
export const TOGGLEABLE_MENU_ITEMS = [
    { id: "transactions", label: "Transactions", section: "Bookkeeping" },
    { id: "recurring", label: "Recurring", section: "Bookkeeping" },
    { id: "chart-of-accounts", label: "Chart of Accounts", section: "Bookkeeping" },
    { id: "reconciliation", label: "Reconciliation", section: "Closing" },
    { id: "period-close", label: "Period Close", section: "Closing" },
    { id: "profit-loss", label: "Profit & Loss", section: "Reports" },
    { id: "account-balances", label: "Account Balances", section: "Reports" },
    { id: "balance-sheet", label: "Balance Sheet", section: "Reports" },
    { id: "trial-balance", label: "Trial Balance", section: "Reports" },
    { id: "general-ledger", label: "General Ledger", section: "Reports" },
]

// Sections in display order, used by UIs that want to render the
// toggleable items grouped.
export const TOGGLEABLE_MENU_SECTIONS = ["Bookkeeping", "Closing", "Reports"]

function storageKey(clientId) {
    return `${STORAGE_PREFIX}${String(clientId || "global")}`
}

export function readMenuVisibility(clientId) {
    if (typeof window === "undefined" || !clientId) return {}
    try {
        const raw = window.localStorage?.getItem(storageKey(clientId))
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
        return {}
    }
}

export function isMenuItemVisible(clientId, id) {
    const map = readMenuVisibility(clientId)
    // Default visible when the key is missing.
    return map?.[id] !== false
}

export function setMenuItemVisible(clientId, id, isVisible) {
    if (typeof window === "undefined" || !clientId) return
    try {
        const current = readMenuVisibility(clientId)
        const next = { ...current, [id]: Boolean(isVisible) }
        window.localStorage?.setItem(storageKey(clientId), JSON.stringify(next))
        window.dispatchEvent(
            new CustomEvent(VISIBILITY_CHANGED_EVENT, {
                detail: { clientId: String(clientId) },
            }),
        )
    } catch {
        /* ignore quota / private-mode errors */
    }
}

export function resetMenuVisibility(clientId) {
    if (typeof window === "undefined" || !clientId) return
    try {
        window.localStorage?.removeItem(storageKey(clientId))
        window.dispatchEvent(
            new CustomEvent(VISIBILITY_CHANGED_EVENT, {
                detail: { clientId: String(clientId) },
            }),
        )
    } catch {
        /* ignore */
    }
}

// Bulk set every toggleable item to the same visibility. Passing
// `true` is equivalent to resetMenuVisibility (defaults to visible).
export function setAllMenuItemsVisible(clientId, isVisible) {
    if (typeof window === "undefined" || !clientId) return
    if (isVisible) {
        resetMenuVisibility(clientId)
        return
    }
    const next = {}
    for (const item of TOGGLEABLE_MENU_ITEMS) {
        next[item.id] = false
    }
    try {
        window.localStorage?.setItem(storageKey(clientId), JSON.stringify(next))
        window.dispatchEvent(
            new CustomEvent(VISIBILITY_CHANGED_EVENT, {
                detail: { clientId: String(clientId) },
            }),
        )
    } catch {
        /* ignore */
    }
}
