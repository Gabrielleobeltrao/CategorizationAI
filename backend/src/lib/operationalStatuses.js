// Shared registry of Operational Status values used by the Operations CRM
// add-on. Every status has a stable id (stored in MongoDB), a friendly label
// and a flag that marks whether the status can be set manually by a user.
//
// Automatic statuses are derived from bookkeeping data by
// computeOperationalStatusForClient — see backend/src/services/
// operationalStatus.service.js. The README documents the active rules and
// priority order; keep both in sync when rules change.

export const OPERATIONAL_STATUS_LIST = [
    {
        id: "onboarding",
        label: "Onboarding",
        description: "Client has no imported transactions yet.",
        isManual: false,
    },
    {
        id: "waiting_documents",
        label: "Waiting documents",
        description: "Client has transactions but the current year is not fully covered (some months missing).",
        isManual: false,
    },
    {
        id: "categorizing",
        label: "Categorizing",
        description: "Every month of the current year has transactions, but some remain uncategorized.",
        isManual: false,
    },
    {
        id: "ready_to_review",
        label: "Ready to review",
        description: "Every month of the current year has transactions and all of them are categorized.",
        isManual: false,
    },
    {
        id: "completed",
        label: "Completed",
        description: "Manual confirmation that the review/closing process is done.",
        isManual: true,
    },
    {
        id: "paused",
        label: "Paused",
        description: "Work intentionally paused — overrides automatic statuses until reactivated.",
        isManual: true,
    },
]

export const OPERATIONAL_STATUS_IDS = OPERATIONAL_STATUS_LIST.map((status) => status.id)

const OPERATIONAL_STATUS_BY_ID = OPERATIONAL_STATUS_LIST.reduce((acc, status) => {
    acc[status.id] = status
    return acc
}, {})

export const DEFAULT_OPERATIONAL_STATUS = "onboarding"

export function isValidOperationalStatus(value) {
    return Boolean(value && OPERATIONAL_STATUS_BY_ID[String(value)])
}

export function isManualOperationalStatus(value) {
    const found = OPERATIONAL_STATUS_BY_ID[String(value)]
    return Boolean(found?.isManual)
}

export function getOperationalStatusMeta(value) {
    return OPERATIONAL_STATUS_BY_ID[String(value)] || null
}
