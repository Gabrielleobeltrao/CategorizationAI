import { useEffect, useMemo, useState } from "react"
import {
    DEFAULT_OPERATIONAL_STATUS,
    OPERATIONAL_STATUS_LIST,
    getOperationalStatusBadgeClass,
} from "../../constants/operationalStatuses"
import { listOperationalStatusesByOfficeId } from "../../services/operationalStatus.service"
import OperationalStatusHelp from "./OperationalStatusHelp"

/**
 * Compact horizontal strip showing how many clients sit in each operational
 * status. Snapshot-only (no history yet); fetches the office-wide status list
 * on mount/officeId change.
 */
function OperationalStatusOverviewCard({ officeId }) {
    const [records, setRecords] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        const safeOfficeId = String(officeId || "").trim()
        if (!safeOfficeId) {
            setRecords([])
            return undefined
        }
        let active = true
        setIsLoading(true)
        setError(null)
        listOperationalStatusesByOfficeId(safeOfficeId)
            .then((items) => {
                if (!active) return
                setRecords(Array.isArray(items) ? items : [])
            })
            .catch((err) => {
                if (!active) return
                setRecords([])
                setError(err?.message || "Failed to load operational status overview")
            })
            .finally(() => {
                if (active) setIsLoading(false)
            })
        return () => { active = false }
    }, [officeId])

    const { counts, total } = useMemo(() => {
        const map = OPERATIONAL_STATUS_LIST.reduce((acc, status) => {
            acc[status.id] = 0
            return acc
        }, {})
        for (const record of records) {
            const status = record?.effectiveStatus || DEFAULT_OPERATIONAL_STATUS
            if (map[status] !== undefined) map[status] += 1
        }
        const totalCount = records.length
        return { counts: map, total: totalCount }
    }, [records])

    return (
        <article className="rounded-xl border border-gray-200 bg-white p-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Operational Status Overview</h2>
                    <OperationalStatusHelp />
                </div>
                <span className="text-xs text-gray-500">
                    {isLoading ? "Loading…" : `${total} client${total === 1 ? "" : "s"} total`}
                </span>
            </header>

            {error ? (
                <p className="mt-3 rounded-lg border border-dashed border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                </p>
            ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                    {OPERATIONAL_STATUS_LIST.map((status) => {
                        const count = counts[status.id] || 0
                        return (
                            <li
                                key={status.id}
                                className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-2.5 py-1.5"
                                title={status.description}
                            >
                                <span
                                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${getOperationalStatusBadgeClass(status.id)}`}
                                >
                                    {status.label}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 tabular-nums">{count}</span>
                            </li>
                        )
                    })}
                </ul>
            )}
        </article>
    )
}

export default OperationalStatusOverviewCard
