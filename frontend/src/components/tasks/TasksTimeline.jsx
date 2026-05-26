import { useMemo, useState } from "react"
import TaskCard from "./TaskCard"

/**
 * Mini month calendar (left) paired with the selected day's task list
 * (right). Clicking a day filters the right side. The right pane caps
 * its height and scrolls vertically once there are too many tasks for
 * the visible area — the calendar stays anchored in place.
 */

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

const PRIORITY_DOT = {
    urgent: "bg-red-600",
    high: "bg-orange-500",
    medium: "bg-yellow-400",
    low: "bg-slate-400",
}

const MAX_DAY_DOTS = 5

function topPriorityDots(tasks, max = MAX_DAY_DOTS) {
    return [...tasks]
        .sort((a, b) => (PRIORITY_RANK[a?.priority] ?? 3) - (PRIORITY_RANK[b?.priority] ?? 3))
        .slice(0, max)
        .map((t) => PRIORITY_DOT[t?.priority] || PRIORITY_DOT.low)
}

function toDate(value) {
    if (!value) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`)
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfWeek(date) {
    const d = startOfDay(date)
    d.setDate(d.getDate() - d.getDay())
    return d
}

function toKey(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
}

function TasksTimeline({ tasks = [], clientsById, employeesById, onSelect, headerAction = null }) {
    const today = useMemo(() => startOfDay(new Date()), [])
    const [cursor, setCursor] = useState(today)
    const [selected, setSelected] = useState(today)

    const monthFirst = startOfMonth(cursor)
    const gridStart = startOfWeek(monthFirst)
    const grid = useMemo(() => Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart)
        d.setDate(gridStart.getDate() + i)
        return d
    }), [gridStart])

    const tasksByDay = useMemo(() => {
        const map = new Map()
        for (const task of tasks) {
            const d = toDate(task.dueDate)
            if (!d) continue
            const key = toKey(d)
            const list = map.get(key) || []
            list.push(task)
            map.set(key, list)
        }
        return map
    }, [tasks])

    // Done tasks slide to the bottom so active work surfaces first;
    // within each bucket (active vs done) we sort by priority so the
    // most urgent items show up at the top of the day's list.
    const selectedTasks = useMemo(() => {
        const list = tasksByDay.get(toKey(selected)) || []
        return [...list].sort((a, b) => {
            const aDone = a?.status === "done" ? 1 : 0
            const bDone = b?.status === "done" ? 1 : 0
            if (aDone !== bDone) return aDone - bDone
            const aRank = PRIORITY_RANK[a?.priority] ?? 3
            const bRank = PRIORITY_RANK[b?.priority] ?? 3
            return aRank - bRank
        })
    }, [tasksByDay, selected])
    const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(cursor)

    return (
        <article className="rounded-xl border border-gray-200 bg-white p-4">
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Tasks timeline</h2>
                    <p className="text-sm text-gray-500">Pick a day on the calendar to see what's due.</p>
                </div>
                {headerAction}
            </header>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <section className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                            aria-label="Previous month"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                        <p className="text-sm font-semibold text-gray-900">{monthLabel}</p>
                        <button
                            type="button"
                            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                            aria-label="Next month"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                        {WEEKDAY_LABELS.map((w, idx) => (
                            <div key={w + idx} className="px-1 py-1 text-center text-[10px] font-semibold uppercase text-gray-400">
                                {w}
                            </div>
                        ))}
                        {grid.map((day) => {
                            const key = toKey(day)
                            const inMonth = day.getMonth() === cursor.getMonth()
                            const isToday = sameDay(day, today)
                            const isSelected = sameDay(day, selected)
                            const dayTasks = tasksByDay.get(key) || []
                            const dotClasses = dayTasks.length > 0 ? topPriorityDots(dayTasks) : []
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelected(startOfDay(day))}
                                    className={`relative flex h-9 items-center justify-center rounded-md text-xs transition ${
                                        isSelected
                                            ? "bg-gray-900 text-white"
                                            : isToday
                                                ? "border border-gray-900 text-gray-900"
                                                : inMonth
                                                    ? "text-gray-700 hover:bg-gray-100"
                                                    : "text-gray-300 hover:bg-gray-50"
                                    }`}
                                >
                                    {day.getDate()}
                                    {dotClasses.length > 0 && (
                                        <span className="absolute bottom-1 flex items-center" aria-hidden="true">
                                            {dotClasses.map((cls, i) => (
                                                <span
                                                    key={i}
                                                    className={`h-1.5 w-1.5 rounded-full ${cls} ${
                                                        i > 0
                                                            ? isSelected
                                                                ? "-ml-0.5 shadow-[-1px_0_0_#111827]"
                                                                : "-ml-0.5 shadow-[-1px_0_0_white]"
                                                            : ""
                                                    }`}
                                                />
                                            ))}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </section>
                <section className="flex min-h-0 flex-col gap-2 md:h-80">
                    <header className="flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">
                            {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(selected)}
                        </h3>
                        <span className="text-[11px] text-gray-500">{selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"}</span>
                    </header>
                    {selectedTasks.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center">
                            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                                No tasks on this day.
                            </p>
                        </div>
                    ) : (
                        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                            {selectedTasks.map((task) => (
                                <TaskCard
                                    key={task._id || task.id}
                                    task={task}
                                    clientById={clientsById}
                                    employeeById={employeesById}
                                    onSelect={onSelect}
                                />
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </article>
    )
}

export default TasksTimeline
