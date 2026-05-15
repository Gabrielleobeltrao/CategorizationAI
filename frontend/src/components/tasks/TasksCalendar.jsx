import { useEffect, useMemo, useState } from "react"

const WEEKDAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

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
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  )

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const query = window.matchMedia("(max-width: 767px)")
    const onChange = (event) => setIsMobile(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const effectiveMode = isMobile ? "week" : mode

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

  const grid = effectiveMode === "month" ? getMonthGrid(cursor) : getWeekGrid(cursor)
  const today = useMemo(() => startOfDay(new Date()), [])

  const headerLabel = effectiveMode === "month"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(cursor)
    : `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(grid[0])} – ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(grid[6])}`

  const navigate = (direction) => {
    setCursor((current) => (effectiveMode === "month" ? addMonths(current, direction) : addWeeks(current, direction)))
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
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
          <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900 sm:min-w-[150px]">{headerLabel}</h3>
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

        <div className="hidden rounded-md border border-gray-200 p-0.5 md:inline-flex">
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

      {effectiveMode === "month" ? (
        <>
          <div className="grid grid-cols-7 gap-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {WEEKDAY_LABELS_SHORT.map((day, idx) => (
              <div key={day + idx} className="px-2 py-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day) => {
              const key = formatDateKey(day)
              const dayTasks = tasksByDate.get(key) || []
              const isToday = isSameDay(day, today)
              const inCurrentMonth = day.getMonth() === cursor.getMonth()
              return (
                <div
                  key={key}
                  style={{ minHeight: 110 }}
                  className={`flex flex-col gap-1.5 rounded-md border p-2 ${
                    isToday ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white"
                  } ${inCurrentMonth ? "" : "opacity-40"}`}
                >
                  <span className={`text-sm font-semibold ${isToday ? "text-gray-900" : "text-gray-500"}`}>
                    {day.getDate()}
                  </span>
                  <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                    {dayTasks.slice(0, 5).map((task) => {
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
                            className={`w-full truncate rounded px-2 py-1 text-left text-[11px] font-medium transition-colors ${className}`}
                            title={`${task.title || "(Untitled)"}${priority !== "low" ? ` — ${priority}` : ""}`}
                          >
                            {task.title || "(Untitled)"}
                          </button>
                        </li>
                      )
                    })}
                    {dayTasks.length > 5 && (
                      <li className="px-2 text-[11px] text-gray-400">
                        +{dayTasks.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {grid.map((day) => {
            const key = formatDateKey(day)
            const dayTasks = tasksByDate.get(key) || []
            const isToday = isSameDay(day, today)
            return (
              <li
                key={key}
                className={`flex items-start gap-3 rounded-md border p-2 ${
                  isToday ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white"
                }`}
              >
                <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-md bg-gray-50 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {WEEKDAY_LABELS_SHORT[day.getDay()]}
                  </span>
                  <span className={`text-lg font-semibold ${isToday ? "text-gray-900" : "text-gray-700"}`}>
                    {day.getDate()}
                  </span>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-1">
                  {dayTasks.length === 0 && (
                    <li className="text-xs text-gray-400">No tasks</li>
                  )}
                  {dayTasks.map((task) => {
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
                          className={`block w-full truncate rounded px-2 py-1 text-left text-xs font-medium transition-colors ${className}`}
                          title={`${task.title || "(Untitled)"}${priority !== "low" ? ` — ${priority}` : ""}`}
                        >
                          {task.title || "(Untitled)"}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

export default TasksCalendar
