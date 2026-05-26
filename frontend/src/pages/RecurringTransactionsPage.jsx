import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { showApiError } from "../utils/errorPresentation"
import { getClientById } from "../services/clients.service"
import {
    listRecurringEntries,
    deleteRecurringEntry,
    setRecurringEntryActive,
    runRecurringEntry,
    skipRecurringEntry,
} from "../services/recurring.service"
import { useNotification } from "../contexts/notification.context"
import ConfirmModal from "../components/ui/ConfirmModal"
import EmptyState from "../components/ui/EmptyState"

const RecurringEntryModal = lazy(() =>
    import("../components/ledger/RecurringEntryModal"),
)

const FREQUENCY_LABEL = {
    monthly: "Monthly",
    yearly: "Yearly",
    weekly: "Weekly",
    biweekly: "Every two weeks",
}

const DAY_OF_WEEK_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

function formatDateLong(iso) {
    if (!iso) return ""
    const d = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(d)
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))
}

function describeSchedule(row) {
    if (row.frequency === "monthly") {
        return `Every month on day ${row.dayOfMonth}`
    }
    if (row.frequency === "yearly") {
        return `Every year on ${MONTH_NAMES[(row.monthOfYear || 1) - 1]} ${row.dayOfMonth}`
    }
    if (row.frequency === "weekly") {
        return `Every ${DAY_OF_WEEK_NAMES[row.dayOfWeek ?? 1]}`
    }
    if (row.frequency === "biweekly") {
        return `Every other ${DAY_OF_WEEK_NAMES[row.dayOfWeek ?? 1]}`
    }
    return FREQUENCY_LABEL[row.frequency] || row.frequency
}

function RecurringTransactionsPage() {
    const { clientId } = useParams()
    const navigate = useNavigate()
    const { error, success } = useNotification()

    const [client, setClient] = useState(null)
    const [items, setItems] = useState([])
    const [isLoading, setIsLoading] = useState(false)

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    const [deletingId, setDeletingId] = useState("")
    const [confirmDeleteRow, setConfirmDeleteRow] = useState(null)
    const [actionRowId, setActionRowId] = useState("")

    useEffect(() => {
        if (!clientId) return
        getClientById(clientId)
            .then((data) => setClient(data || null))
            .catch(() => setClient(null))
    }, [clientId])

    const reload = useCallback(async () => {
        if (!clientId) return
        setIsLoading(true)
        try {
            const res = await listRecurringEntries(clientId)
            setItems(Array.isArray(res?.items) ? res.items : [])
        } catch (err) {
            error(err?.message || "Failed to load recurring entries")
        } finally {
            setIsLoading(false)
        }
    }, [clientId, error])

    useEffect(() => {
        reload()
    }, [reload])

    const sorted = useMemo(() => {
        return [...items].sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
            if (a.isDue !== b.isDue) return a.isDue ? -1 : 1
            return String(a.nextRunDate || "").localeCompare(String(b.nextRunDate || ""))
        })
    }, [items])

    const openCreate = () => {
        setEditing(null)
        setIsModalOpen(true)
    }
    const openEdit = (row) => {
        setEditing(row)
        setIsModalOpen(true)
    }

    const handleRunNow = async (row) => {
        try {
            setActionRowId(String(row._id))
            const res = await runRecurringEntry(row._id)
            success(`Created entry dated ${formatDateLong(res?.entry?.date)}`)
            await reload()
        } catch (err) {
            showApiError({ error, err, fallbackMessage: "Failed to run recurring entry", navigate, clientId })
        } finally {
            setActionRowId("")
        }
    }

    const handleSkip = async (row) => {
        try {
            setActionRowId(String(row._id))
            await skipRecurringEntry(row._id)
            success("Skipped to next run")
            await reload()
        } catch (err) {
            error(err?.message || "Failed to skip")
        } finally {
            setActionRowId("")
        }
    }

    const handleToggleActive = async (row) => {
        try {
            setActionRowId(String(row._id))
            await setRecurringEntryActive(row._id, !row.isActive)
            success(row.isActive ? "Paused" : "Resumed")
            await reload()
        } catch (err) {
            error(err?.message || "Failed to update status")
        } finally {
            setActionRowId("")
        }
    }

    const handleConfirmDelete = async () => {
        if (!confirmDeleteRow) return
        try {
            setDeletingId(String(confirmDeleteRow._id))
            await deleteRecurringEntry(confirmDeleteRow._id)
            success("Recurring entry deleted")
            setConfirmDeleteRow(null)
            await reload()
        } catch (err) {
            error(err?.message || "Failed to delete")
        } finally {
            setDeletingId("")
        }
    }

    return (
        <section className="h-full w-full px-12 py-8">
            <div className="mx-auto flex h-full max-w-7xl flex-col gap-6">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-gray-900">Recurring Transactions</h1>
                        <p className="text-sm text-gray-500">
                            {client?.name || ""}
                            {" · "}
                            Templates for rent, payroll, subscriptions and other entries that repeat on a schedule.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                        </svg>
                        New recurring entry
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
                    {isLoading && items.length === 0 ? (
                        <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
                            Loading…
                        </div>
                    ) : items.length === 0 ? (
                        <EmptyState
                            icon={(
                                <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12a9 9 0 0 1 15-6.7l3 2.7" />
                                    <path d="M21 4v5h-5" />
                                    <path d="M21 12a9 9 0 0 1-15 6.7l-3-2.7" />
                                    <path d="M3 20v-5h5" />
                                </svg>
                            )}
                            title="No recurring entries yet"
                            description="Set up templates for transactions that repeat — rent, payroll, subscriptions, depreciation — and post each occurrence with one click."
                            primaryAction={{
                                label: "New recurring entry",
                                onClick: openCreate,
                            }}
                        />
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-4 py-2.5 text-left">Name</th>
                                    <th className="px-4 py-2.5 text-left">Schedule</th>
                                    <th className="w-28 px-4 py-2.5 text-right">Amount</th>
                                    <th className="w-32 px-4 py-2.5 text-left">Next run</th>
                                    <th className="w-32 px-4 py-2.5 text-left">Last run</th>
                                    <th className="w-28 px-4 py-2.5 text-left">Status</th>
                                    <th className="w-64 px-4 py-2.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sorted.map((row) => {
                                    const busy = actionRowId === String(row._id) || deletingId === String(row._id)
                                    return (
                                        <tr key={row._id} className={!row.isActive ? "opacity-60" : ""}>
                                            <td className="px-4 py-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(row)}
                                                    className="text-left font-medium text-gray-900 hover:underline"
                                                >
                                                    {row.name || "—"}
                                                </button>
                                                {row.description && (
                                                    <p className="text-[11px] text-gray-500">
                                                        {row.description}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-700">
                                                {describeSchedule(row)}
                                                {row.endDate && (
                                                    <p className="text-[11px] text-gray-500">
                                                        ends {formatDateLong(row.endDate)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">
                                                {formatCurrency(row.totalDebits || 0)}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-700 tabular-nums">
                                                {row.nextRunDate ? formatDateLong(row.nextRunDate) : "—"}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 tabular-nums">
                                                {row.lastRunDate ? formatDateLong(row.lastRunDate) : "—"}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <StatusBadge row={row} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {row.isActive && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRunNow(row)}
                                                            disabled={busy}
                                                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                                                                row.isDue
                                                                    ? "bg-gray-900 text-white hover:bg-black"
                                                                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                                                            } disabled:cursor-not-allowed disabled:opacity-60`}
                                                            title="Generate a journal entry now and advance the schedule"
                                                        >
                                                            Run now
                                                        </button>
                                                    )}
                                                    {row.isActive && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSkip(row)}
                                                            disabled={busy}
                                                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                                                            title="Advance the schedule without creating an entry"
                                                        >
                                                            Skip
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleActive(row)}
                                                        disabled={busy}
                                                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                                                    >
                                                        {row.isActive ? "Pause" : "Resume"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteRow(row)}
                                                        disabled={busy}
                                                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                                                        title="Delete"
                                                        aria-label="Delete"
                                                    >
                                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M3 6h18" />
                                                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <Suspense fallback={null}>
                <RecurringEntryModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    clientId={clientId}
                    initial={editing}
                    onSaved={() => {
                        reload().catch(() => {})
                    }}
                />
            </Suspense>

            <ConfirmModal
                isOpen={Boolean(confirmDeleteRow)}
                title="Delete recurring entry"
                message={
                    confirmDeleteRow
                        ? `Delete "${confirmDeleteRow.name}"? This removes the template only — past journal entries it generated stay in the books.`
                        : ""
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                isLoading={Boolean(deletingId)}
                onConfirm={handleConfirmDelete}
                onClose={() => (deletingId ? undefined : setConfirmDeleteRow(null))}
            />
        </section>
    )
}

function StatusBadge({ row }) {
    if (!row.isActive) {
        return (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                Paused
            </span>
        )
    }
    if (row.isDue) {
        return (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                Due now
            </span>
        )
    }
    return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            Scheduled
        </span>
    )
}

export default RecurringTransactionsPage
