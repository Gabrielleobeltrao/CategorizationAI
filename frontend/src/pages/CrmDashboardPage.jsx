import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { listTasks } from "../services/tasks.service"
import PerformanceOverview from "../components/dashboard/PerformanceOverview"

const MS_PER_DAY = 1000 * 60 * 60 * 24

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDueDate(value) {
  if (!value) return null
  const safe = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return null
  return new Date(`${safe}T00:00:00`)
}

function parseDoneAt(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function buildCrmKpis(tasks, currentProfileId) {
  const today = startOfDay(new Date())
  const todayMs = today.getTime()
  const weekFromNow = todayMs + 7 * MS_PER_DAY

  let openTotal = 0
  let dueThisWeek = 0
  let overdue = 0
  let doneThisWeek = 0
  let assignedToMe = 0
  let unassigned = 0
  let doneToday = 0
  let openUnassigned = 0

  tasks.forEach((task) => {
    if (!task) return
    const isDone = task.status === "done"

    if (!isDone) {
      openTotal += 1

      const dueDate = parseDueDate(task.dueDate)
      if (dueDate) {
        const dueMs = dueDate.getTime()
        if (dueMs < todayMs) overdue += 1
        else if (dueMs <= weekFromNow) dueThisWeek += 1
      }

      if (currentProfileId && String(task.assigneeId || "") === currentProfileId) {
        assignedToMe += 1
      }
      if (!task.assigneeId) {
        unassigned += 1
        openUnassigned += 1
      }
    } else {
      const doneAt = parseDoneAt(task.doneAt)
      if (doneAt) {
        const diffDays = (todayMs - startOfDay(doneAt).getTime()) / MS_PER_DAY
        if (diffDays <= 7) doneThisWeek += 1
        if (diffDays < 1) doneToday += 1
      }
    }
  })

  const monthKpis = [
    { id: "open", label: "Open Tasks", value: String(openTotal) },
    { id: "due-week", label: "Due This Week", value: String(dueThisWeek) },
    { id: "overdue", label: "Overdue", value: String(overdue) },
    { id: "done-week", label: "Done This Week", value: String(doneThisWeek) },
    { id: "assigned-me", label: "Assigned to You", value: String(assignedToMe) },
    { id: "unassigned", label: "Unassigned", value: String(unassigned) },
  ]
  const weekKpis = [
    { id: "open", label: "Open Tasks", value: String(openTotal) },
    { id: "due-week", label: "Due This Week", value: String(dueThisWeek) },
    { id: "done-today", label: "Done Today", value: String(doneToday) },
    { id: "open-unassigned", label: "Open & Unassigned", value: String(openUnassigned) },
  ]

  return { monthKpis, weekKpis }
}

function CrmDashboardPage() {
  const { profile } = useAuth()
  const { error } = useNotification()
  const officeId = String(profile?.officeId || "").trim()
  const currentProfileId = String(profile?._id || profile?.id || "").trim()

  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(Boolean(officeId))

  useEffect(() => {
    if (!officeId) return undefined
    let active = true

    listTasks()
      .then((list) => {
        if (active) setTasks(Array.isArray(list) ? list : [])
      })
      .catch((err) => {
        if (active) error(err.message || "Failed to load CRM dashboard")
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
  }, [error, officeId])

  const { monthKpis, weekKpis } = useMemo(
    () => buildCrmKpis(tasks, currentProfileId),
    [tasks, currentProfileId]
  )

  return (
    <section className="w-full p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Operations CRM</h1>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
            Active
          </span>
        </header>

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading CRM metrics…</p>
        ) : (
          <PerformanceOverview
            title="CRM Overview"
            subtitleMonth="Task metrics across the office"
            subtitleWeek="Task metrics for this week"
            monthKpis={monthKpis}
            weekKpis={weekKpis}
            weeklyTrend={[]}
            dailyTrend={[]}
            storageNamespace="crm.performanceOverview"
            showChart={false}
          />
        )}
      </div>
    </section>
  )
}

export default CrmDashboardPage
