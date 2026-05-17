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
import TaskCard from "../components/tasks/TaskCard"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import TaskEditModal from "../components/tasks/TaskEditModal"
import TasksCalendar from "../components/tasks/TasksCalendar"
import { hasPermission } from "../utils/permissions"

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

function HomeTasksCard({
  title,
  subtitle,
  groups = [],
  isLoading,
  clientsById,
  employeesById,
  onOpenTasks,
  onSelectTask,
}) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onOpenTasks}
          className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Open Tasks
        </button>
      </header>

      {isLoading ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Loading…
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <section key={group.key}>
              <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {group.title}
              </p>
              <ul className="flex flex-col gap-2">
                {group.tasks.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    {group.emptyLabel}
                  </li>
                ) : (
                  group.tasks.slice(0, 6).map((task) => (
                    <TaskCard
                      key={task._id || task.id}
                      task={task}
                      clientById={clientsById}
                      employeeById={employeesById}
                      onSelect={onSelectTask}
                    />
                  ))
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
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
  const [editingTask, setEditingTask] = useState(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSavingTask, setIsSavingTask] = useState(false)
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
  const getTaskAssigneeIds = (task) => {
    if (Array.isArray(task?.assigneeIds) && task.assigneeIds.length > 0) {
      return task.assigneeIds.map(String)
    }
    return task?.assigneeId ? [String(task.assigneeId)] : []
  }
  const tasksForMe = useMemo(
    () => openTasks.filter((task) => {
      if (task.status === "done" || !currentProfileId) return false
      return getTaskAssigneeIds(task).includes(currentProfileId)
    }),
    [openTasks, currentProfileId]
  )
  const tasksForTeam = useMemo(
    () => openTasks.filter((task) => task.status !== "done" && getTaskAssigneeIds(task).length === 0),
    [openTasks]
  )
  const myAndTeamTasks = useMemo(
    () => [...tasksForMe, ...tasksForTeam],
    [tasksForMe, tasksForTeam]
  )

  const calendarTasks = useMemo(
    () => openTasks.filter((task) => {
      if (!task?.dueDate) return false
      const ids = getTaskAssigneeIds(task)
      if (ids.length === 0) return true
      return currentProfileId && ids.includes(currentProfileId)
    }),
    [openTasks, currentProfileId]
  )

  const handleHomeTaskEdit = (task) => {
    setEditingTask(task)
    setIsEditOpen(true)
  }

  const handleHomeTaskEditSave = async (draft) => {
    if (!editingTask?._id && !editingTask?.id) return
    const id = String(editingTask._id || editingTask.id)
    try {
      setIsSavingTask(true)
      const updated = await updateTask(id, draft)
      setOpenTasks((current) =>
        current.map((t) => (String(t._id || t.id) === id ? updated : t))
      )
      setViewingTask((current) =>
        current && String(current._id || current.id) === id ? updated : current
      )
      setIsEditOpen(false)
      setEditingTask(null)
    } catch (err) {
      error(err.message || "Failed to update task")
    } finally {
      setIsSavingTask(false)
    }
  }

  const handleHomeTaskChangeStatus = async (task, nextStatus) => {
    if (!task?._id && !task?.id) return
    const id = String(task._id || task.id)
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
      listTasks({ status: "active" }).catch(() => []),
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
    <section className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-5">
        <header className="rounded-xl border border-gray-200 bg-white p-4">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {dashboard.header.officeName || "Office"}
          </h1>
          <p className="text-sm text-gray-500">
            {employee.name} ({employee.role})
          </p>
        </header>

        <FeatureGate flag="crmTasks">
          <TasksCalendar tasks={calendarTasks} onSelectTask={setViewingTask} defaultMode="day" />

          <HomeTasksCard
            title="Your tasks"
            isLoading={isLoadingTasks}
            groups={[
              {
                key: "me",
                title: "Assigned to you",
                tasks: tasksForMe,
                emptyLabel: "Nothing assigned to you yet.",
              },
              {
                key: "team",
                title: "Open for the team",
                tasks: tasksForTeam,
                emptyLabel: "No unassigned tasks.",
              },
            ]}
            clientsById={taskClientsById}
            employeesById={taskEmployeesById}
            onOpenTasks={() => navigate("/crm/tasks")}
            onSelectTask={setViewingTask}
          />
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


        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
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
        task={isEditOpen ? null : viewingTask}
        clientList={
          viewingTask
            ? (Array.isArray(viewingTask.clientIds) && viewingTask.clientIds.length > 0
                ? viewingTask.clientIds
                : (viewingTask.clientId ? [viewingTask.clientId] : []))
                .map((id) => taskClientsById.get(String(id)))
                .filter(Boolean)
            : []
        }
        assigneeList={
          viewingTask
            ? (Array.isArray(viewingTask.assigneeIds) && viewingTask.assigneeIds.length > 0
                ? viewingTask.assigneeIds
                : (viewingTask.assigneeId ? [viewingTask.assigneeId] : []))
                .map((id) => taskEmployeesById.get(String(id)))
                .filter(Boolean)
            : []
        }
        onClose={() => setViewingTask(null)}
        onEdit={(task) => handleHomeTaskEdit(task)}
        onChangeStatus={handleHomeTaskChangeStatus}
        canViewStatusHistory={hasPermission(profile?.permissions, "tasks:readStatusHistory")}
      />

      <TaskEditModal
        isOpen={isEditOpen}
        task={editingTask}
        clients={Array.from(taskClientsById.values())}
        employees={Array.from(taskEmployeesById.values())}
        isSaving={isSavingTask}
        onCancel={() => {
          setIsEditOpen(false)
          setEditingTask(null)
        }}
        onSubmit={handleHomeTaskEditSave}
      />
    </section>
  )
}

export default Home
