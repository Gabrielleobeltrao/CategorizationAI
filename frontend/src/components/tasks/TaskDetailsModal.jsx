import { useState } from "react"

function ClientDetails({ client }) {
    return (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {client.businessType && (
                <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Business Type</dt>
                    <dd className="text-sm text-gray-800">{client.businessType}</dd>
                </div>
            )}
            {client.state && (
                <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">State</dt>
                    <dd className="text-sm text-gray-800">{client.state}</dd>
                </div>
            )}
            {client.mainActivity && (
                <div className="sm:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Main Activity</dt>
                    <dd className="text-sm text-gray-800">{client.mainActivity}</dd>
                </div>
            )}
            {client.description && (
                <div className="sm:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Description</dt>
                    <dd className="text-sm text-gray-700">{client.description}</dd>
                </div>
            )}
            {Array.isArray(client.owners) && client.owners.length > 0 && (
                <div className="sm:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Owners</dt>
                    <dd>
                        <ul className="mt-1 space-y-2">
                            {client.owners.map((owner, idx) => (
                                <li key={idx} className="flex flex-col gap-0.5 text-sm">
                                    <span className="font-medium text-gray-900">{owner.name || "—"}</span>
                                    {owner.email && <span className="text-xs text-gray-500">{owner.email}</span>}
                                    {owner.phone && <span className="text-xs text-gray-500">{owner.phone}</span>}
                                </li>
                            ))}
                        </ul>
                    </dd>
                </div>
            )}
        </dl>
    )
}

function ClientRow({ client, collapsible, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen)
    const isOpen = !collapsible || open
    return (
        <div>
            <button
                type="button"
                onClick={() => collapsible && setOpen((v) => !v)}
                className={`flex w-full items-center justify-between gap-2 text-left ${collapsible ? "cursor-pointer" : "cursor-default"}`}
                disabled={!collapsible}
            >
                <p className="truncate text-sm font-semibold text-gray-900">{client.name || "—"}</p>
                {collapsible && (
                    <svg
                        className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                )}
            </button>
            {isOpen && <ClientDetails client={client} />}
        </div>
    )
}

function formatDate(value) {
    if (!value) return "—"
    const safe = String(value).trim()
    const date = /^\d{4}-\d{2}-\d{2}$/.test(safe) ? new Date(`${safe}T00:00:00`) : new Date(safe)
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(date)
}

const STATUS_OPTIONS = [
    { id: "open", label: "Open" },
    { id: "in_progress", label: "In progress" },
    { id: "done", label: "Done" },
]

const STATUS_LOG_META = {
    open: { label: "Open", dotClass: "bg-gray-400", textClass: "text-gray-700" },
    in_progress: { label: "In progress", dotClass: "bg-amber-500", textClass: "text-amber-700" },
    done: { label: "Done", dotClass: "bg-emerald-500", textClass: "text-emerald-700" },
}

function formatLogTimestamp(value) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

const PRIORITY_LABELS = {
    low: { label: "Low", textClass: "text-gray-700" },
    medium: { label: "Medium", textClass: "text-sky-700" },
    high: { label: "High", textClass: "text-amber-700" },
    urgent: { label: "Urgent", textClass: "text-rose-700" },
}

function TaskDetailsModal({
    task,
    clientList = [],
    assigneeList = [],
    onClose,
    onEdit,
    onChangeStatus,
    onDelete,
    canViewStatusHistory = false,
}) {
    const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false)
    if (!task) return null
    const isDone = task.status === "done"
    const currentStatus = task.status || "open"
    const clients = Array.isArray(clientList) ? clientList.filter(Boolean) : []
    const assignees = Array.isArray(assigneeList) ? assigneeList.filter(Boolean) : []
    const statusHistory = Array.isArray(task.statusHistory) ? task.statusHistory : []
    const showStatusHistory = canViewStatusHistory && statusHistory.length > 0

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Close"
                onClick={onClose}
            />
            <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
                    <div className="min-w-0">
                        {isDone && task.doneAt && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-gray-500">
                                    Completed on {formatDate(task.doneAt)}
                                </span>
                            </div>
                        )}
                        <h2 className="mt-2 truncate text-lg font-semibold text-gray-900">
                            {task.title || "(Untitled)"}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                    {task.description ? (
                        <p className="whitespace-pre-wrap text-sm text-gray-700">{task.description}</p>
                    ) : (
                        <p className="text-sm italic text-gray-400">No description</p>
                    )}

                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
                        <div>
                            <dt className="font-semibold uppercase tracking-wide text-gray-400">Due date</dt>
                            <dd className="mt-1 text-sm text-gray-800">
                                {task.dueDate ? formatDate(task.dueDate) : "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold uppercase tracking-wide text-gray-400">Priority</dt>
                            <dd className={`mt-1 text-sm font-medium ${(PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.low).textClass}`}>
                                {(PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.low).label}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold uppercase tracking-wide text-gray-400">Created</dt>
                            <dd className="mt-1 text-sm text-gray-800">
                                {task.createdAt ? formatDate(task.createdAt) : "—"}
                            </dd>
                        </div>
                    </dl>

                    {clients.length > 0 && (
                        <section className="mt-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {clients.length === 1 ? "Client" : `Clients (${clients.length})`}
                            </h3>
                            <ul className="mt-3 flex flex-col gap-3">
                                {clients.map((client, idx) => (
                                    <li key={String(client._id || client.id || idx)} className={idx > 0 ? "border-t border-gray-200 pt-3" : ""}>
                                        <ClientRow client={client} collapsible={clients.length > 1} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {assignees.length > 0 && (
                        <section className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {assignees.length === 1 ? "Assignee" : `Assignees (${assignees.length})`}
                            </h3>
                            <ul className="mt-3 flex flex-col gap-2">
                                {assignees.map((assignee, idx) => (
                                    <li key={String(assignee._id || assignee.id || idx)} className="flex flex-col gap-0.5 text-sm">
                                        <span className="font-medium text-gray-900">{assignee.name || assignee.email || "—"}</span>
                                        {assignee.name && assignee.email && (
                                            <span className="text-xs text-gray-500">{assignee.email}</span>
                                        )}
                                        {assignee.role && (
                                            <span className="text-[11px] uppercase tracking-wide text-gray-400">{assignee.role}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {showStatusHistory && (
                        <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50/60">
                            <button
                                type="button"
                                onClick={() => setIsStatusHistoryOpen((current) => !current)}
                                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-gray-100/60"
                                aria-expanded={isStatusHistoryOpen}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status history</span>
                                    <span className="text-[11px] text-gray-400">({statusHistory.length})</span>
                                </span>
                                <svg
                                    className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isStatusHistoryOpen ? "rotate-180" : ""}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="m6 9 6 6 6-6" />
                                </svg>
                            </button>
                            {isStatusHistoryOpen && (
                                <ol className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3">
                                    {[...statusHistory]
                                        .sort((a, b) => new Date(a?.at || 0).getTime() - new Date(b?.at || 0).getTime())
                                        .map((entry, idx) => {
                                            const meta = STATUS_LOG_META[entry?.status] || STATUS_LOG_META.open
                                            const actor = assigneeList.find((profile) => String(profile?._id || profile?.id) === String(entry?.by || ""))
                                            const actorLabel = actor?.name || actor?.email || ""
                                            return (
                                                <li key={`${entry?.status}-${idx}`} className="flex items-start gap-3">
                                                    <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} aria-hidden="true" />
                                                    <div className="flex min-w-0 flex-1 flex-col">
                                                        <span className={`text-sm font-medium ${meta.textClass}`}>{meta.label}</span>
                                                        <span className="text-[11px] text-gray-500">
                                                            {formatLogTimestamp(entry?.at)}
                                                            {actorLabel ? ` · ${actorLabel}` : ""}
                                                        </span>
                                                    </div>
                                                </li>
                                            )
                                        })}
                                </ol>
                            )}
                        </section>
                    )}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
                    {onChangeStatus ? (
                        <div className="inline-flex rounded-md border border-gray-200 p-0.5">
                            {STATUS_OPTIONS.map((option) => {
                                const isActive = option.id === currentStatus
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => onChangeStatus(task, option.id)}
                                        className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                            isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                )
                            })}
                        </div>
                    ) : <span />}

                    <div className="flex items-center gap-2">
                        {onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(task)}
                                className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                                Delete
                            </button>
                        )}
                        {onEdit && (
                            <button
                                type="button"
                                onClick={() => onEdit(task)}
                                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                            >
                                Edit
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        </div>
    )
}

export default TaskDetailsModal
