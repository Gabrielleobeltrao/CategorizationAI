// Mirror of backend/src/lib/operationalStatuses.js — keep both in sync. We
// don't import across the backend/frontend boundary because Vite would have to
// bundle the backend source tree; duplicating the registry keeps each app
// self-contained. The README documents the active rules and priority order;
// keep all three in sync when rules change.

export const OPERATIONAL_STATUS_LIST = [
    {
        id: "onboarding",
        label: "Onboarding",
        description: "Client has no imported transactions yet.",
        isManual: false,
        tone: "gray",
    },
    {
        id: "waiting_documents",
        label: "Waiting documents",
        description: "Client has transactions but the current year is not fully covered (some months missing).",
        isManual: false,
        tone: "amber",
    },
    {
        id: "categorizing",
        label: "Categorizing",
        description: "Every month of the current year has transactions, but some remain uncategorized.",
        isManual: false,
        tone: "violet",
    },
    {
        id: "ready_to_review",
        label: "Ready to review",
        description: "Every month of the current year has transactions and all of them are categorized.",
        isManual: false,
        tone: "emerald",
    },
    {
        id: "completed",
        label: "Completed",
        description: "Manual confirmation that the review/closing process is done.",
        isManual: true,
        tone: "emerald",
    },
    {
        id: "paused",
        label: "Paused",
        description: "Work intentionally paused — overrides automatic statuses until reactivated.",
        isManual: true,
        tone: "rose",
    },
]

export const DEFAULT_OPERATIONAL_STATUS = "onboarding"

const OPERATIONAL_STATUS_BY_ID = OPERATIONAL_STATUS_LIST.reduce((acc, status) => {
    acc[status.id] = status
    return acc
}, {})

export function getOperationalStatusMeta(value) {
    return OPERATIONAL_STATUS_BY_ID[String(value)] || null
}

export function isManualOperationalStatus(value) {
    return Boolean(OPERATIONAL_STATUS_BY_ID[String(value)]?.isManual)
}

const TONE_CLASSES = {
    gray: "bg-gray-100 text-gray-700 ring-gray-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
}

export function getOperationalStatusBadgeClass(value) {
    const meta = getOperationalStatusMeta(value)
    return TONE_CLASSES[meta?.tone || "gray"] || TONE_CLASSES.gray
}
