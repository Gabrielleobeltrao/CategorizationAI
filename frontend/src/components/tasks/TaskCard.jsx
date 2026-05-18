const STATUS_META = {
    open: { label: "Open", dotClass: "bg-gray-400", textClass: "text-gray-600" },
    in_progress: { label: "In progress", dotClass: "bg-amber-500", textClass: "text-amber-700" },
    done: { label: "Done", dotClass: "bg-emerald-500", textClass: "text-emerald-700" },
}

const PRIORITY_META = {
    low: { label: "Low", textClass: "text-gray-500" },
    medium: { label: "Medium", textClass: "text-sky-700" },
    high: { label: "High", textClass: "text-amber-700" },
    urgent: { label: "Urgent", textClass: "text-rose-700" },
}

function getStatusMeta(status) {
    return STATUS_META[status] || STATUS_META.open
}

function getPriorityMeta(priority) {
    return PRIORITY_META[priority] || PRIORITY_META.low
}

function toIdArray(task, plural, singular) {
    if (Array.isArray(task?.[plural])) return task[plural].map(String).filter(Boolean)
    if (task?.[singular]) return [String(task[singular])]
    return []
}

function formatDate(value) {
    if (!value) return "—"
    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(date)
}

function TaskCard({ task, clientById, employeeById, onSelect }) {
    const taskClientIds = toIdArray(task, "clientIds", "clientId")
    const taskAssigneeIds = toIdArray(task, "assigneeIds", "assigneeId")
    const clientChips = taskClientIds
        .map((id) => clientById?.get?.(String(id)))
        .filter(Boolean)
    const assigneeChips = taskAssigneeIds
        .map((id) => employeeById?.get?.(String(id)))
        .filter(Boolean)
    const isDone = task.status === "done"
    const statusMeta = getStatusMeta(task.status)
    const priority = String(task.priority || "low")
    const priorityMeta = getPriorityMeta(priority)
    const showPriority = priority !== "low"
    const commentsCount = Array.isArray(task.comments) ? task.comments.length : 0

    return (
        <li className={`rounded-xl border border-gray-100 bg-gray-50/50 ${isDone ? "opacity-70" : ""}`}>
            <button
                type="button"
                onClick={() => onSelect?.(task)}
                className="flex w-full min-w-0 flex-col gap-1.5 p-3 text-left"
            >
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                    <span className={`flex items-center gap-1.5 ${statusMeta.textClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                        {statusMeta.label}
                    </span>
                    {showPriority && (
                        <>
                            <span className="text-gray-300">•</span>
                            <span className={`flex items-center gap-1 ${priorityMeta.textClass}`}>
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 21V4l8 4 8-4v17" />
                                    <line x1="4" y1="14" x2="20" y2="14" />
                                </svg>
                                {priorityMeta.label}
                            </span>
                        </>
                    )}
                    {commentsCount > 0 && (
                        <>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1 text-gray-500" title={`${commentsCount} comment${commentsCount === 1 ? "" : "s"}`}>
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span className="tabular-nums">{commentsCount}</span>
                            </span>
                        </>
                    )}
                </div>
                <p className={`text-sm font-medium ${isDone ? "text-gray-500 line-through" : "text-gray-900"}`}>
                    {task.title || "(Untitled)"}
                </p>
                {task.description && (
                    <p className="line-clamp-2 text-xs text-gray-500">{task.description}</p>
                )}
                <dl className="mt-1.5 flex flex-col gap-1.5 text-xs">
                    {clientChips.length > 0 && (
                        <div className="flex items-start gap-2">
                            <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 21h18" />
                                <path d="M5 21V7l8-4v18" />
                                <path d="M19 21V11l-6-4" />
                            </svg>
                            <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
                                {clientChips.map((c) => (
                                    <li key={String(c._id || c.id)} className="truncate font-medium text-gray-800">
                                        {c.name || "Unnamed"}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {assigneeChips.length > 0 && (
                        <div className="flex items-start gap-2">
                            <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
                                {assigneeChips.map((a) => (
                                    <li key={String(a._id || a.id)} className="truncate font-medium text-gray-800">
                                        {a.name || a.email || "—"}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {(task.dueDate || (isDone && task.doneAt)) && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span>
                                {isDone && task.doneAt
                                    ? `Done ${formatDate(task.doneAt)}`
                                    : `Due ${formatDate(task.dueDate)}`}
                            </span>
                        </div>
                    )}
                </dl>
            </button>
        </li>
    )
}

export default TaskCard
