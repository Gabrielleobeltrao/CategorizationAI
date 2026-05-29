import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
    DEFAULT_OPERATIONAL_STATUS,
    getOperationalStatusBadgeClass,
    getOperationalStatusMeta,
} from "../../constants/operationalStatuses"

// Per-status quick action. Returns { label, to } when the status has a
// natural next step, otherwise null.
function getNextAction(statusId, clientId) {
    if (!clientId) return null
    switch (statusId) {
        case "onboarding":
            return { label: "Import transactions", to: `/clients/${clientId}/transactions` }
        case "waiting_documents":
            return { label: "Import transactions", to: `/clients/${clientId}/transactions` }
        case "categorizing":
            return { label: "Categorize transactions", to: `/clients/${clientId}/transactions` }
        case "ready_to_review":
            return { label: "Open Profit & Loss", to: `/clients/${clientId}/reports/profit-loss` }
        case "completed":
            return { label: "Open Profit & Loss", to: `/clients/${clientId}/reports/profit-loss` }
        case "paused":
            return null
        default:
            return null
    }
}

/**
 * OperationalStatusPopover
 *
 * Renders the badge inline and, on click, opens a popover with the "why"
 * behind the current status: reason, who set it (if manual), days in
 * status, and a quick next-action link. The badge alone was descriptive —
 * the popover makes it actionable.
 *
 * Props:
 *  - entry: full record from listOperationalStatusesByOfficeId, or null
 *  - clientId: target client (used for the next-action link)
 *  - className: optional className for the trigger button
 */
function OperationalStatusPopover({ entry, clientId, className = "" }) {
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return undefined
        const onMouseDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        const onKey = (event) => {
            if (event.key === "Escape") setIsOpen(false)
        }
        document.addEventListener("mousedown", onMouseDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onMouseDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [isOpen])

    const status = entry?.effectiveStatus || DEFAULT_OPERATIONAL_STATUS
    const meta = getOperationalStatusMeta(status) || getOperationalStatusMeta(DEFAULT_OPERATIONAL_STATUS)
    const toneClass = getOperationalStatusBadgeClass(meta?.id)

    const isManual = Boolean(entry?.manualStatus)
    const reason = isManual ? entry?.manualReason : entry?.computedReason

    const action = getNextAction(meta?.id, clientId)

    return (
        <div ref={rootRef} className={`relative inline-flex ${className}`}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen((v) => !v)
                }}
                className="inline-flex shrink-0 items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-full"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${toneClass}`}
                >
                    {meta?.label || "Unknown"}
                </span>
            </button>

            {isOpen && (
                <div
                    role="dialog"
                    className="absolute left-0 top-[calc(100%+6px)] z-30 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="border-b border-gray-100 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${toneClass}`}
                            >
                                {meta?.label}
                            </span>
                            {isManual && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Set manually
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Why</p>
                        <p className="mt-1 text-sm leading-5 text-gray-800">
                            {reason || meta?.description || "No reason recorded."}
                        </p>
                    </div>

                    {action && (
                        <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-2">
                            <Link
                                to={action.to}
                                onClick={() => setIsOpen(false)}
                                className="inline-flex w-full items-center justify-between rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                            >
                                <span>{action.label}</span>
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14" />
                                    <path d="M13 6l6 6-6 6" />
                                </svg>
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default OperationalStatusPopover
