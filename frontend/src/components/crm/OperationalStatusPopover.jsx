import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
    DEFAULT_OPERATIONAL_STATUS,
    getOperationalStatusBadgeClass,
    getOperationalStatusMeta,
} from "../../constants/operationalStatuses"
import { setClientOperationalStatus } from "../../services/operationalStatus.service"
import { useNotification } from "../../contexts/notification.context"
import { useAuth } from "../../contexts/auth.context"
import { hasPermission } from "../../utils/permissions"

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
function OperationalStatusPopover({ entry, clientId, onChange, className = "" }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const rootRef = useRef(null)
    const { profile } = useAuth()
    const { success, error } = useNotification()
    const canManage = hasPermission(profile?.permissions, "clients:update")

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

    const applyManual = async (nextStatus) => {
        if (!clientId || !canManage || isSaving) return
        try {
            setIsSaving(true)
            const updated = await setClientOperationalStatus(clientId, {
                status: nextStatus,
                reason: "",
            })
            success(
                nextStatus === null
                    ? "Manual override cleared"
                    : nextStatus === "completed"
                        ? "Client marked as completed"
                        : "Client paused"
            )
            onChange?.(updated)
            setIsOpen(false)
        } catch (err) {
            error(err?.message || "Failed to update status")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div ref={rootRef} className={`relative inline-flex ${className}`}>
            {/* The trigger is the badge itself — same colored tone but with a
                visible chevron, hover lift and pressed state so it actually
                reads as something you can click. */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen((v) => !v)
                }}
                className={`group inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset shadow-sm transition cursor-pointer hover:brightness-95 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 ${toneClass} ${
                    isOpen ? "brightness-95" : ""
                }`}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                title="View status details"
            >
                <span>{meta?.label || "Unknown"}</span>
                <svg
                    viewBox="0 0 24 24"
                    className={`h-3 w-3 shrink-0 opacity-70 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
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

                    {/* Manual overrides — only the two `isManual: true`
                        statuses can be set this way. When already on a
                        manual override, the only action is to clear it and
                        let the automatic rules drive the badge again. */}
                    {canManage && (
                        <div className="border-t border-gray-100 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Manual override
                            </p>
                            {isManual ? (
                                <button
                                    type="button"
                                    onClick={() => applyManual(null)}
                                    disabled={isSaving}
                                    className="mt-1.5 inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSaving ? "Clearing…" : "Resume automatic status"}
                                </button>
                            ) : (
                                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => applyManual("completed")}
                                        disabled={isSaving}
                                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                        Complete
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyManual("paused")}
                                        disabled={isSaving}
                                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="6" y="5" width="4" height="14" />
                                            <rect x="14" y="5" width="4" height="14" />
                                        </svg>
                                        Pause
                                    </button>
                                </div>
                            )}
                            <p className="mt-1.5 text-[10px] leading-tight text-gray-400">
                                Only Completed and Paused can be set by hand — the rest update automatically from bookkeeping data.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default OperationalStatusPopover
