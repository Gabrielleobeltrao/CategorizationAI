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

function TaskDetailsModal({ task, client, assignee, onClose, onEdit, onToggleStatus }) {
    if (!task) return null
    const isDone = task.status === "done"

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Close"
                onClick={onClose}
            />
            <div className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                                {isDone ? "Done" : "Open"}
                            </span>
                            {isDone && task.doneAt && (
                                <span className="text-[11px] text-gray-500">
                                    Completed on {formatDate(task.doneAt)}
                                </span>
                            )}
                        </div>
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

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {task.description ? (
                        <p className="whitespace-pre-wrap text-sm text-gray-700">{task.description}</p>
                    ) : (
                        <p className="text-sm italic text-gray-400">No description</p>
                    )}

                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                            <dt className="font-semibold uppercase tracking-wide text-gray-400">Due date</dt>
                            <dd className="mt-1 text-sm text-gray-800">
                                {task.dueDate ? formatDate(task.dueDate) : "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold uppercase tracking-wide text-gray-400">Created</dt>
                            <dd className="mt-1 text-sm text-gray-800">
                                {task.createdAt ? formatDate(task.createdAt) : "—"}
                            </dd>
                        </div>
                    </dl>

                    {client && (
                        <section className="mt-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client</h3>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{client.name || "—"}</p>
                            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
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
                            </dl>
                            {Array.isArray(client.owners) && client.owners.length > 0 && (
                                <div className="mt-3 border-t border-gray-200 pt-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Owners</p>
                                    <ul className="mt-2 space-y-3">
                                        {client.owners.map((owner, idx) => (
                                            <li key={idx} className="flex flex-col gap-0.5 text-sm">
                                                <span className="font-medium text-gray-900">{owner.name || "—"}</span>
                                                {owner.email && <span className="text-gray-500">{owner.email}</span>}
                                                {owner.phone && <span className="text-gray-500">{owner.phone}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    {assignee && (
                        <section className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assignee</h3>
                            <p className="mt-2 text-sm font-semibold text-gray-900">
                                {assignee.name || assignee.email || "—"}
                            </p>
                            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                                {assignee.email && (
                                    <div>
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Email</dt>
                                        <dd className="text-sm text-gray-800">{assignee.email}</dd>
                                    </div>
                                )}
                                {assignee.role && (
                                    <div>
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Role</dt>
                                        <dd className="text-sm text-gray-800 capitalize">{assignee.role}</dd>
                                    </div>
                                )}
                            </dl>
                        </section>
                    )}
                </div>

                <footer className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                    {onToggleStatus ? (
                        <button
                            type="button"
                            onClick={() => onToggleStatus(task)}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                isDone
                                    ? "border-gray-200 text-gray-700 hover:bg-gray-100"
                                    : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                        >
                            {isDone ? (
                                <>
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 12a9 9 0 1 0 9-9" />
                                        <path d="M3 4v8h8" />
                                    </svg>
                                    Reopen
                                </>
                            ) : (
                                <>
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                    Mark done
                                </>
                            )}
                        </button>
                    ) : <span />}

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Close
                        </button>
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
