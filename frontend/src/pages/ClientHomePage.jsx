import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { getClientHome } from "../services/clientHome.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import {
    listClientsByOfficeId,
    addClientNote,
    updateClientNote,
    deleteClientNote,
} from "../services/clients.service"
import {
    updateTaskById as updateTask,
    addTaskComment,
    updateTaskComment,
    deleteTaskComment,
} from "../services/tasks.service"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { hasPermission } from "../utils/permissions"
import { ACCOUNT_TYPE_LABELS } from "../constants/accountTypes"
import TaskCard from "../components/tasks/TaskCard"
import TaskDetailsModal from "../components/tasks/TaskDetailsModal"
import TaskEditModal from "../components/tasks/TaskEditModal"
import { sortTasksDoneLast } from "../utils/tasks"

const GetStartedPanel = lazy(() => import("../components/ledger/GetStartedPanel"))

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))
}

function formatDateLong(value) {
    if (!value) return ""
    // Accept both YYYY-MM-DD strings (transaction dates) and full Date /
    // ISO timestamps (task due dates).
    const input =
        typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T00:00:00`
            : value
    const d = new Date(input)
    if (Number.isNaN(d.getTime())) return String(value)
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(d)
}

function ClientHomePage() {
    const { clientId } = useParams()
    const navigate = useNavigate()
    const { profile } = useAuth()
    const { error } = useNotification()
    const [data, setData] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [employees, setEmployees] = useState([])
    const [officeClients, setOfficeClients] = useState([])

    // Local copy of the tasks list so optimistic updates from the modal
    // are reflected immediately without refetching the whole dashboard.
    const [tasks, setTasks] = useState([])
    const [viewingTask, setViewingTask] = useState(null)
    const [editingTask, setEditingTask] = useState(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isSavingTask, setIsSavingTask] = useState(false)
    const currentProfileId = String(profile?._id || profile?.id || "").trim()

    const reload = useCallback(async () => {
        if (!clientId) return
        setIsLoading(true)
        try {
            const payload = await getClientHome(clientId)
            setData(payload || null)
        } catch (err) {
            error(err?.message || "Failed to load client home")
        } finally {
            setIsLoading(false)
        }
    }, [clientId, error])

    useEffect(() => {
        reload()
    }, [reload])

    // Load the office's employees + clients so the TaskCard and the
    // edit modal can render chips / dropdowns. Silent — we don't
    // surface failures.
    useEffect(() => {
        const officeId = String(profile?.officeId || "").trim()
        if (!officeId) return
        let active = true
        Promise.all([
            listEmployeesByOfficeId(officeId).catch(() => []),
            listClientsByOfficeId(officeId).catch(() => []),
        ]).then(([emps, clients]) => {
            if (!active) return
            setEmployees(Array.isArray(emps) ? emps : [])
            setOfficeClients(Array.isArray(clients) ? clients : [])
        })
        return () => {
            active = false
        }
    }, [profile?.officeId])

    // Mirror server tasks into local state so optimistic edits stick.
    useEffect(() => {
        setTasks(Array.isArray(data?.tasks) ? data.tasks : [])
    }, [data?.tasks])

    // Handlers — mirror the patterns used on Home.jsx.
    const handleTaskEdit = (task) => {
        setEditingTask(task)
        setIsEditOpen(true)
    }

    const handleTaskEditSave = async (draft) => {
        const id = String(editingTask?._id || editingTask?.id || "")
        if (!id) return
        try {
            setIsSavingTask(true)
            const updated = await updateTask(id, draft)
            setTasks((current) =>
                current.map((t) => (String(t._id || t.id) === id ? updated : t)),
            )
            setViewingTask((current) =>
                current && String(current._id || current.id) === id ? updated : current,
            )
            setIsEditOpen(false)
            setEditingTask(null)
        } catch (err) {
            error(err.message || "Failed to update task")
        } finally {
            setIsSavingTask(false)
        }
    }

    const handleTaskChangeStatus = async (task, nextStatus) => {
        const id = String(task?._id || task?.id || "")
        if (!id) return
        try {
            const updated = await updateTask(id, { status: nextStatus })
            setTasks((current) =>
                current.map((t) => (String(t._id || t.id) === id ? updated : t)),
            )
            setViewingTask((current) =>
                current && String(current._id || current.id) === id ? updated : current,
            )
        } catch (err) {
            error(err.message || "Failed to update task")
        }
    }

    const applyTaskUpdate = (updated) => {
        if (!updated) return
        const id = String(updated._id || updated.id)
        setTasks((current) => current.map((t) => (String(t._id || t.id) === id ? updated : t)))
        setViewingTask((current) =>
            current && String(current._id || current.id) === id ? updated : current,
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

    // Notes — each call returns the full client doc; we just sync the
    // notes array into the dashboard state.
    const setLocalNotes = (nextNotes) => {
        setData((current) => {
            if (!current) return current
            return {
                ...current,
                client: { ...current.client, notes: Array.isArray(nextNotes) ? nextNotes : [] },
            }
        })
    }

    const handleAddNote = async (body) => {
        const updatedClient = await addClientNote(clientId, body)
        setLocalNotes(updatedClient?.notes)
    }

    const handleUpdateNote = async (noteId, body) => {
        const updatedClient = await updateClientNote(clientId, noteId, body)
        setLocalNotes(updatedClient?.notes)
    }

    const handleDeleteNote = async (noteId) => {
        const updatedClient = await deleteClientNote(clientId, noteId)
        setLocalNotes(updatedClient?.notes)
    }

    if (!data && isLoading) {
        return (
            <section className="h-full w-full px-12 py-8">
                <div className="mx-auto flex h-full max-w-7xl items-center justify-center text-sm text-gray-500">
                    Loading…
                </div>
            </section>
        )
    }
    if (!data) return null

    const { client, period, kpis, actionItems, bankBalances, recentTransactions, tasksTotal } = data

    return (
        <section className="h-full w-full px-12 py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Dashboard
                        </p>
                        <h1 className="text-2xl font-semibold text-gray-900">{client.name || "Client"}</h1>
                        <p className="text-sm text-gray-500">
                            {[client.businessType, client.mainActivity, client.state]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            to={`/clients/${clientId}/transactions`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                        >
                            Open Transactions
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m13 6 6 6-6 6" />
                            </svg>
                        </Link>
                    </div>
                </header>

                <Suspense fallback={null}>
                    <GetStartedPanel clientId={clientId} refreshKey={kpis.cashBalance} />
                </Suspense>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KpiCard
                        label="Cash balance"
                        value={formatCurrency(kpis.cashBalance)}
                        hint="Sum of asset accounts"
                    />
                    <KpiCard
                        label={`Revenue · ${period?.label || "MTD"}`}
                        value={formatCurrency(kpis.mtdRevenue)}
                    />
                    <KpiCard
                        label={`Net income · ${period?.label || "MTD"}`}
                        value={formatCurrency(kpis.mtdNetIncome)}
                        accent={kpis.mtdNetIncome >= 0 ? "good" : "bad"}
                    />
                    <KpiCard
                        label={`Gross profit · ${period?.label || "MTD"}`}
                        value={formatCurrency(kpis.mtdGrossProfit)}
                    />
                </div>

                <ActionItemsCard
                    clientId={clientId}
                    actionItems={actionItems}
                />

                {tasks && tasks.length > 0 && (
                    <TasksSection
                        tasks={tasks}
                        totalCount={tasksTotal}
                        client={client}
                        employees={employees}
                        officeClients={officeClients}
                        onSelectTask={setViewingTask}
                    />
                )}

                <NotesCard
                    notes={client.notes}
                    currentProfileId={currentProfileId}
                    canCreate={hasPermission(profile?.permissions, "clientsNotes:create")}
                    canUpdateAny={hasPermission(profile?.permissions, "clientsNotes:update")}
                    canDeleteAny={hasPermission(profile?.permissions, "clientsNotes:delete")}
                    onAdd={handleAddNote}
                    onUpdate={handleUpdateNote}
                    onDelete={handleDeleteNote}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <section className="rounded-xl border border-gray-200 bg-white lg:col-span-2">
                        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                            <h2 className="text-sm font-semibold text-gray-900">
                                Recent transactions
                            </h2>
                            <Link
                                to={`/clients/${clientId}/transactions`}
                                className="text-[12px] font-medium text-gray-500 hover:text-gray-900"
                            >
                                View all →
                            </Link>
                        </header>
                        {recentTransactions.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-gray-500">
                                No transactions yet.
                            </p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {recentTransactions.map((tx) => {
                                    const isIn = tx.amount > 0
                                    return (
                                        <li
                                            key={tx.id}
                                            className="flex items-center gap-3 px-4 py-2 text-sm"
                                        >
                                            <span className="w-20 shrink-0 text-[12px] text-gray-500 tabular-nums">
                                                {formatDateLong(tx.date)}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-gray-900">
                                                    {tx.description || "—"}
                                                </span>
                                                <span className="block truncate text-[11px] text-gray-500">
                                                    {tx.bankAccount}
                                                    {tx.category
                                                        ? `  ·  ${tx.category}`
                                                        : tx.isUncategorized
                                                        ? "  ·  Uncategorized"
                                                        : tx.isSplit
                                                        ? "  ·  Split"
                                                        : ""}
                                                </span>
                                            </span>
                                            <span
                                                className={`shrink-0 tabular-nums ${
                                                    isIn ? "text-emerald-700" : "text-rose-700"
                                                }`}
                                            >
                                                {isIn ? "+" : ""}
                                                {formatCurrency(tx.amount)}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>

                    <section className="rounded-xl border border-gray-200 bg-white">
                        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                            <h2 className="text-sm font-semibold text-gray-900">Account balances</h2>
                            <Link
                                to={`/clients/${clientId}/chart-of-accounts`}
                                className="text-[12px] font-medium text-gray-500 hover:text-gray-900"
                            >
                                Chart →
                            </Link>
                        </header>
                        {bankBalances.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-gray-500">
                                No bank-like accounts yet.
                            </p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {bankBalances.map((acc) => (
                                    <li
                                        key={acc.id}
                                        className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-gray-900">{acc.name}</span>
                                            <span className="block truncate text-[11px] text-gray-500">
                                                {ACCOUNT_TYPE_LABELS[acc.accountType] || acc.accountType}
                                            </span>
                                        </span>
                                        <span className="shrink-0 tabular-nums text-gray-900">
                                            {formatCurrency(acc.balance)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <section className="rounded-xl border border-gray-200 bg-white p-4">
                    <h2 className="text-sm font-semibold text-gray-900">Quick actions</h2>
                    <p className="text-[12px] text-gray-500">
                        Jump straight to a workflow.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <QuickActionLink to={`/clients/${clientId}/transactions`} label="Add transaction" iconKind="plus" />
                        <QuickActionLink to={`/clients/${clientId}/transactions`} label="Upload CSV" iconKind="upload" />
                        <QuickActionLink to={`/clients/${clientId}/recurring`} label="Recurring" iconKind="cycle" />
                        <QuickActionLink to={`/clients/${clientId}/reconciliation`} label="Reconciliation" iconKind="swap" />
                        <QuickActionLink to={`/clients/${clientId}/reports/profit-loss`} label="Profit & Loss" iconKind="chart" />
                        <QuickActionLink to={`/clients/${clientId}/reports/balance-sheet`} label="Balance Sheet" iconKind="scale" />
                    </div>
                </section>
            </div>

            <TaskDetailsModal
                task={isEditOpen ? null : viewingTask}
                clientList={
                    viewingTask
                        ? (Array.isArray(viewingTask.clientIds) && viewingTask.clientIds.length > 0
                            ? viewingTask.clientIds
                            : (viewingTask.clientId ? [viewingTask.clientId] : []))
                            .map((id) => {
                                if (String(id) === String(client?.id)) {
                                    return { id: client.id, name: client.name }
                                }
                                return officeClients.find(
                                    (c) => String(c._id || c.id) === String(id),
                                )
                            })
                            .filter(Boolean)
                        : []
                }
                assigneeList={
                    viewingTask
                        ? (Array.isArray(viewingTask.assigneeIds) && viewingTask.assigneeIds.length > 0
                            ? viewingTask.assigneeIds
                            : (viewingTask.assigneeId ? [viewingTask.assigneeId] : []))
                            .map((id) =>
                                employees.find((emp) => String(emp._id || emp.id) === String(id)),
                            )
                            .filter(Boolean)
                        : []
                }
                onClose={() => setViewingTask(null)}
                onEdit={(task) => handleTaskEdit(task)}
                onChangeStatus={handleTaskChangeStatus}
                canViewStatusHistory={hasPermission(profile?.permissions, "tasks:readStatusHistory")}
                currentProfileId={currentProfileId}
                canCreateComment={hasPermission(profile?.permissions, "tasks:commentCreate")}
                canUpdateComment={hasPermission(profile?.permissions, "tasks:commentUpdate")}
                canDeleteComment={hasPermission(profile?.permissions, "tasks:commentDelete")}
                onCreateComment={handleCreateComment}
                onUpdateComment={handleUpdateComment}
                onDeleteComment={handleDeleteComment}
            />

            <TaskEditModal
                isOpen={isEditOpen}
                task={editingTask}
                clients={officeClients}
                employees={employees}
                isSaving={isSavingTask}
                onCancel={() => {
                    setIsEditOpen(false)
                    setEditingTask(null)
                }}
                onSubmit={handleTaskEditSave}
            />
        </section>
    )
}

function TasksSection({ tasks, totalCount, client, employees, officeClients, onSelectTask }) {
    // Build the maps TaskCard expects. Include the current client and
    // any other office clients (in case a task is linked to several).
    const clientById = useMemo(() => {
        const map = new Map()
        if (client?.id) {
            map.set(String(client.id), { id: client.id, name: client.name || "Client" })
        }
        for (const c of Array.isArray(officeClients) ? officeClients : []) {
            const id = String(c?._id || c?.id || "")
            if (id && !map.has(id)) {
                map.set(id, { id, name: c?.name || "Client" })
            }
        }
        return map
    }, [client?.id, client?.name, officeClients])

    const employeeById = useMemo(() => {
        const map = new Map()
        for (const emp of Array.isArray(employees) ? employees : []) {
            const id = String(emp?._id || emp?.id || "")
            if (!id) continue
            map.set(id, emp)
        }
        return map
    }, [employees])

    return (
        <section className="rounded-xl border border-gray-200 bg-white">
            <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-900">Open tasks</h2>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {totalCount}
                    </span>
                </div>
                <Link
                    to={`/crm/tasks`}
                    className="text-[12px] font-medium text-gray-500 hover:text-gray-900"
                >
                    View all →
                </Link>
            </header>
            <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortTasksDoneLast(tasks).map((task) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        clientById={clientById}
                        employeeById={employeeById}
                        onSelect={onSelectTask}
                    />
                ))}
            </ul>
        </section>
    )
}

function KpiCard({ label, value, hint, accent }) {
    const valueClass =
        accent === "good"
            ? "text-emerald-700"
            : accent === "bad"
            ? "text-rose-700"
            : "text-gray-900"
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
            </p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
            {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
        </div>
    )
}

function ActionItemsCard({ clientId, actionItems }) {
    const items = []
    if (actionItems.uncategorizedCount > 0) {
        items.push({
            tone: "amber",
            label: `${actionItems.uncategorizedCount} uncategorized transactions`,
            cta: { label: "Categorize", to: `/clients/${clientId}/transactions` },
        })
    }
    if (actionItems.unreconciledAccountCount > 0) {
        items.push({
            tone: "amber",
            label: `${actionItems.unreconciledAccountCount} bank account${
                actionItems.unreconciledAccountCount === 1 ? "" : "s"
            } need reconciliation (${actionItems.unreconciledLegsCount} uncleared)`,
            cta: { label: "Reconcile", to: `/clients/${clientId}/reconciliation` },
        })
    }
    if (actionItems.closedThroughDate) {
        items.push({
            tone: "emerald",
            label: `Books closed through ${formatDateLong(actionItems.closedThroughDate)}`,
            cta: { label: "Period Close", to: `/clients/${clientId}/period-close` },
        })
    } else {
        items.push({
            tone: "gray",
            label: "Books are open — no period has been closed yet",
            cta: { label: "Period Close", to: `/clients/${clientId}/period-close` },
        })
    }
    if (actionItems.lastActivityDate) {
        items.push({
            tone: "gray",
            label: `Last activity ${actionItems.lastActivityDaysAgo === 0 ? "today" : `${actionItems.lastActivityDaysAgo} day${actionItems.lastActivityDaysAgo === 1 ? "" : "s"} ago`} (${formatDateLong(actionItems.lastActivityDate)})`,
        })
    }

    if (items.length === 0) {
        return (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Everything is up to date. ✨
            </section>
        )
    }

    const toneStyles = {
        amber: "border-amber-200 bg-amber-50 text-amber-900",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
        gray: "border-gray-200 bg-white text-gray-700",
    }

    return (
        <section className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                        toneStyles[item.tone] || toneStyles.gray
                    }`}
                >
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.cta && (
                        <Link
                            to={item.cta.to}
                            className="shrink-0 rounded-md border border-current bg-white/60 px-2.5 py-1 text-xs font-semibold transition hover:bg-white"
                        >
                            {item.cta.label}
                        </Link>
                    )}
                </div>
            ))}
        </section>
    )
}

function QuickActionLink({ to, label, iconKind }) {
    return (
        <Link
            to={to}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
            <QuickActionIcon kind={iconKind} />
            {label}
        </Link>
    )
}

function QuickActionIcon({ kind }) {
    const common = {
        viewBox: "0 0 24 24",
        className: "h-4 w-4",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
    }
    if (kind === "plus") {
        return (
            <svg {...common}>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
            </svg>
        )
    }
    if (kind === "upload") {
        return (
            <svg {...common}>
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M20 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" />
            </svg>
        )
    }
    if (kind === "cycle") {
        return (
            <svg {...common}>
                <path d="M3 12a9 9 0 0 1 15-6.7l3 2.7" />
                <path d="M21 4v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7l-3-2.7" />
                <path d="M3 20v-5h5" />
            </svg>
        )
    }
    if (kind === "swap") {
        return (
            <svg {...common}>
                <path d="M3 7l4 4 4-4" />
                <path d="M7 11V3" />
                <path d="M21 17l-4-4-4 4" />
                <path d="M17 13v8" />
            </svg>
        )
    }
    if (kind === "chart") {
        return (
            <svg {...common}>
                <path d="M4 19h16" />
                <path d="M6 16V9" />
                <path d="M12 16V6" />
                <path d="M18 16v-4" />
            </svg>
        )
    }
    if (kind === "scale") {
        return (
            <svg {...common}>
                <path d="M12 3v18" />
                <path d="M6 7l-3 4 3 4" />
                <path d="M18 7l3 4-3 4" />
                <path d="M3 11h18" />
            </svg>
        )
    }
    return null
}

function formatNoteTimestamp(value) {
    if (!value) return ""
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

function NotesCard({
    notes,
    currentProfileId,
    canCreate,
    canUpdateAny,
    canDeleteAny,
    onAdd,
    onUpdate,
    onDelete,
}) {
    const { error } = useNotification()
    const [draft, setDraft] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editBody, setEditBody] = useState("")
    const [busyId, setBusyId] = useState(null)

    const list = Array.isArray(notes) ? notes : []
    const trimmed = draft.trim()

    const isOwnNote = (note) => {
        const authorId = String(note?.authorId || "").trim()
        return Boolean(authorId && currentProfileId && authorId === currentProfileId)
    }
    const canEditNote = (note) => isOwnNote(note) || canUpdateAny
    const canDeleteNote = (note) => isOwnNote(note) || canDeleteAny

    const handleAdd = async (event) => {
        event.preventDefault()
        if (!trimmed || isAdding) return
        setIsAdding(true)
        try {
            await onAdd(trimmed)
            setDraft("")
        } catch (err) {
            error(err?.message || "Failed to add note")
        } finally {
            setIsAdding(false)
        }
    }

    const startEdit = (note) => {
        setEditingId(String(note.id))
        setEditBody(String(note.body || ""))
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditBody("")
    }

    const handleSaveEdit = async (note) => {
        const next = editBody.trim()
        if (!next) return
        setBusyId(String(note.id))
        try {
            await onUpdate(note.id, next)
            cancelEdit()
        } catch (err) {
            error(err?.message || "Failed to update note")
        } finally {
            setBusyId(null)
        }
    }

    const handleDelete = async (note) => {
        if (typeof window !== "undefined" && !window.confirm("Delete this note?")) return
        setBusyId(String(note.id))
        try {
            await onDelete(note.id)
        } catch (err) {
            error(err?.message || "Failed to delete note")
        } finally {
            setBusyId(null)
        }
    }

    return (
        <section className="rounded-xl border border-gray-200 bg-white">
            <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
                <span className="text-[12px] text-gray-500">{list.length}</span>
            </header>

            {list.length === 0 ? (
                <p className={`px-4 py-8 text-center text-sm text-gray-500 ${canCreate ? "border-b border-gray-100" : ""}`}>
                    No notes yet.
                </p>
            ) : (
                <ul className={`divide-y divide-gray-100 ${canCreate ? "border-b border-gray-100" : ""}`}>
                    {list.map((note) => {
                        const editing = editingId === String(note.id)
                        const isBusy = busyId === String(note.id)
                        return (
                            <li key={note.id} className="px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 text-[12px] text-gray-500">
                                        <span className="font-medium text-gray-700">
                                            {note.authorName || "Unknown"}
                                        </span>
                                        <span> · {formatNoteTimestamp(note.createdAt)}</span>
                                        {note.updatedAt && (
                                            <span className="text-gray-400"> (edited)</span>
                                        )}
                                    </div>
                                    {!editing && (canEditNote(note) || canDeleteNote(note)) && (
                                        <div className="flex shrink-0 items-center gap-1">
                                            {canEditNote(note) && (
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(note)}
                                                    className="rounded px-2 py-0.5 text-[12px] text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {canDeleteNote(note) && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(note)}
                                                    disabled={isBusy}
                                                    className="rounded px-2 py-0.5 text-[12px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {editing ? (
                                    <div className="mt-2">
                                        <textarea
                                            value={editBody}
                                            onChange={(e) => setEditBody(e.target.value)}
                                            rows={2}
                                            className="w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                                        />
                                        <div className="mt-2 flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleSaveEdit(note)}
                                                disabled={!editBody.trim() || isBusy}
                                                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                                            >
                                                {isBusy ? "Saving…" : "Save"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                                        {note.body}
                                    </p>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            {canCreate && (
                <form onSubmit={handleAdd} className="p-4">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Add a note about this client…"
                        rows={2}
                        className="w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={!trimmed || isAdding}
                            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isAdding ? "Adding…" : "Add note"}
                        </button>
                    </div>
                </form>
            )}
        </section>
    )
}

export default ClientHomePage
