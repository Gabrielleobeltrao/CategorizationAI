import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { listClientsByOfficeId } from "../services/clients.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import Combobox from "../components/ui/Combobox"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import {
    listTasks,
    createTask,
    updateTaskById,
    deleteTaskById,
} from "../services/tasks.service"

const STATUS_OPTIONS = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "done", label: "Done" },
]

const EMPTY_DRAFT = {
    title: "",
    description: "",
    clientId: "",
    assigneeId: "",
    dueDate: "",
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


function TasksPage() {
    const { profile } = useAuth()
    const { success, error } = useNotification()

    const officeId = String(profile?.officeId || "").trim()

    const [tasks, setTasks] = useState([])
    const [clients, setClients] = useState([])
    const [employees, setEmployees] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState("open")
    const [clientFilter, setClientFilter] = useState("")
    const [assigneeFilter, setAssigneeFilter] = useState("")
    const currentProfileId = String(profile?._id || profile?.id || "").trim()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState(null)
    const [viewingTask, setViewingTask] = useState(null)
    const [draft, setDraft] = useState(EMPTY_DRAFT)
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
            if (statusFilter !== "all") filters.status = statusFilter
            if (clientFilter) filters.clientId = clientFilter
            if (assigneeFilter) filters.assigneeId = assigneeFilter
            const list = await listTasks(filters)
            setTasks(Array.isArray(list) ? list : [])
        } catch (err) {
            error(err.message || "Failed to load tasks")
        }
    }, [assigneeFilter, clientFilter, error, officeId, statusFilter])

    const tasksForMe = useMemo(
        () => tasks.filter((t) => currentProfileId && String(t.assigneeId || "") === currentProfileId),
        [tasks, currentProfileId]
    )
    const tasksForTeam = useMemo(
        () => tasks.filter((t) => !t.assigneeId),
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
    }, [statusFilter, clientFilter, assigneeFilter, isLoading, reloadTasks])

    const openCreate = () => {
        setEditingTask(null)
        setDraft(EMPTY_DRAFT)
        setIsFormOpen(true)
    }

    const openEdit = (task) => {
        setViewingTask(null)
        setEditingTask(task)
        setDraft({
            title: String(task.title || ""),
            description: String(task.description || ""),
            clientId: String(task.clientId || ""),
            assigneeId: String(task.assigneeId || ""),
            dueDate: String(task.dueDate || ""),
        })
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
        setDraft(EMPTY_DRAFT)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        try {
            setIsSaving(true)
            if (editingTask) {
                const updated = await updateTaskById(editingTask._id || editingTask.id, draft)
                setTasks((current) =>
                    current.map((t) => (String(t._id || t.id) === String(updated._id || updated.id) ? updated : t))
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

    const handleToggleStatus = async (task) => {
        const nextStatus = task.status === "done" ? "open" : "done"
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
            success("Task deleted")
        } catch (err) {
            error(err.message || "Failed to delete task")
        }
    }

    return (
        <section className="w-full p-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Tasks</h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Operational tasks for your office. Link a client, an assignee or a due date — all optional.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                    >
                        New task
                    </button>
                </header>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Combobox
                        label="Status"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={STATUS_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
                    />
                    <Combobox
                        label="Client"
                        value={clientFilter}
                        onChange={setClientFilter}
                        searchable
                        searchPlaceholder="Search clients"
                        options={[
                            { value: "", label: "All clients" },
                            ...clients.map((c) => ({
                                value: String(c._id || c.id),
                                label: c.name || "Unnamed",
                            })),
                        ]}
                    />
                    <Combobox
                        label="Assignee"
                        value={assigneeFilter}
                        onChange={setAssigneeFilter}
                        searchable
                        searchPlaceholder="Search assignees"
                        options={[
                            { value: "", label: "Everyone (split by you / team)" },
                            ...employees.map((emp) => ({
                                value: String(emp._id || emp.id),
                                label: emp.name || emp.email || "—",
                            })),
                        ]}
                    />
                </div>

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
                    const filteredAssignee = assigneeFilter ? employeeById.get(String(assigneeFilter)) : null
                    const columns = assigneeFilter
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
                                        {column.items.map((task) => {
                                            const client = task.clientId ? clientById.get(String(task.clientId)) : null
                                            const assignee = task.assigneeId ? employeeById.get(String(task.assigneeId)) : null
                                            const isDone = task.status === "done"
                                            return (
                                                <li
                                                    key={task._id || task.id}
                                                    className={`flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3 ${isDone ? "opacity-70" : ""}`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => openView(task)}
                                                        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                                                    >
                                                        <p className={`text-sm font-medium ${isDone ? "text-gray-500 line-through" : "text-gray-900"}`}>
                                                            {task.title || "(Untitled)"}
                                                        </p>
                                                        {task.description && (
                                                            <p className="line-clamp-2 text-xs text-gray-500">{task.description}</p>
                                                        )}
                                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                                                            {client && (
                                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                                                    {client.name}
                                                                </span>
                                                            )}
                                                            {assignee && (
                                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                                                    {assignee.name || assignee.email}
                                                                </span>
                                                            )}
                                                            {task.dueDate && (
                                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                                                    Due {formatDate(task.dueDate)}
                                                                </span>
                                                            )}
                                                            {isDone && task.doneAt && (
                                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                                                    Done {formatDate(task.doneAt)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>

                                                    <div className="flex shrink-0 items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatus(task)}
                                                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                                                isDone
                                                                    ? "border-gray-200 text-gray-700 hover:bg-gray-100"
                                                                    : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                                                            }`}
                                                            aria-label={isDone ? "Reopen task" : "Mark task as done"}
                                                            title={isDone ? "Reopen task" : "Mark task as done"}
                                                        >
                                                            {isDone ? (
                                                                <>
                                                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M3 12a9 9 0 1 0 9-9" />
                                                                        <path d="M3 4v8h8" />
                                                                    </svg>
                                                                    Reopen
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M20 6 9 17l-5-5" />
                                                                    </svg>
                                                                    Done
                                                                </>
                                                            )}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(task)}
                                                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                                            aria-label="Edit task"
                                                            title="Edit task"
                                                        >
                                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 20h9" />
                                                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                                            </svg>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(task)}
                                                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700"
                                                            aria-label="Delete task"
                                                            title="Delete task"
                                                        >
                                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M3 6h18" />
                                                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </div>
                    )
                })()}
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/40"
                        aria-label="Close"
                        onClick={closeForm}
                    />
                    <form
                        onSubmit={handleSave}
                        className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <header className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                {editingTask ? "Edit task" : "New task"}
                            </h2>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                                aria-label="Close"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        </header>

                        <label className="flex flex-col gap-1 text-xs text-gray-600">
                            Title
                            <input
                                type="text"
                                value={draft.title}
                                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                                placeholder="Optional"
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                            />
                        </label>

                        <label className="flex flex-col gap-1 text-xs text-gray-600">
                            Description
                            <textarea
                                rows={3}
                                value={draft.description}
                                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                placeholder="Optional"
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                            />
                        </label>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Combobox
                                label="Client"
                                value={draft.clientId}
                                onChange={(value) => setDraft((d) => ({ ...d, clientId: value }))}
                                searchable
                                searchPlaceholder="Search clients"
                                options={[
                                    { value: "", label: "— None —" },
                                    ...clients.map((c) => ({
                                        value: String(c._id || c.id),
                                        label: c.name || "Unnamed",
                                    })),
                                ]}
                            />

                            <Combobox
                                label="Assignee"
                                value={draft.assigneeId}
                                onChange={(value) => setDraft((d) => ({ ...d, assigneeId: value }))}
                                searchable
                                searchPlaceholder="Search assignees"
                                options={[
                                    { value: "", label: "— None —" },
                                    ...employees.map((emp) => ({
                                        value: String(emp._id || emp.id),
                                        label: emp.name || emp.email || "—",
                                    })),
                                ]}
                            />
                        </div>

                        <label className="flex flex-col gap-1 text-xs text-gray-600">
                            Due date
                            <input
                                type="date"
                                value={draft.dueDate}
                                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
                            />
                        </label>

                        <footer className="mt-2 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                            >
                                {isSaving ? "Saving…" : editingTask ? "Save" : "Create task"}
                            </button>
                        </footer>
                    </form>
                </div>
            )}

            <TaskDetailsModal
                task={viewingTask}
                client={viewingTask?.clientId ? clientById.get(String(viewingTask.clientId)) : null}
                assignee={viewingTask?.assigneeId ? employeeById.get(String(viewingTask.assigneeId)) : null}
                onClose={closeView}
                onEdit={(task) => openEdit(task)}
                onToggleStatus={handleToggleStatus}
            />
        </section>
    )
}

export default TasksPage
