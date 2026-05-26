import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    DndContext,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    DragOverlay,
    closestCenter,
} from "@dnd-kit/core"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { hasPermission } from "../utils/permissions"
import {
    listTasks,
    createTask,
    updateTaskById,
    addTaskComment,
    updateTaskComment,
    deleteTaskComment,
} from "../services/tasks.service"
import { listClientsByOfficeId } from "../services/clients.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import {
    listBoardCollections,
    createBoardCollection,
    renameBoardCollection,
    deleteBoardCollection,
} from "../services/board.service"
import TaskCard from "../components/tasks/TaskCard"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import TaskEditModal from "../components/tasks/TaskEditModal"
import BoardFiltersModal, {
    EMPTY_BOARD_FILTERS,
    countActiveBoardFilters,
} from "../components/tasks/BoardFiltersModal"

const INBOX_COLUMN_ID = "__inbox__"

function DraggableTaskCard({ task, clientById, employeeById, onSelect, isDragging }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: String(task._id || task.id),
        data: { task },
    })
    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: 0.85 }
        : undefined
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            // The arbitrary `[&>li]` variants override TaskCard's default
            // translucent gray background so cards stand out from the gray
            // column they sit on. Border color is set per-side (top/right/
            // bottom) so the priority-colored left border still shows.
            className={`cursor-grab touch-none active:cursor-grabbing [&>li]:border-t-gray-200 [&>li]:border-r-gray-200 [&>li]:border-b-gray-200 [&>li]:bg-white [&>li]:shadow-sm ${isDragging ? "opacity-40" : ""}`}
        >
            <TaskCard task={task} clientById={clientById} employeeById={employeeById} onSelect={onSelect} />
        </div>
    )
}

function DroppableColumn({ id, title, count, canManage, onRename, onDelete, children }) {
    const { setNodeRef, isOver: hovered } = useDroppable({ id })
    const isInbox = id === INBOX_COLUMN_ID
    // Width math (gap is 0.75rem = 12px between columns):
    //  base  → 1 column visible
    //  sm    → 2 columns (subtract 1 gap, divide by 2)
    //  md    → 3 columns
    //  lg+   → 4 columns
    return (
        <section
            ref={setNodeRef}
            className={`flex shrink-0 grow-0 basis-full flex-col rounded-xl border p-3 transition sm:basis-[calc((100%-0.75rem)/2)] md:basis-[calc((100%-1.5rem)/3)] lg:basis-[calc((100%-2.25rem)/4)] ${
                hovered ? "border-gray-900 bg-gray-200/70" : "border-gray-200 bg-gray-100"
            }`}
        >
            <header className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
                    <p className="text-[11px] text-gray-500">
                        {count} task{count === 1 ? "" : "s"}
                    </p>
                </div>
                {!isInbox && canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={onRename}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                            title="Rename column"
                            aria-label="Rename column"
                        >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-rose-50 hover:text-rose-700"
                            title="Delete column"
                            aria-label="Delete column"
                        >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                        </button>
                    </div>
                )}
            </header>
            <ul className="flex min-h-[120px] flex-col gap-2">{children}</ul>
        </section>
    )
}

function BoardPage() {
    const { profile } = useAuth()
    const { success, error } = useNotification()
    const officeId = String(profile?.officeId || "").trim()
    const currentProfileId = String(profile?._id || profile?.id || "").trim()
    const canManageColumns = hasPermission(profile?.permissions, "board:manageColumns")
    const canUpdateTasks = hasPermission(profile?.permissions, "tasks:update")

    const [tasks, setTasks] = useState([])
    const [collections, setCollections] = useState([])
    const [clientById, setClientById] = useState(new Map())
    const [employeeById, setEmployeeById] = useState(new Map())
    const [isLoading, setIsLoading] = useState(true)
    const [activeDragId, setActiveDragId] = useState("")
    const [viewingTask, setViewingTask] = useState(null)
    const [newColumnDraft, setNewColumnDraft] = useState("")
    const [isCreatingColumn, setIsCreatingColumn] = useState(false)
    const [isAddingColumn, setIsAddingColumn] = useState(false)
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState(null)
    const [isSavingTask, setIsSavingTask] = useState(false)
    const [filters, setFilters] = useState(EMPTY_BOARD_FILTERS)
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const boardScrollRef = useRef(null)
    const canCreateTask = hasPermission(profile?.permissions, "tasks:create")
    const canCreateComment = hasPermission(profile?.permissions, "tasks:commentCreate")
    const canUpdateComment = hasPermission(profile?.permissions, "tasks:commentUpdate")
    const canDeleteComment = hasPermission(profile?.permissions, "tasks:commentDelete")
    const activeFiltersCount = countActiveBoardFilters(filters)
    const hasSearch = searchTerm.trim().length > 0
    const isFilteredMode = activeFiltersCount > 0 || hasSearch

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    // While dragging, snap-scroll the strip one whole column at a time when
    // the cursor lingers near the left/right edge — never leaving a column
    // half-visible. A short cooldown after each snap lets the user pause
    // between jumps and drop on the now-visible column.
    useEffect(() => {
        if (!activeDragId) return undefined
        const container = boardScrollRef.current
        if (!container) return undefined

        const EDGE_BUFFER = 96
        const SNAP_COOLDOWN_MS = 380
        let pointerX = null
        let frameId = null
        let cooldownUntil = 0

        const onPointerMove = (event) => {
            pointerX = event.clientX
        }

        const getColumnPositions = () => (
            Array.from(container.children)
                .map((child) => child.offsetLeft)
                .sort((a, b) => a - b)
        )

        const tick = () => {
            const now = Date.now()
            if (pointerX !== null && now >= cooldownUntil) {
                const rect = container.getBoundingClientRect()
                const fromLeft = pointerX - rect.left
                const fromRight = rect.right - pointerX
                if (fromRight >= 0 && fromRight < EDGE_BUFFER) {
                    const positions = getColumnPositions()
                    const next = positions.find((p) => p > container.scrollLeft + 5)
                    if (next !== undefined) {
                        container.scrollTo({ left: next, behavior: "smooth" })
                        cooldownUntil = now + SNAP_COOLDOWN_MS
                    }
                } else if (fromLeft >= 0 && fromLeft < EDGE_BUFFER) {
                    const positions = getColumnPositions()
                    let prev
                    for (const p of positions) {
                        if (p < container.scrollLeft - 5) prev = p
                        else break
                    }
                    if (prev !== undefined) {
                        container.scrollTo({ left: prev, behavior: "smooth" })
                        cooldownUntil = now + SNAP_COOLDOWN_MS
                    }
                }
            }
            frameId = requestAnimationFrame(tick)
        }

        window.addEventListener("pointermove", onPointerMove)
        frameId = requestAnimationFrame(tick)

        return () => {
            window.removeEventListener("pointermove", onPointerMove)
            if (frameId) cancelAnimationFrame(frameId)
        }
    }, [activeDragId])

    useEffect(() => {
        if (!officeId) {
            setIsLoading(false)
            return undefined
        }
        let active = true
        setIsLoading(true)
        Promise.all([
            listTasks().catch(() => []),
            listBoardCollections().catch(() => []),
            listClientsByOfficeId(officeId, { limit: 500 }).catch(() => null),
            listEmployeesByOfficeId(officeId).catch(() => null),
        ])
            .then(([taskList, columnList, clientPayload, employeePayload]) => {
                if (!active) return
                setTasks(Array.isArray(taskList) ? taskList : [])
                setCollections(Array.isArray(columnList) ? columnList : [])
                const clientItems = Array.isArray(clientPayload?.items)
                    ? clientPayload.items
                    : Array.isArray(clientPayload)
                        ? clientPayload
                        : []
                const employeeItems = Array.isArray(employeePayload?.items)
                    ? employeePayload.items
                    : Array.isArray(employeePayload)
                        ? employeePayload
                        : []
                setClientById(new Map(clientItems.map((c) => [String(c._id || c.id), c])))
                setEmployeeById(new Map(employeeItems.map((e) => [String(e._id || e.id), e])))
            })
            .finally(() => {
                if (active) setIsLoading(false)
            })
        return () => { active = false }
    }, [officeId])

    const tasksByColumnId = useMemo(() => {
        const map = new Map()
        map.set(INBOX_COLUMN_ID, [])
        for (const column of collections) {
            map.set(String(column._id || column.id), [])
        }
        for (const task of tasks) {
            const columnId = task.collectionId ? String(task.collectionId) : INBOX_COLUMN_ID
            const list = map.get(columnId) || map.get(INBOX_COLUMN_ID)
            list.push(task)
        }
        return map
    }, [tasks, collections])

    const filteredTasks = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase()
        return tasks.filter((task) => {
            if (filters.clientId) {
                const ids = Array.isArray(task.clientIds) && task.clientIds.length > 0
                    ? task.clientIds.map(String)
                    : (task.clientId ? [String(task.clientId)] : [])
                if (!ids.includes(String(filters.clientId))) return false
            }
            if (filters.priority && filters.priority !== "all") {
                if (String(task.priority || "low") !== filters.priority) return false
            }
            if (filters.dateMode === "none") {
                if (task.dueDate) return false
            } else if (filters.dateMode === "range" && filters.from && filters.to) {
                if (!task.dueDate) return false
                if (task.dueDate < filters.from || task.dueDate > filters.to) return false
            }
            if (needle) {
                const haystack = [
                    task.title || "",
                    task.description || "",
                ].join(" ").toLowerCase()
                if (!haystack.includes(needle)) return false
            }
            return true
        })
    }, [tasks, filters, searchTerm])

    const activeTask = useMemo(() => {
        if (!activeDragId) return null
        return tasks.find((t) => String(t._id || t.id) === String(activeDragId)) || null
    }, [activeDragId, tasks])

    const handleDragEnd = useCallback(async (event) => {
        const taskId = event.active?.id
        const targetColumnId = event.over?.id
        setActiveDragId("")
        if (!taskId || !targetColumnId) return

        const task = tasks.find((t) => String(t._id || t.id) === String(taskId))
        if (!task) return

        const currentColumn = task.collectionId ? String(task.collectionId) : INBOX_COLUMN_ID
        if (currentColumn === String(targetColumnId)) return

        const nextCollectionId = targetColumnId === INBOX_COLUMN_ID ? null : String(targetColumnId)
        // Optimistic update.
        setTasks((current) =>
            current.map((t) =>
                String(t._id || t.id) === String(taskId)
                    ? { ...t, collectionId: nextCollectionId }
                    : t
            )
        )
        try {
            const updated = await updateTaskById(taskId, { collectionId: nextCollectionId })
            setTasks((current) =>
                current.map((t) =>
                    String(t._id || t.id) === String(taskId) ? updated : t
                )
            )
        } catch (err) {
            // Rollback.
            setTasks((current) =>
                current.map((t) =>
                    String(t._id || t.id) === String(taskId)
                        ? { ...t, collectionId: task.collectionId || null }
                        : t
                )
            )
            error(err.message || "Failed to move task")
        }
    }, [tasks, error])

    const openEditTask = (task) => {
        setEditingTask(task)
        setIsTaskFormOpen(true)
    }

    const closeTaskForm = () => {
        setIsTaskFormOpen(false)
        setEditingTask(null)
    }

    const handleSaveTask = async (draft) => {
        try {
            setIsSavingTask(true)
            if (editingTask) {
                const updated = await updateTaskById(editingTask._id || editingTask.id, draft || {})
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
                const created = await createTask(draft || {})
                setTasks((current) => [created, ...current])
                success("Task created")
            }
            closeTaskForm()
        } catch (err) {
            error(err.message || (editingTask ? "Failed to update task" : "Failed to create task"))
        } finally {
            setIsSavingTask(false)
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

    const handleCreateColumn = async (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault()
        const name = newColumnDraft.trim()
        if (!name) return
        try {
            setIsCreatingColumn(true)
            const created = await createBoardCollection(name)
            setCollections((current) => [...current, created])
            setNewColumnDraft("")
            setIsAddingColumn(false)
            success("Column created")
        } catch (err) {
            error(err.message || "Failed to create column")
        } finally {
            setIsCreatingColumn(false)
        }
    }

    const handleRenameColumn = async (column) => {
        const id = String(column._id || column.id)
        const next = window.prompt("New name for this column", column.name || "")
        if (next === null) return
        const name = next.trim()
        if (!name || name === column.name) return
        try {
            const updated = await renameBoardCollection(id, name)
            setCollections((current) => current.map((c) => (String(c._id || c.id) === id ? updated : c)))
        } catch (err) {
            error(err.message || "Failed to rename column")
        }
    }

    const handleDeleteColumn = async (column) => {
        const id = String(column._id || column.id)
        if (!window.confirm(`Delete column "${column.name}"? Tasks in it will go back to "All tasks".`)) return
        try {
            await deleteBoardCollection(id)
            setCollections((current) => current.filter((c) => String(c._id || c.id) !== id))
            setTasks((current) =>
                current.map((t) => (String(t.collectionId || "") === id ? { ...t, collectionId: null } : t))
            )
            success("Column deleted")
        } catch (err) {
            error(err.message || "Failed to delete column")
        }
    }

    const renderColumn = (id, title, columnObj = null) => {
        const list = tasksByColumnId.get(id) || []
        return (
            <DroppableColumn
                key={id}
                id={id}
                title={title}
                count={list.length}
                canManage={canManageColumns && columnObj !== null}
                onRename={columnObj ? () => handleRenameColumn(columnObj) : undefined}
                onDelete={columnObj ? () => handleDeleteColumn(columnObj) : undefined}
            >
                {list.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-400">
                        Drop tasks here
                    </li>
                ) : (
                    list.map((task) => (
                        <DraggableTaskCard
                            key={String(task._id || task.id)}
                            task={task}
                            clientById={clientById}
                            employeeById={employeeById}
                            onSelect={setViewingTask}
                            isDragging={String(activeDragId) === String(task._id || task.id)}
                        />
                    ))
                )}
            </DroppableColumn>
        )
    }

    return (
        <section className="w-full px-12 py-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold sm:text-3xl">Board</h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                            <span className="inline-flex items-center gap-1.5">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3" y="4" width="5" height="16" rx="1" />
                                    <rect x="10" y="4" width="5" height="10" rx="1" />
                                    <rect x="17" y="4" width="4" height="13" rx="1" />
                                </svg>
                                <span className="font-medium text-gray-700 tabular-nums">{collections.length + 1}</span>
                                <span>column{collections.length + 1 === 1 ? "" : "s"}</span>
                            </span>
                            <span className="text-gray-300">·</span>
                            <span className="inline-flex items-center gap-1.5">
                                {isFilteredMode ? (
                                    <>
                                        <span className="font-medium text-gray-700 tabular-nums">{filteredTasks.length}</span>
                                        <span className="text-gray-400">of</span>
                                        <span className="font-medium text-gray-700 tabular-nums">{tasks.length}</span>
                                    </>
                                ) : (
                                    <span className="font-medium text-gray-700 tabular-nums">{tasks.length}</span>
                                )}
                                <span>task{(isFilteredMode ? filteredTasks.length : tasks.length) === 1 ? "" : "s"}</span>
                            </span>
                        </p>
                    </div>
                    {canCreateTask && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingTask(null)
                                setIsTaskFormOpen(true)
                            }}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                            </svg>
                            New task
                        </button>
                    )}
                </header>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tasks"
                            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-500"
                        />
                        <svg
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </svg>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsFiltersOpen(true)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 4h18l-7 9v6l-4-2v-4z" />
                        </svg>
                        Filters
                        {activeFiltersCount > 0 && (
                            <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                    {isFilteredMode && (
                        <button
                            type="button"
                            onClick={() => {
                                setFilters(EMPTY_BOARD_FILTERS)
                                setSearchTerm("")
                            }}
                            className="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                        Loading board…
                    </p>
                ) : isFilteredMode ? (
                    // Filter / search mode: forget the columns and show every
                    // matching task in a grid (4 cols on desktop). DnD is
                    // disabled here since the columns aren't visible.
                    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-100 p-3 [&>ul>li]:border-t-gray-200 [&>ul>li]:border-r-gray-200 [&>ul>li]:border-b-gray-200 [&>ul>li]:bg-white [&>ul>li]:shadow-sm">
                        {filteredTasks.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                                No tasks match the current filters.
                            </p>
                        ) : (
                            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {filteredTasks.map((task) => (
                                    <TaskCard
                                        key={String(task._id || task.id)}
                                        task={task}
                                        clientById={clientById}
                                        employeeById={employeeById}
                                        onSelect={setViewingTask}
                                    />
                                ))}
                            </ul>
                        )}
                    </section>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={(event) => setActiveDragId(event.active?.id || "")}
                        onDragCancel={() => setActiveDragId("")}
                        onDragEnd={handleDragEnd}
                        // We run a manual edge-scroll loop above (see the
                        // pointermove useEffect) because @dnd-kit's built-in
                        // autoScroll wasn't picking up the nested overflow
                        // container reliably.
                        autoScroll={false}
                    >
                        <div
                            ref={boardScrollRef}
                            className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-2 [&>section]:snap-start [&>div]:snap-start"
                        >
                            {renderColumn(INBOX_COLUMN_ID, "All tasks", null)}
                            {collections.map((column) => renderColumn(String(column._id || column.id), column.name, column))}
                            {canManageColumns && (
                                <div className="flex shrink-0 grow-0 basis-full flex-col rounded-xl border border-dashed border-gray-200 p-3 sm:basis-[calc((100%-0.75rem)/2)] md:basis-[calc((100%-1.5rem)/3)] lg:basis-[calc((100%-2.25rem)/4)]">
                                    {isAddingColumn ? (
                                        <form
                                            onSubmit={handleCreateColumn}
                                            className="flex h-full flex-col gap-2"
                                        >
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newColumnDraft}
                                                onChange={(e) => setNewColumnDraft(e.target.value)}
                                                placeholder="Column name"
                                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                                disabled={isCreatingColumn}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Escape") {
                                                        setIsAddingColumn(false)
                                                        setNewColumnDraft("")
                                                    }
                                                }}
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={isCreatingColumn || !newColumnDraft.trim()}
                                                    className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                                                >
                                                    {isCreatingColumn ? "Adding…" : "Add column"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsAddingColumn(false)
                                                        setNewColumnDraft("")
                                                    }}
                                                    className="rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingColumn(true)}
                                            className="flex h-full min-h-[120px] w-full items-center justify-center gap-1.5 rounded-md text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                                        >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 5v14" />
                                                <path d="M5 12h14" />
                                            </svg>
                                            Add column
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <DragOverlay>
                            {activeTask ? (
                                <div className="w-72 opacity-95 [&>li]:border-gray-200 [&>li]:bg-white [&>li]:shadow-lg">
                                    <TaskCard task={activeTask} clientById={clientById} employeeById={employeeById} />
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            <TaskDetailsModal
                task={viewingTask}
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
                onEdit={canUpdateTasks ? (task) => {
                    setViewingTask(null)
                    openEditTask(task)
                } : undefined}
                onChangeStatus={async (task, nextStatus) => {
                    if (!canUpdateTasks) return
                    try {
                        const updated = await updateTaskById(task._id || task.id, { status: nextStatus })
                        setTasks((current) =>
                            current.map((t) => (String(t._id || t.id) === String(updated._id || updated.id) ? updated : t))
                        )
                        setViewingTask(updated)
                    } catch (err) {
                        error(err.message || "Failed to update status")
                    }
                }}
                canViewStatusHistory={hasPermission(profile?.permissions, "tasks:readStatusHistory")}
                currentProfileId={currentProfileId}
                canCreateComment={canCreateComment}
                canUpdateComment={canUpdateComment}
                canDeleteComment={canDeleteComment}
                onCreateComment={handleCreateComment}
                onUpdateComment={handleUpdateComment}
                onDeleteComment={handleDeleteComment}
            />

            <TaskEditModal
                isOpen={isTaskFormOpen}
                task={editingTask}
                clients={Array.from(clientById.values())}
                employees={Array.from(employeeById.values())}
                isSaving={isSavingTask}
                onCancel={closeTaskForm}
                onSubmit={handleSaveTask}
            />

            <BoardFiltersModal
                isOpen={isFiltersOpen}
                filters={filters}
                clients={Array.from(clientById.values())}
                onCancel={() => setIsFiltersOpen(false)}
                onApply={(next) => {
                    setFilters(next)
                    setIsFiltersOpen(false)
                }}
                onClear={() => {
                    setFilters(EMPTY_BOARD_FILTERS)
                    setSearchTerm("")
                    setIsFiltersOpen(false)
                }}
            />
        </section>
    )
}

export default BoardPage
