import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { listClientsByOfficeId } from "../services/clients.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import TaskCard from "../components/tasks/TaskCard"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import TaskEditModal from "../components/tasks/TaskEditModal"
import TaskFiltersModal, { EMPTY_TASK_FILTERS, countActiveFilters } from "../components/tasks/TaskFiltersModal"
import {
    listTasks,
    createTask,
    updateTaskById,
    deleteTaskById,
    addTaskComment,
    updateTaskComment,
    deleteTaskComment,
} from "../services/tasks.service"
import { hasPermission } from "../utils/permissions"

function toIdArray(task, plural, singular) {
    if (Array.isArray(task?.[plural])) return task[plural].map(String).filter(Boolean)
    if (task?.[singular]) return [String(task[singular])]
    return []
}


function TasksPage() {
    const { profile } = useAuth()
    const { success, error } = useNotification()

    const officeId = String(profile?.officeId || "").trim()
    const canViewStatusHistory = hasPermission(profile?.permissions, "tasks:readStatusHistory")
    const canCreateComment = hasPermission(profile?.permissions, "tasks:commentCreate")
    const canUpdateComment = hasPermission(profile?.permissions, "tasks:commentUpdate")
    const canDeleteComment = hasPermission(profile?.permissions, "tasks:commentDelete")

    const [tasks, setTasks] = useState([])
    const [clients, setClients] = useState([])
    const [employees, setEmployees] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [appliedFilters, setAppliedFilters] = useState(EMPTY_TASK_FILTERS)
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const currentProfileId = String(profile?._id || profile?.id || "").trim()
    const activeFiltersCount = countActiveFilters(appliedFilters)

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState(null)
    const [viewingTask, setViewingTask] = useState(null)
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

    const reloadTasks = useCallback(async () => {
        if (!officeId) return
        try {
            const filters = {}
            if (appliedFilters.status && appliedFilters.status !== "all") filters.status = appliedFilters.status
            if (appliedFilters.priority && appliedFilters.priority !== "all") filters.priority = appliedFilters.priority
            if (appliedFilters.clientId) filters.clientId = appliedFilters.clientId
            if (appliedFilters.assigneeId) filters.assigneeId = appliedFilters.assigneeId
            if (appliedFilters.from) filters.from = appliedFilters.from
            if (appliedFilters.to) filters.to = appliedFilters.to
            const list = await listTasks(filters)
            setTasks(Array.isArray(list) ? list : [])
        } catch (err) {
            error(err.message || "Failed to load tasks")
        }
    }, [appliedFilters, error, officeId])

    const tasksForMe = useMemo(
        () => tasks.filter((t) => {
            if (!currentProfileId) return false
            const ids = toIdArray(t, "assigneeIds", "assigneeId")
            return ids.includes(currentProfileId)
        }),
        [tasks, currentProfileId]
    )
    const tasksForTeam = useMemo(
        () => tasks.filter((t) => toIdArray(t, "assigneeIds", "assigneeId").length === 0),
        [tasks]
    )

    useEffect(() => {
        let active = true
        async function bootstrap() {
            if (!officeId) {
                setIsLoading(false)
                return
            }
            try {
                setIsLoading(true)
                const [clientList, employeeList] = await Promise.all([
                    listClientsByOfficeId(officeId, { limit: 500 }).catch(() => null),
                    listEmployeesByOfficeId(officeId).catch(() => null),
                ])
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
                await reloadTasks()
            } catch (err) {
                if (!active) return
                error(err.message || "Failed to load tasks page")
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }
        bootstrap()
        return () => {
            active = false
        }
    }, [error, officeId, reloadTasks])

    useEffect(() => {
        if (!isLoading) reloadTasks()
    }, [appliedFilters, isLoading, reloadTasks])

    const openCreate = () => {
        setEditingTask(null)
        setIsFormOpen(true)
    }

    const openEdit = (task) => {
        setEditingTask(task)
        setIsFormOpen(true)
    }

    const openView = (task) => {
        setViewingTask(task)
    }

    const closeView = () => {
        setViewingTask(null)
    }

    const closeForm = () => {
        setIsFormOpen(false)
        setEditingTask(null)
    }

    const handleSave = async (draft) => {
        try {
            setIsSaving(true)
            if (editingTask) {
                const updated = await updateTaskById(editingTask._id || editingTask.id, draft)
                setTasks((current) =>
                    current.map((t) => (String(t._id || t.id) === String(updated._id || updated.id) ? updated : t))
                )
                setViewingTask((current) =>
                    current && String(current._id || current.id) === String(updated._id || updated.id)
                        ? updated
                        : current
                )
                success("Task updated")
            } else {
                const created = await createTask(draft)
                setTasks((current) => [created, ...current])
                success("Task created")
            }
            closeForm()
        } catch (err) {
            error(err.message || "Failed to save task")
        } finally {
            setIsSaving(false)
        }
    }

    const handleChangeStatus = async (task, nextStatus) => {
        try {
            const updated = await updateTaskById(task._id || task.id, { status: nextStatus })
            setTasks((current) =>
                current.map((t) => (String(t._id || t.id) === String(updated._id || updated.id) ? updated : t))
            )
            setViewingTask((current) =>
                current && String(current._id || current.id) === String(updated._id || updated.id)
                    ? updated
                    : current
            )
        } catch (err) {
            error(err.message || "Failed to update task")
        }
    }

    const handleDelete = async (task) => {
        if (!window.confirm("Delete this task?")) return
        try {
            await deleteTaskById(task._id || task.id)
            setTasks((current) => current.filter((t) => String(t._id || t.id) !== String(task._id || task.id)))
            setViewingTask((current) =>
                current && String(current._id || current.id) === String(task._id || task.id) ? null : current
            )
            success("Task deleted")
        } catch (err) {
            error(err.message || "Failed to delete task")
        }
    }

    const applyTaskUpdate = (updated) => {
        if (!updated) return
        setTasks((current) =>
            current.map((t) => (String(t._id || t.id) === String(updated._id || updated.id) ? updated : t))
        )
        setViewingTask((current) =>
            current && String(current._id || current.id) === String(updated._id || updated.id) ? updated : current
        )
    }

    const handleCreateComment = async (task, body) => {
        try {
            const updated = await addTaskComment(task._id || task.id, body)
            applyTaskUpdate(updated)
        } catch (err) {
            error(err.message || "Failed to add comment")
            throw err
        }
    }

    const handleUpdateComment = async (task, commentId, body) => {
        try {
            const updated = await updateTaskComment(task._id || task.id, commentId, body)
            applyTaskUpdate(updated)
        } catch (err) {
            error(err.message || "Failed to update comment")
            throw err
        }
    }

    const handleDeleteComment = async (task, commentId) => {
        try {
            const updated = await deleteTaskComment(task._id || task.id, commentId)
            applyTaskUpdate(updated)
        } catch (err) {
            error(err.message || "Failed to delete comment")
            throw err
        }
    }

    return (
        <section className="w-full p-4 sm:p-6 lg:p-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:gap-6">
                <header className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold sm:text-3xl">Tasks</h1>
                        <p className="mt-2 hidden text-sm text-gray-500 sm:block">
                            Operational tasks for your office. Link a client, an assignee or a due date — all optional.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFiltersOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:gap-2 sm:px-3"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 4h18l-7 9v6l-4-2v-4z" />
                            </svg>
                            <span className="hidden sm:inline">Filters</span>
                            {activeFiltersCount > 0 && (
                                <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                        {activeFiltersCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setAppliedFilters(EMPTY_TASK_FILTERS)}
                                className="hidden rounded-lg px-2 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 sm:inline-flex"
                                title="Clear filters"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={openCreate}
                            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black sm:px-4"
                        >
                            <span className="hidden sm:inline">New task</span>
                            <span className="sm:hidden">+ New</span>
                        </button>
                    </div>
                </header>

                {isLoading ? (
                    <p className="text-sm text-gray-500">Loading tasks…</p>
                ) : tasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center">
                        <p className="text-sm text-gray-500">No tasks yet.</p>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="mt-3 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Create the first one
                        </button>
                    </div>
                ) : (() => {
                    const assigneeFilterId = appliedFilters.assigneeId
                    const filteredAssignee = assigneeFilterId ? employeeById.get(String(assigneeFilterId)) : null
                    const columns = assigneeFilterId
                        ? [{
                            key: "assignee",
                            title: filteredAssignee?.name || filteredAssignee?.email || "Selected assignee",
                            subtitle: "Tasks filtered by assignee",
                            items: tasks,
                            emptyLabel: "No tasks for this person.",
                        }]
                        : [
                            {
                                key: "me",
                                title: "Assigned to you",
                                subtitle: "Open tasks on your name",
                                items: tasksForMe,
                                emptyLabel: "Nothing assigned to you.",
                            },
                            {
                                key: "team",
                                title: "Open for the team",
                                subtitle: "Tasks no one picked up yet",
                                items: tasksForTeam,
                                emptyLabel: "No unassigned tasks.",
                            },
                        ]

                    return (
                    <div className={`grid grid-cols-1 gap-4 ${columns.length > 1 ? "md:grid-cols-2" : ""}`}>
                        {columns.map((column) => (
                            <section
                                key={column.key}
                                className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                            >
                                <header className="flex items-baseline justify-between gap-2">
                                    <div>
                                        <h2 className="text-sm font-semibold text-gray-900">{column.title}</h2>
                                        <p className="text-xs text-gray-500">{column.subtitle}</p>
                                    </div>
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                                        {column.items.length}
                                    </span>
                                </header>

                                {column.items.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
                                        {column.emptyLabel}
                                    </p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {column.items.map((task) => (
                                            <TaskCard
                                                key={task._id || task.id}
                                                task={task}
                                                clientById={clientById}
                                                employeeById={employeeById}
                                                onSelect={openView}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </div>
                    )
                })()}
            </div>

            <TaskEditModal
                isOpen={isFormOpen}
                task={editingTask}
                clients={clients}
                employees={employees}
                isSaving={isSaving}
                onCancel={closeForm}
                onSubmit={handleSave}
            />

            <TaskDetailsModal
                task={isFormOpen ? null : viewingTask}
                clientList={
                    viewingTask
                        ? toIdArray(viewingTask, "clientIds", "clientId")
                              .map((id) => clientById.get(String(id)))
                              .filter(Boolean)
                        : []
                }
                assigneeList={
                    viewingTask
                        ? toIdArray(viewingTask, "assigneeIds", "assigneeId")
                              .map((id) => employeeById.get(String(id)))
                              .filter(Boolean)
                        : []
                }
                onClose={closeView}
                onEdit={(task) => openEdit(task)}
                onChangeStatus={handleChangeStatus}
                onDelete={handleDelete}
                canViewStatusHistory={canViewStatusHistory}
                currentProfileId={currentProfileId}
                canCreateComment={canCreateComment}
                canUpdateComment={canUpdateComment}
                canDeleteComment={canDeleteComment}
                onCreateComment={handleCreateComment}
                onUpdateComment={handleUpdateComment}
                onDeleteComment={handleDeleteComment}
            />

            <TaskFiltersModal
                isOpen={isFiltersOpen}
                filters={appliedFilters}
                clients={clients}
                employees={employees}
                onCancel={() => setIsFiltersOpen(false)}
                onApply={(next) => {
                    setAppliedFilters(next)
                    setIsFiltersOpen(false)
                }}
            />
        </section>
    )
}

export default TasksPage
