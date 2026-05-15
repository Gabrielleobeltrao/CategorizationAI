import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { listTasks, updateTaskById, deleteTaskById } from "../services/tasks.service"
import { listClientsByOfficeId } from "../services/clients.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import PerformanceOverview from "../components/dashboard/PerformanceOverview"
import OverviewScopeFilter from "../components/dashboard/OverviewScopeFilter"
import TaskCard from "../components/tasks/TaskCard"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import TaskEditModal from "../components/tasks/TaskEditModal"

const MS_PER_DAY = 1000 * 60 * 60 * 24

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseAnyDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function buildCrmCustomData(tasks, range) {
  if (!range?.from || !range?.to) return { kpis: [], trend: [] }
  const start = new Date(`${range.from}T00:00:00`)
  const end = new Date(`${range.to}T23:59:59.999`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { kpis: [], trend: [] }
  }

  let created = 0
  let open = 0
  let inProgress = 0
  let done = 0

  const dayMs = 86400000
  const diffDays = Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / dayMs) + 1
  const useDailyBuckets = diffDays <= 31
  const bucketCount = useDailyBuckets ? diffDays : Math.ceil(diffDays / 7)
  const bucketStep = useDailyBuckets ? dayMs : 7 * dayMs
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketStart = new Date(startOfDay(start).getTime() + i * bucketStep)
    return {
      bucket: useDailyBuckets
        ? bucketStart.toLocaleString("en-US", { month: "short", day: "numeric" })
        : `Week ${i + 1}`,
      created: 0,
      open: 0,
      inProgress: 0,
      done: 0,
    }
  })

  const bucketIndexFor = (date) => {
    if (!date) return -1
    const idx = Math.floor((startOfDay(date).getTime() - startOfDay(start).getTime()) / bucketStep)
    return idx >= 0 && idx < buckets.length ? idx : -1
  }

  tasks.forEach((task) => {
    if (!task) return
    const createdAt = parseAnyDate(task.createdAt)
    const doneAt = parseAnyDate(task.doneAt)
    const inRange = (date) => date && date >= start && date <= end
    const status = task.status || "open"

    if (inRange(createdAt)) {
      created += 1
      const idx = bucketIndexFor(createdAt)
      if (idx !== -1) {
        buckets[idx].created += 1
        if (status === "open") buckets[idx].open += 1
        else if (status === "in_progress") buckets[idx].inProgress += 1
      }
      if (status === "open") open += 1
      else if (status === "in_progress") inProgress += 1
    }
    if (inRange(doneAt) && status === "done") {
      done += 1
      const idx = bucketIndexFor(doneAt)
      if (idx !== -1) buckets[idx].done += 1
    }
  })

  return {
    kpis: [
      { id: "open-custom", label: "Tasks Open", value: String(open) },
      { id: "in-progress-custom", label: "Tasks In Progress", value: String(inProgress) },
      { id: "done-custom", label: "Tasks Done", value: String(done) },
      { id: "created-custom", label: "Tasks Created", value: String(created) },
    ],
    trend: buckets,
  }
}

function CrmDashboardPage() {
  const { profile, office } = useAuth()
  const { error, success } = useNotification()
  const officeId = String(profile?.officeId || "").trim()
  const officeName = String(office?.name || "").trim()

  const [tasks, setTasks] = useState([])
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(Boolean(officeId))
  const [scopeMode, setScopeMode] = useState("team")
  const [scopeId, setScopeId] = useState("")
  const [customRange, setCustomRange] = useState(null)
  const [viewingTask, setViewingTask] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const clientById = useMemo(() => {
    const map = new Map()
    clients.forEach((c) => map.set(String(c._id || c.id), c))
    return map
  }, [clients])
  const employeeById = useMemo(() => {
    const map = new Map()
    employees.forEach((e) => map.set(String(e._id || e.id), e))
    return map
  }, [employees])

  const taskFilters = useMemo(() => {
    if (scopeMode === "client" && scopeId) return { clientId: scopeId }
    if (scopeMode === "user" && scopeId) return { assigneeId: scopeId }
    return {}
  }, [scopeMode, scopeId])

  useEffect(() => {
    if (!officeId) return undefined
    let active = true

    Promise.all([
      listClientsByOfficeId(officeId, { limit: 500 }).catch(() => null),
      listEmployeesByOfficeId(officeId).catch(() => null),
    ]).then(([clientList, employeeList]) => {
      if (!active) return
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
      setClients(clientItems)
      setEmployees(employeeItems)
    })

    return () => { active = false }
  }, [officeId])

  useEffect(() => {
    if (!officeId) return undefined
    let active = true

    listTasks(taskFilters)
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
  }, [error, officeId, taskFilters])

  const { kpis: customKpis, trend: customTrend } = useMemo(
    () => buildCrmCustomData(tasks, customRange),
    [tasks, customRange]
  )

  const tasksInRange = useMemo(() => {
    if (!customRange?.from || !customRange?.to) return tasks
    const start = new Date(`${customRange.from}T00:00:00`)
    const end = new Date(`${customRange.to}T23:59:59.999`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return tasks
    return tasks.filter((task) => {
      const createdAt = task?.createdAt ? new Date(task.createdAt) : null
      const doneAt = task?.doneAt ? new Date(task.doneAt) : null
      const createdInRange = createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt <= end
      const doneInRange = doneAt && !Number.isNaN(doneAt.getTime()) && doneAt >= start && doneAt <= end
      return createdInRange || doneInRange
    })
  }, [tasks, customRange])

  const handleChangeStatus = async (task, nextStatus) => {
    const id = String(task._id || task.id || "")
    if (!id) return
    try {
      const updated = await updateTaskById(id, { status: nextStatus })
      setTasks((current) => current.map((t) => (String(t._id || t.id) === id ? updated : t)))
      setViewingTask((current) => (current && String(current._id || current.id) === id ? updated : current))
    } catch (err) {
      error(err.message || "Failed to update task")
    }
  }

  const handleDelete = async (task) => {
    const id = String(task._id || task.id || "")
    if (!id) return
    if (!window.confirm("Delete this task?")) return
    try {
      await deleteTaskById(id)
      setTasks((current) => current.filter((t) => String(t._id || t.id) !== id))
      setViewingTask((current) => (current && String(current._id || current.id) === id ? null : current))
      success("Task deleted")
    } catch (err) {
      error(err.message || "Failed to delete task")
    }
  }

  const handleEditOpen = (task) => {
    setEditingTask(task)
    setIsEditOpen(true)
  }

  const handleEditSave = async (draft) => {
    if (!editingTask?._id && !editingTask?.id) return
    const id = String(editingTask._id || editingTask.id)
    try {
      setIsSaving(true)
      const updated = await updateTaskById(id, draft)
      setTasks((current) => current.map((t) => (String(t._id || t.id) === id ? updated : t)))
      setViewingTask((current) => (current && String(current._id || current.id) === id ? updated : current))
      setIsEditOpen(false)
      setEditingTask(null)
      success("Task updated")
    } catch (err) {
      error(err.message || "Failed to save task")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="w-full p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">CRM Operacional Overview</h1>
            <p className="mt-2 text-sm text-gray-500">
              Task metrics across the selected scope.
            </p>
          </div>
          <OverviewScopeFilter
            mode={scopeMode}
            scopeId={scopeId}
            onChange={({ mode, scopeId: nextScopeId }) => {
              setScopeMode(mode)
              setScopeId(nextScopeId)
            }}
            clients={clients}
            users={employees}
            officeName={officeName}
          />
        </header>

        <PerformanceOverview
          title="Task Overview"
          subtitle="Task metrics for the selected range"
          kpis={customKpis}
          trend={customTrend}
          range={customRange}
          onRangeChange={setCustomRange}
          isLoading={isLoading}
          chartSeries={[
            { key: "open", label: "Open", color: "#6b7280" },
            { key: "inProgress", label: "In Progress", color: "#d97706" },
            { key: "done", label: "Done", color: "#16a34a" },
            { key: "created", label: "Created", color: "#2563eb" },
          ]}
          footer={
            <div>
              <header className="flex items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Tasks</h3>
                  <p className="text-sm text-gray-500">Filtered by current scope and date range</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                  {tasksInRange.length}
                </span>
              </header>
              {tasksInRange.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                  No tasks match the current filter.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {tasksInRange.map((task) => (
                    <TaskCard
                      key={task._id || task.id}
                      task={task}
                      clientById={clientById}
                      employeeById={employeeById}
                      onSelect={setViewingTask}
                    />
                  ))}
                </ul>
              )}
            </div>
          }
        />
      </div>

      <TaskDetailsModal
        task={isEditOpen ? null : viewingTask}
        clientList={
          viewingTask
            ? (Array.isArray(viewingTask.clientIds) && viewingTask.clientIds.length > 0
                ? viewingTask.clientIds
                : (viewingTask.clientId ? [viewingTask.clientId] : []))
                .map((id) => clientById.get(String(id)))
                .filter(Boolean)
            : []
        }
        assigneeList={
          viewingTask
            ? (Array.isArray(viewingTask.assigneeIds) && viewingTask.assigneeIds.length > 0
                ? viewingTask.assigneeIds
                : (viewingTask.assigneeId ? [viewingTask.assigneeId] : []))
                .map((id) => employeeById.get(String(id)))
                .filter(Boolean)
            : []
        }
        onClose={() => setViewingTask(null)}
        onEdit={handleEditOpen}
        onChangeStatus={handleChangeStatus}
        onDelete={handleDelete}
      />

      <TaskEditModal
        isOpen={isEditOpen}
        task={editingTask}
        clients={clients}
        employees={employees}
        isSaving={isSaving}
        onCancel={() => {
          setIsEditOpen(false)
          setEditingTask(null)
        }}
        onSubmit={handleEditSave}
      />
    </section>
  )
}

export default CrmDashboardPage
