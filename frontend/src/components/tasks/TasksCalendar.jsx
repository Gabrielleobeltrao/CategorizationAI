import { useMemo, useState } from "react"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function pad2(value) {
  return String(value).padStart(2, "0")
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function addWeeks(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getMonthGrid(cursor) {
  const first = startOfMonth(cursor)
  const gridStart = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + i)
    return day
  })
}

function getWeekGrid(cursor) {
  const start = startOfWeek(cursor)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

function TasksCalendar({ tasks = [], onSelectTask, defaultMode = "month" }) {
  const [mode, setMode] = useState(defaultMode === "week" ? "week" : "month")
  const [cursor, setCursor] = useState(() => new Date())

  const tasksByDate = useMemo(() => {
    const map = new Map()
    tasks.forEach((task) => {
      if (!task?.dueDate) return
      const list = map.get(task.dueDate) || []
      list.push(task)
      map.set(task.dueDate, list)
    })
    return map
  }, [tasks])

  const grid = mode === "month" ? getMonthGrid(cursor) : getWeekGrid(cursor)
  const today = useMemo(() => startOfDay(new Date()), [])

  const headerLabel = mode === "month"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(cursor)
    : `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(grid[0])} – ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(grid[6])}`

  const navigate = (direction) => {
    setCursor((current) => (mode === "month" ? addMonths(current, direction) : addWeeks(current, direction)))
  }

  const cellMinHeight = mode === "month" ? 84 : 200

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Previous"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h3 className="min-w-[150px] text-sm font-semibold text-gray-900">{headerLabel}</h3>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Next"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="ml-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Today
          </button>
        </div>

        <div className="inline-flex rounded-md border border-gray-200 p-0.5">
          {[
            { id: "month", label: "Month" },
            { id: "week", label: "Week" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                mode === option.id ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day} className="px-2 py-1">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((day) => {
          const key = formatDateKey(day)
          const dayTasks = tasksByDate.get(key) || []
          const isToday = isSameDay(day, today)
          const inCurrentMonth = mode === "week" || day.getMonth() === cursor.getMonth()

          return (
            <div
              key={key}
              style={{ minHeight: cellMinHeight }}
              className={`flex flex-col gap-1 rounded-md border p-1.5 ${
                isToday ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white"
              } ${inCurrentMonth ? "" : "opacity-40"}`}
            >
              <span className={`text-[11px] font-medium ${isToday ? "text-gray-900" : "text-gray-500"}`}>
                {day.getDate()}
              </span>
              <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
                {dayTasks.slice(0, mode === "month" ? 3 : 8).map((task) => {
                  const status = task.status || "open"
                  const isDone = status === "done"
                  const priority = task.priority || "low"
                  let className
                  if (isDone) {
                    className = "bg-gray-100 text-gray-500 line-through hover:bg-gray-200"
                  } else if (priority === "urgent") {
                    className = "bg-rose-600 text-white hover:bg-rose-700"
                  } else if (priority === "high") {
                    className = "bg-amber-500 text-white hover:bg-amber-600"
                  } else if (priority === "medium") {
                    className = "bg-sky-600 text-white hover:bg-sky-700"
                  } else {
                    className = "bg-gray-700 text-white hover:bg-gray-900"
                  }
                  return (
                    <li key={task._id || task.id}>
                      <button
                        type="button"
                        onClick={() => onSelectTask?.(task)}
                        className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-colors ${className}`}
                        title={`${task.title || "(Untitled)"}${priority !== "low" ? ` — ${priority}` : ""}`}
                      >
                        {task.title || "(Untitled)"}
                      </button>
                    </li>
                  )
                })}
                {dayTasks.length > (mode === "month" ? 3 : 8) && (
                  <li className="px-1.5 text-[10px] text-gray-400">
                    +{dayTasks.length - (mode === "month" ? 3 : 8)} more
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default TasksCalendar
