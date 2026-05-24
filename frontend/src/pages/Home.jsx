import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import {
  getCachedOfficeHomeDashboard,
  getOfficeHomeDashboard,
  getOfficeOverview,
  getOfficeMyActivity,
} from "../services/home.service"
import {
  getRecentOpenedClients,
  subscribeRecentOpenedClients,
} from "../utils/recentClients"
import { subscribeDashboardRefresh } from "../utils/dashboardRefresh"
import { useFeature } from "../hooks/useFeature"
import FeatureGate from "../components/auth/FeatureGate"
import {
  listTasks,
  updateTaskById as updateTask,
  addTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from "../services/tasks.service"
import { listClientsByOfficeId } from "../services/clients.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import TaskEditModal from "../components/tasks/TaskEditModal"
import TasksTimeline from "../components/tasks/TasksTimeline"
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
  const [overview, setOverview] = useState(null)
  const [myActivity, setMyActivity] = useState([])
  // Scope toggle for the Pending / Reconciliation cards. We default to
  // "mine" but auto-fall back to "all" until the user has any recent
  // activity, otherwise the cards would always look empty for new users.
  const [overviewScope, setOverviewScope] = useState("mine")

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

  const applyHomeTaskUpdate = (updated) => {
    if (!updated) return
    setOpenTasks((current) =>
      current.map((t) => (String(t._id || t.id) === String(updated._id || updated.id) ? updated : t))
    )
    setViewingTask((current) =>
      current && String(current._id || current.id) === String(updated._id || updated.id) ? updated : current
    )
  }

  const handleHomeCreateComment = async (task, body) => {
    try {
      const updated = await addTaskComment(task._id || task.id, body)
      applyHomeTaskUpdate(updated)
    } catch (err) {
      error(err.message || "Failed to add comment")
      throw err
    }
  }

  const handleHomeUpdateComment = async (task, commentId, body) => {
    try {
      const updated = await updateTaskComment(task._id || task.id, commentId, body)
      applyHomeTaskUpdate(updated)
    } catch (err) {
      error(err.message || "Failed to update comment")
      throw err
    }
  }

  const handleHomeDeleteComment = async (task, commentId) => {
    try {
      const updated = await deleteTaskComment(task._id || task.id, commentId)
      applyHomeTaskUpdate(updated)
    } catch (err) {
      error(err.message || "Failed to delete comment")
      throw err
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
      // Fetch every status so done tasks still appear in the timeline,
      // sorted at the bottom of their day by TasksTimeline.
      listTasks().catch(() => []),
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

    let overviewActive = true
    const loadOverviewBundle = () => {
      getOfficeOverview(safeOfficeId)
        .then((data) => {
          if (overviewActive) setOverview(data || null)
        })
        .catch(() => {})
      getOfficeMyActivity(safeOfficeId)
        .then((payload) => {
          if (!overviewActive) return
          setMyActivity(Array.isArray(payload?.items) ? payload.items : [])
        })
        .catch(() => {})
    }
    loadOverviewBundle()

    const refreshSilently = () => {
      loadDashboard(safeOfficeId, { notifyError: false })
      loadOverviewBundle()
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
      overviewActive = false
      clearInterval(refreshTimer)
      unsubscribeDashboardRefresh()
      window.removeEventListener("focus", onWindowFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [employee.officeId, loadDashboard])

  return (
    <section className="w-full px-12 py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5">
        <header>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {dashboard.header.officeName || "Office"}
          </h1>
          <p className="text-sm text-gray-500">
            {employee.name} ({employee.role})
          </p>
        </header>

        <FeatureGate flag="crmTasks">
          <TasksTimeline
            tasks={openTasks}
            clientsById={taskClientsById}
            employeesById={taskEmployeesById}
            onSelect={setViewingTask}
            headerAction={(
              <button
                type="button"
                onClick={() => navigate("/board")}
                className="group inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gray-600 transition hover:text-gray-900"
              >
                Open Board
                <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </button>
            )}
          />
        </FeatureGate>

        <OfficeKpiRow kpis={overview?.kpis} />

        {(() => {
          const hasRecent = (overview?.myRecentClientCount || 0) > 0
          const effectiveScope = !hasRecent ? "all" : overviewScope
          const pending = effectiveScope === "mine"
            ? (overview?.pendingCategorizationMine || [])
            : (overview?.pendingCategorization || [])
          const reconc = effectiveScope === "mine"
            ? (overview?.reconciliationHealthMine || [])
            : (overview?.reconciliationHealth || [])
          return (
            <>
              <OverviewScopeToggle
                scope={effectiveScope}
                onChange={setOverviewScope}
                hasRecent={hasRecent}
              />
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <PendingCategorizationCard
                  items={pending}
                  scope={effectiveScope}
                  onOpenClient={(id) => navigate(`/clients/${id}/transactions`)}
                />
                <ReconciliationHealthCard
                  items={reconc}
                  scope={effectiveScope}
                  onOpenClient={(id) => navigate(`/clients/${id}/reconciliation`)}
                />
              </section>
            </>
          )
        })()}

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
                    onClick={() => navigate(client.to || `/clients/${client.id}/home`)}
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
          <MyActivityCard items={myActivity} />


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
        currentProfileId={currentProfileId}
        canCreateComment={hasPermission(profile?.permissions, "tasks:commentCreate")}
        canUpdateComment={hasPermission(profile?.permissions, "tasks:commentUpdate")}
        canDeleteComment={hasPermission(profile?.permissions, "tasks:commentDelete")}
        onCreateComment={handleHomeCreateComment}
        onUpdateComment={handleHomeUpdateComment}
        onDeleteComment={handleHomeDeleteComment}
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

const ACTIVITY_LABELS = {
  "task.created": "Created task",
  "task.deleted": "Deleted task",
  "task.status.open": "Reopened task",
  "task.status.in_progress": "Started task",
  "task.status.done": "Completed task",
  "task.comment.added": "Commented on task",
  "client.created": "Created client",
  "client.deleted": "Deleted client",
  "client.note.added": "Added note on client",
  "client.note.updated": "Edited note on client",
  "client.note.deleted": "Deleted note on client",
  "period.closed": "Closed period",
  "period.reopened": "Reopened period",
  "reconciliation.completed": "Completed reconciliation",
  "reconciliation.reopened": "Reopened reconciliation",
  "recurring.created": "Created recurring rule",
  "recurring.runOnce": "Ran recurring rule once",
}

function formatActivityRelativeTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const diffMs = Date.now() - d.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function MyActivityCard({ items }) {
  const list = Array.isArray(items) ? items : []
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Your activity</h2>
      <p className="text-sm text-gray-500">Recent actions you took in this office</p>

      <ul className="mt-4 flex flex-col gap-2">
        {list.length === 0 && (
          <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            Nothing to show yet — actions you take will appear here.
          </li>
        )}
        {list.map((entry) => {
          const title = ACTIVITY_LABELS[entry.action] || entry.action
          return (
            <li key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{title}</p>
                <span className="text-xs text-gray-500">{formatActivityRelativeTime(entry.at)}</span>
              </div>
              {entry.label && (
                <p className="mt-1 text-sm text-gray-600">{entry.label}</p>
              )}
            </li>
          )
        })}
      </ul>
    </article>
  )
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0))
}

function OfficeKpiRow({ kpis }) {
  const items = [
    { label: "Active clients", value: kpis?.activeClients ?? 0 },
    { label: "Uncategorized", value: kpis?.uncategorizedTotal ?? 0, accent: kpis?.uncategorizedTotal > 0 ? "warn" : null },
    { label: "Open tasks", value: kpis?.openTasks ?? 0 },
    { label: "Unreconciled bank legs", value: kpis?.unreconciledLegs ?? 0, accent: kpis?.unreconciledLegs > 0 ? "warn" : null },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              item.accent === "warn" ? "text-amber-600" : "text-gray-900"
            }`}
          >
            {formatNumber(item.value)}
          </p>
        </div>
      ))}
    </div>
  )
}

function OverviewScopeToggle({ scope, onChange, hasRecent }) {
  const baseClass = "rounded-md px-3 py-1.5 text-sm font-medium transition"
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">
        {scope === "mine" ? "Showing clients you worked on recently" : "Showing the whole office"}
      </p>
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        <button
          type="button"
          onClick={() => onChange("mine")}
          disabled={!hasRecent}
          className={`${baseClass} ${
            scope === "mine" ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          title={hasRecent ? "Only clients you touched in the last 30 days" : "No recent activity yet — start working on clients to populate this view"}
        >
          Mine
        </button>
        <button
          type="button"
          onClick={() => onChange("all")}
          className={`${baseClass} ${
            scope === "all" ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Office
        </button>
      </div>
    </div>
  )
}

function PendingCategorizationCard({ items, scope, onOpenClient }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Pending Categorization</h2>
        <span className="text-xs text-gray-500">{scope === "mine" ? "Mine" : "Top across office"}</span>
      </header>
      <p className="text-sm text-gray-500">Clients with transactions still in suspense</p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          {scope === "mine"
            ? "None of the clients you worked on recently have uncategorized transactions."
            : "All clear — no uncategorized transactions."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.clientId}>
              <button
                type="button"
                onClick={() => onOpenClient?.(item.clientId)}
                className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-gray-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {item.clientName || "Client"}
                  </span>
                  {item.oldestDate && (
                    <span className="block text-[11px] text-gray-500">
                      Oldest: {item.oldestDate}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-semibold text-amber-700 tabular-nums">
                  {formatNumber(item.count)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function ReconciliationHealthCard({ items, scope, onOpenClient }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Reconciliation Health</h2>
        <span className="text-xs text-gray-500">{scope === "mine" ? "Mine" : "Top across office"}</span>
      </header>
      <p className="text-sm text-gray-500">Bank legs not yet cleared</p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          {scope === "mine"
            ? "Clients you worked on recently are all clear."
            : "Everything cleared."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.clientId}>
              <button
                type="button"
                onClick={() => onOpenClient?.(item.clientId)}
                className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-gray-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {item.clientName || "Client"}
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    {formatNumber(item.accountsWithUncleared)} account{item.accountsWithUncleared === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[12px] font-semibold text-rose-700 tabular-nums">
                  {formatNumber(item.unclearedLegs)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default Home
