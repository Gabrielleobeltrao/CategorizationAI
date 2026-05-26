import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { getOfficeActivity } from "../services/home.service"
import { listEmployeesByOfficeId } from "../services/employees.service"

const ACTIVITY_LABELS = {
    "task.created": "Created task",
    "task.deleted": "Deleted task",
    "task.status.open": "Reopened task",
    "task.status.in_progress": "Started task",
    "task.status.done": "Completed task",
    "task.comment.added": "Commented on task",
    "client.created": "Created client",
    "client.deleted": "Deleted client",
    "client.note.added": "Added note on client",
    "client.note.updated": "Edited note on client",
    "client.note.deleted": "Deleted note on client",
    "period.closed": "Closed period",
    "period.reopened": "Reopened period",
    "reconciliation.completed": "Completed reconciliation",
    "reconciliation.reopened": "Reopened reconciliation",
    "recurring.created": "Created recurring rule",
    "recurring.runOnce": "Ran recurring rule once",
}

const ACTION_GROUPS = [
    { label: "All actions", value: "" },
    { label: "Tasks", value: "task.*" },
    { label: "Clients", value: "client.*" },
    { label: "Notes", value: "client.note.*" },
    { label: "Period close", value: "period.*" },
    { label: "Reconciliation", value: "reconciliation.*" },
    { label: "Recurring", value: "recurring.*" },
]

function formatTimestamp(value) {
    if (!value) return ""
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

function FilterDate({ label, value, onChange, className = "" }) {
    return (
        <label className={`flex flex-col gap-1.5 ${className}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition hover:border-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
        </label>
    )
}

function FilterSelect({ label, value, onChange, children, className = "" }) {
    return (
        <label className={`flex flex-col gap-1.5 ${className}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm text-gray-900 shadow-sm outline-none transition hover:border-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                >
                    {children}
                </select>
                <svg
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </div>
        </label>
    )
}

function ActivityLogPage() {
    const { profile } = useAuth()
    const { error } = useNotification()
    const officeId = String(profile?.officeId || "").trim()

    const [items, setItems] = useState([])
    const [employees, setEmployees] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [actorFilter, setActorFilter] = useState("")
    const [actionFilter, setActionFilter] = useState("")
    const [fromFilter, setFromFilter] = useState("")
    const [toFilter, setToFilter] = useState("")
    const [limit, setLimit] = useState(100)

    useEffect(() => {
        if (!officeId) return undefined
        let active = true
        listEmployeesByOfficeId(officeId)
            .then((payload) => {
                if (!active) return
                const list = Array.isArray(payload?.items)
                    ? payload.items
                    : Array.isArray(payload)
                        ? payload
                        : []
                setEmployees(list)
            })
            .catch(() => {})
        return () => { active = false }
    }, [officeId])

    const loadActivity = useCallback(() => {
        if (!officeId) return Promise.resolve()
        setIsLoading(true)
        // Translate YYYY-MM-DD inputs into inclusive start/end-of-day timestamps.
        const fromIso = fromFilter ? new Date(`${fromFilter}T00:00:00`).toISOString() : undefined
        const toIso = toFilter ? new Date(`${toFilter}T23:59:59.999`).toISOString() : undefined
        return getOfficeActivity(officeId, {
            actorId: actorFilter || undefined,
            action: actionFilter || undefined,
            from: fromIso,
            to: toIso,
            limit,
        })
            .then((payload) => {
                setItems(Array.isArray(payload?.items) ? payload.items : [])
            })
            .catch((err) => {
                error(err?.message || "Failed to load activity log")
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [officeId, actorFilter, actionFilter, fromFilter, toFilter, limit, error])

    useEffect(() => {
        queueMicrotask(loadActivity)
    }, [loadActivity])

    const employeeById = useMemo(() => {
        const map = new Map()
        for (const emp of employees) {
            map.set(String(emp._id || emp.id), emp)
        }
        return map
    }, [employees])

    return (
        <section className="h-full w-full px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
            <div className="mx-auto flex max-w-7xl flex-col gap-4">
                <header>
                    <h1 className="text-2xl font-bold sm:text-3xl">Activity Log</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Office-wide audit trail of who did what. Retained for 30 days.
                    </p>
                </header>

                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    <FilterSelect
                        label="User"
                        value={actorFilter}
                        onChange={setActorFilter}
                        className="min-w-50"
                    >
                        <option value="">Everyone</option>
                        {employees.map((emp) => (
                            <option key={String(emp._id || emp.id)} value={String(emp._id || emp.id)}>
                                {emp.name || emp.email || "Unnamed"}
                            </option>
                        ))}
                    </FilterSelect>
                    <FilterSelect
                        label="Action"
                        value={actionFilter}
                        onChange={setActionFilter}
                        className="min-w-50"
                    >
                        {ACTION_GROUPS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </FilterSelect>
                    <FilterDate
                        label="From"
                        value={fromFilter}
                        onChange={setFromFilter}
                    />
                    <FilterDate
                        label="To"
                        value={toFilter}
                        onChange={setToFilter}
                    />
                    <FilterSelect
                        label="Limit"
                        value={String(limit)}
                        onChange={(value) => setLimit(Number(value))}
                        className="min-w-27.5"
                    >
                        <option value="50">50 entries</option>
                        <option value="100">100 entries</option>
                        <option value="200">200 entries</option>
                    </FilterSelect>
                    {(actorFilter || actionFilter || fromFilter || toFilter) && (
                        <button
                            type="button"
                            onClick={() => {
                                setActorFilter("")
                                setActionFilter("")
                                setFromFilter("")
                                setToFilter("")
                            }}
                            className="self-end rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                            Clear
                        </button>
                    )}
                    <div className="ml-auto self-center text-xs text-gray-500">
                        {isLoading ? "Loading…" : `${items.length} ${items.length === 1 ? "entry" : "entries"}`}
                    </div>
                </div>

                <article className="rounded-xl border border-gray-200 bg-white">
                    {items.length === 0 && !isLoading ? (
                        <p className="px-4 py-12 text-center text-sm text-gray-500">
                            No activity matches the current filters.
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {items.map((entry) => {
                                const actor = employeeById.get(String(entry.actorId))
                                const actorName = entry.actorName || actor?.name || actor?.email || "Unknown"
                                const title = ACTIVITY_LABELS[entry.action] || entry.action
                                const meta = entry.meta || {}
                                const metaText = []
                                if (meta.throughDate) metaText.push(`through ${meta.throughDate}`)
                                if (meta.from && meta.to) metaText.push(`${meta.from} → ${meta.to}`)
                                if (meta.statementDate) metaText.push(`statement ${meta.statementDate}`)
                                return (
                                    <li key={entry.id} className="px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm">
                                                    <span className="font-medium text-gray-900">{actorName}</span>
                                                    <span className="text-gray-500"> · </span>
                                                    <span className="text-gray-800">{title}</span>
                                                    {entry.label && (
                                                        <>
                                                            <span className="text-gray-500"> · </span>
                                                            <span className="text-gray-900">{entry.label}</span>
                                                        </>
                                                    )}
                                                </p>
                                                {metaText.length > 0 && (
                                                    <p className="mt-0.5 text-[11px] text-gray-500">{metaText.join(" · ")}</p>
                                                )}
                                            </div>
                                            <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                                                {formatTimestamp(entry.at)}
                                            </span>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </article>
            </div>
        </section>
    )
}

export default ActivityLogPage
