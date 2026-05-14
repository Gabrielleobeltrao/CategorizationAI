import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import {
  getCachedOfficeHomeDashboard,
  getOfficeHomeDashboard,
} from "../services/home.service"
import {
  getRecentOpenedClients,
  subscribeRecentOpenedClients,
} from "../utils/recentClients"
import { subscribeDashboardRefresh } from "../utils/dashboardRefresh"
import { useFeature } from "../hooks/useFeature"
import FeatureGate from "../components/auth/FeatureGate"
import { listTasks, updateTaskById as updateTask } from "../services/tasks.service"
import { listClientsByOfficeId } from "../services/clients.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import TasksCalendar from "../components/tasks/TasksCalendar"

function formatOpenedAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const EMPTY_DASHBOARD = {
  header: {
    officeName: "Office",
    periodLabel: "-",
    lastSyncAt: "-",
    queueStatus: "idle",
  },
  kpis: [],
  weekKpis: [],
  weeklyTrend: [],
  dailyTrend: [],
  jobsQueue: [],
  recentActivities: [],
  meta: {},
}

function normalizeDashboardPayload(payload = {}) {
  return {
    header: {
      ...EMPTY_DASHBOARD.header,
      ...(payload?.header || {}),
    },
    kpis: Array.isArray(payload?.kpis) ? payload.kpis : [],
    weekKpis: Array.isArray(payload?.weekKpis) ? payload.weekKpis : [],
    weeklyTrend: Array.isArray(payload?.weeklyTrend) ? payload.weeklyTrend : [],
    dailyTrend: Array.isArray(payload?.dailyTrend) ? payload.dailyTrend : [],
    jobsQueue: Array.isArray(payload?.jobsQueue) ? payload.jobsQueue : [],
    recentActivities: Array.isArray(payload?.recentActivities) ? payload.recentActivities : [],
    meta: payload?.meta || {},
  }
}

function formatTaskDueBadge(dateStr) {
  if (!dateStr) return null
  const due = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  let label
  if (diffDays < 0) label = `Overdue ${Math.abs(diffDays)}d`
  else if (diffDays === 0) label = "Due today"
  else if (diffDays === 1) label = "Tomorrow"
  else if (diffDays <= 7) label = `In ${diffDays}d`
  else {
    label = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(due)
  }

  return { label, tone: "bg-gray-100 text-gray-700" }
}

function HomeTaskItem({ task, clientsById, employeesById, showAssignee, onSelect, onMarkDone }) {
  const due = formatTaskDueBadge(task.dueDate)
  const client = task.clientId ? clientsById.get(String(task.clientId)) : null
  const assignee = showAssignee && task.assigneeId
    ? employeesById.get(String(task.assigneeId))
    : null
  const description = String(task.description || "").trim()

  return (
    <li className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100">
      <button type="button" onClick={() => onSelect?.(task)} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-medium text-gray-900">
            {task.title || "(Untitled)"}
          </p>
          {due && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${due.tone}`}>
              {due.label}
            </span>
          )}
        </div>
        {description && (
          <p className="line-clamp-2 text-xs text-gray-500">{description}</p>
        )}
        {(client || assignee) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {client && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                {client.name || "Client"}
              </span>
            )}
            {assignee && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                {assignee.name || assignee.email || "Member"}
              </span>
            )}
          </div>
        )}
      </button>
      {onMarkDone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMarkDone(task)
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
          aria-label="Mark task as done"
          title="Mark task as done"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Done
        </button>
      )}
    </li>
  )
}

function HomeTasksCard({
  title,
  subtitle,
  tasks,
  isLoading,
  emptyLabel,
  clientsById,
  employeesById,
  showAssignee,
  onOpenTasks,
  onSelectTask,
  onMarkDone,
}) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onOpenTasks}
          className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Open Tasks
        </button>
      </header>

      <ul className="mt-4 flex flex-col gap-2">
        {isLoading ? (
          <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            Loading…
          </li>
        ) : tasks.length === 0 ? (
          <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            {emptyLabel}
          </li>
        ) : (
          tasks.slice(0, 6).map((task) => (
            <HomeTaskItem
              key={task._id || task.id}
              task={task}
              clientsById={clientsById}
              employeesById={employeesById}
              showAssignee={showAssignee}
              onSelect={onSelectTask}
              onMarkDone={onMarkDone}
            />
          ))
        )}
      </ul>
    </article>
  )
}

function Home() {
  const navigate = useNavigate()
  const { error } = useNotification()
  const { profile } = useAuth()
  const isCrmEnabled = useFeature("crm")
  const [openTasks, setOpenTasks] = useState([])
  const [taskClientsById, setTaskClientsById] = useState(() => new Map())
  const [taskEmployeesById, setTaskEmployeesById] = useState(() => new Map())
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [viewingTask, setViewingTask] = useState(null)
  const [recentClients, setRecentClients] = useState(() => getRecentOpenedClients())
  const [employee, setEmployee] = useState({
    id: "",
    name: "",
    officeId: "",
    role: "",
  })
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)

  const loadDashboard = useCallback(async (officeId, options = {}) => {
    const safeOfficeId = String(officeId || "").trim()
    const notifyError = options?.notifyError !== false
    const actorId = String(profile?._id || profile?.id || "").trim()
    const cacheOptions = { actorId }
    const cachedDashboard = getCachedOfficeHomeDashboard(safeOfficeId, cacheOptions)

    if (!safeOfficeId) {
      setDashboard(EMPTY_DASHBOARD)
      return
    }

    if (cachedDashboard) {
      setDashboard(normalizeDashboardPayload(cachedDashboard))
    }

    try {
      const payload = await getOfficeHomeDashboard(safeOfficeId, {
        ...cacheOptions,
        noCache: true,
        backgroundLoadingMessage: cachedDashboard ? "Updating cached dashboard data..." : "",
      })
      setDashboard(normalizeDashboardPayload(payload))
    } catch (err) {
      if (!cachedDashboard) {
        setDashboard(EMPTY_DASHBOARD)
      }
      if (notifyError) {
        error(err.message || "Failed to load home dashboard")
      }
    }
  }, [error, profile?._id, profile?.id])

  const currentProfileId = String(profile?._id || profile?.id || "").trim()
  const tasksForMe = useMemo(
    () => openTasks.filter(
      (task) => task.status !== "done"
        && String(task.assigneeId || "") === currentProfileId
        && currentProfileId
    ),
    [openTasks, currentProfileId]
  )
  const tasksForTeam = useMemo(
    () => openTasks.filter((task) => task.status !== "done" && !task.assigneeId),
    [openTasks]
  )

  const calendarTasks = useMemo(
    () => openTasks.filter((task) => {
      if (!task?.dueDate) return false
      if (!task.assigneeId) return true
      return currentProfileId && String(task.assigneeId) === currentProfileId
    }),
    [openTasks, currentProfileId]
  )

  const handleHomeTaskMarkDone = async (task) => {
    if (!task?._id && !task?.id) return
    const id = String(task._id || task.id)
    try {
      const updated = await updateTask(id, { status: "done" })
      setOpenTasks((current) =>
        current.map((t) => (String(t._id || t.id) === id ? updated : t))
      )
      setViewingTask((current) =>
        current && String(current._id || current.id) === id ? updated : current
      )
    } catch (err) {
      error(err.message || "Failed to update task")
    }
  }

  const handleHomeTaskToggleStatus = async (task) => {
    if (!task?._id && !task?.id) return
    const id = String(task._id || task.id)
    const nextStatus = task.status === "done" ? "open" : "done"
    try {
      const updated = await updateTask(id, { status: nextStatus })
      setOpenTasks((current) =>
        current.map((t) => (String(t._id || t.id) === id ? updated : t))
      )
      setViewingTask((current) =>
        current && String(current._id || current.id) === id ? updated : current
      )
    } catch (err) {
      error(err.message || "Failed to update task")
    }
  }

  useEffect(() => {
    const officeId = String(profile?.officeId || "").trim()
    if (!isCrmEnabled || !officeId) {
      setOpenTasks([])
      setTaskClientsById(new Map())
      setTaskEmployeesById(new Map())
      return undefined
    }
    let active = true
    setIsLoadingTasks(true)
    Promise.all([
      listTasks({ status: "open" }).catch(() => []),
      listClientsByOfficeId(officeId, { limit: 500 }).catch(() => null),
      listEmployeesByOfficeId(officeId).catch(() => null),
    ])
      .then(([list, clientList, employeeList]) => {
        if (!active) return
        setOpenTasks(Array.isArray(list) ? list : [])
        const clientItems = Array.isArray(clientList?.items)
          ? clientList.items
          : Array.isArray(clientList)
            ? clientList
            : []
        const employeeItems = Array.isArray(employeeList?.items)
          ? employeeList.items
          : Array.isArray(employeeList)
            ? employeeList
            : []
        setTaskClientsById(new Map(clientItems.map((c) => [String(c._id || c.id), c])))
        setTaskEmployeesById(new Map(employeeItems.map((e) => [String(e._id || e.id), e])))
      })
      .finally(() => {
        if (active) setIsLoadingTasks(false)
      })
    return () => {
      active = false
    }
  }, [isCrmEnabled, profile?.officeId])

  useEffect(() => {
    setRecentClients(getRecentOpenedClients())
    const unsubscribe = subscribeRecentOpenedClients((items) => {
      setRecentClients(Array.isArray(items) ? items : [])
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const safeOfficeId = String(profile?.officeId || "").trim()
    setEmployee({
      id: String(profile?._id || ""),
      name: String(profile?.name || "User"),
      officeId: safeOfficeId,
      role: String(profile?.role || ""),
    })

    if (!profile) {
      setDashboard(EMPTY_DASHBOARD)
    }
  }, [profile])

  useEffect(() => {
    const safeOfficeId = String(employee.officeId || "").trim()
    if (!safeOfficeId) return undefined

    loadDashboard(safeOfficeId, { notifyError: true })

    const refreshSilently = () => {
      loadDashboard(safeOfficeId, { notifyError: false })
    }

    const refreshTimer = setInterval(refreshSilently, 15000)
    const unsubscribeDashboardRefresh = subscribeDashboardRefresh(refreshSilently)
    const onWindowFocus = () => refreshSilently()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSilently()
    }

    window.addEventListener("focus", onWindowFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      clearInterval(refreshTimer)
      unsubscribeDashboardRefresh()
      window.removeEventListener("focus", onWindowFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [employee.officeId, loadDashboard])

  return (
    <section className="w-full p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {dashboard.header.officeName || "Office"}
              </h1>
              <p className="text-sm text-gray-500">
                {employee.name} ({employee.role})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Last sync: {dashboard.header.lastSyncAt}
              </span>
            </div>
          </div>
        </header>

        <FeatureGate flag="crm">
          <TasksCalendar tasks={calendarTasks} onSelectTask={setViewingTask} defaultMode="week" />

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <HomeTasksCard
              title="Assigned to you"
              subtitle="Open tasks assigned to your user"
              tasks={tasksForMe}
              isLoading={isLoadingTasks}
              emptyLabel="Nothing assigned to you yet."
              clientsById={taskClientsById}
              employeesById={taskEmployeesById}
              showAssignee={false}
              onOpenTasks={() => navigate("/crm/tasks")}
              onSelectTask={setViewingTask}
              onMarkDone={handleHomeTaskMarkDone}
            />
            <HomeTasksCard
              title="Open for the team"
              subtitle="Tasks no one picked up yet"
              tasks={tasksForTeam}
              isLoading={isLoadingTasks}
              emptyLabel="No unassigned tasks."
              clientsById={taskClientsById}
              employeesById={taskEmployeesById}
              showAssignee={false}
              onOpenTasks={() => navigate("/crm/tasks")}
              onSelectTask={setViewingTask}
              onMarkDone={handleHomeTaskMarkDone}
            />
          </section>
        </FeatureGate>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Recently Opened Clients</h2>
          <p className="text-sm text-gray-500">Last 8 client contexts opened in this office</p>

          {recentClients.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">No clients opened yet</p>
          )}

          {recentClients.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              {recentClients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => navigate(client.to || `/clients/${client.id}/ledger`)}
                  >
                    <span className="truncate text-sm font-medium text-gray-900">{client.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-gray-500">{formatOpenedAt(client.openedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>


        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="text-sm text-gray-500">Latest office operations</p>

            <ul className="mt-4 flex flex-col gap-2">
              {dashboard.recentActivities.length === 0 && (
                <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No recent activities in the last 3 days
                </li>
              )}
              {dashboard.recentActivities.map((activity) => (
                <li key={activity.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{activity.detail}</p>
                </li>
              ))}
            </ul>
          </article>

          <aside className="flex flex-col gap-4">
            {/*
            <article className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-lg font-semibold">Office Alerts</h2>
              <p className="text-sm text-gray-500">Service signals requiring action</p>
              <ul className="mt-4 flex flex-col gap-2">
                {dashboard.alerts.map((alert) => (
                  <li key={alert} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {alert}
                  </li>
                ))}
              </ul>
            </article>
            */}

          </aside>
        </section>
      </div>

      <TaskDetailsModal
        task={viewingTask}
        client={viewingTask?.clientId ? taskClientsById.get(String(viewingTask.clientId)) : null}
        assignee={viewingTask?.assigneeId ? taskEmployeesById.get(String(viewingTask.assigneeId)) : null}
        onClose={() => setViewingTask(null)}
        onEdit={() => {
          setViewingTask(null)
          navigate("/crm/tasks")
        }}
        onToggleStatus={handleHomeTaskToggleStatus}
      />
    </section>
  )
}

export default Home
