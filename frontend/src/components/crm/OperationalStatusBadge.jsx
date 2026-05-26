import {
    DEFAULT_OPERATIONAL_STATUS,
    getOperationalStatusBadgeClass,
    getOperationalStatusMeta,
} from "../../constants/operationalStatuses"

/**
 * Compact label for a client's operational status.
 *
 * Props:
 * - status: string id from OPERATIONAL_STATUS_LIST (falls back to default).
 * - size: "sm" (default) or "md" — controls padding and text size.
 * - title: optional tooltip override (defaults to the status description).
 */
function OperationalStatusBadge({ status, size = "sm", title, className = "" }) {
    const meta = getOperationalStatusMeta(status) || getOperationalStatusMeta(DEFAULT_OPERATIONAL_STATUS)
    const toneClass = getOperationalStatusBadgeClass(meta?.id)
    const sizeClass = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"

    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset ${toneClass} ${sizeClass} ${className}`}
            title={title || meta?.description || ""}
        >
            {meta?.label || "Unknown"}
        </span>
    )
}

export default OperationalStatusBadge
