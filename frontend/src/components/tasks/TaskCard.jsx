const PRIORITY_META = {
    low: { label: "Low", textClass: "text-slate-500", borderClass: "border-l-slate-400" },
    medium: { label: "Medium", textClass: "text-yellow-700", borderClass: "border-l-yellow-400" },
    high: { label: "High", textClass: "text-orange-700", borderClass: "border-l-orange-500" },
    urgent: { label: "Urgent", textClass: "text-red-700", borderClass: "border-l-red-600" },
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
    const firstClient = clientChips[0]
    const extraClients = clientChips.length > 1 ? clientChips.length - 1 : 0
    const isDone = task.status === "done"
    const isInProgress = task.status === "in_progress"
    const priority = String(task.priority || "low")
    const priorityMeta = getPriorityMeta(priority)
    const commentsCount = Array.isArray(task.comments) ? task.comments.length : 0
    const metaDate = task.dueDate
    const hasMeta = Boolean(metaDate) || assigneeChips.length > 0 || commentsCount > 0

    return (
        <li className={`rounded-xl border border-gray-100 border-l-4 ${priorityMeta.borderClass} bg-gray-50/50 ${isDone ? "opacity-70" : ""}`}>
            <button
                type="button"
                onClick={() => onSelect?.(task)}
                className="flex w-full min-w-0 flex-col gap-1.5 p-3 text-left"
            >
                <div className="flex min-w-0 items-start gap-2">
                    {isInProgress && (
                        <span className="relative mt-1.5 inline-flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-block h-2 w-2 rounded-full bg-red-500" />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${isDone ? "text-gray-500 line-through" : "text-gray-900"}`}>
                            {task.title || "(Untitled)"}
                        </p>
                        {firstClient && (
                            <p className="truncate text-[11px] text-gray-500">
                                {firstClient.name || "Unnamed"}
                                {extraClients > 0 ? ` +${extraClients}` : ""}
                            </p>
                        )}
                    </div>
                </div>
                {task.description && (
                    <p className="line-clamp-2 text-xs text-gray-500">{task.description}</p>
                )}
                {hasMeta && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        {metaDate && (
                            <span className="flex items-center gap-1">
                                <svg className="h-3 w-3 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                {formatDate(metaDate)}
                            </span>
                        )}
                        {assigneeChips.length > 0 && (
                            <span className="flex min-w-0 items-center gap-1">
                                <svg className="h-3 w-3 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <span className="truncate">
                                    {assigneeChips.map((a) => a.name || a.email || "—").join(", ")}
                                </span>
                            </span>
                        )}
                        {commentsCount > 0 && (
                            <span className="ml-auto flex items-center gap-1" title={`${commentsCount} comment${commentsCount === 1 ? "" : "s"}`}>
                                <svg className="h-3 w-3 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span className="tabular-nums">{commentsCount}</span>
                            </span>
                        )}
                    </div>
                )}
            </button>
        </li>
    )
}

export default TaskCard
