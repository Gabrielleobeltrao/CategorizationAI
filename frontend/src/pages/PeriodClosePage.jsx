import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import {
    getCurrentState,
    getPreCloseChecks,
    listPeriodCloseHistory,
    closePeriod,
    reopenPeriod,
} from "../services/periodClose.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import ConfirmModal from "../components/ui/ConfirmModal"

function lastDayOfPrevMonthIso() {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
        .toISOString()
        .slice(0, 10)
}

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

function formatTimestamp(iso) {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

function PeriodClosePage() {
    const { clientId } = useParams()
    const { profile } = useAuth()
    const { error, success } = useNotification()

    const [client, setClient] = useState(null)
    const [state, setState] = useState({ closedThroughDate: null, closedAt: null, closedBy: null })
    const [history, setHistory] = useState([])
    const [employeesById, setEmployeesById] = useState(new Map())

    const [throughDate, setThroughDate] = useState(lastDayOfPrevMonthIso())
    const [note, setNote] = useState("")
    const [checks, setChecks] = useState(null)
    const [isChecking, setIsChecking] = useState(false)

    const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false)
    const [isConfirmReopenOpen, setIsConfirmReopenOpen] = useState(false)
    const [isMutating, setIsMutating] = useState(false)

    const loadAll = useCallback(async () => {
        if (!clientId) return
        try {
            const [clientDoc, current, hist] = await Promise.all([
                getClientById(clientId).catch(() => null),
                getCurrentState(clientId).catch(() => ({ closedThroughDate: null })),
                listPeriodCloseHistory(clientId, { limit: 50 }).catch(() => ({ items: [] })),
            ])
            setClient(clientDoc || null)
            setState(current || { closedThroughDate: null, closedAt: null, closedBy: null })
            setHistory(Array.isArray(hist?.items) ? hist.items : [])
        } catch (err) {
            error(err?.message || "Failed to load period close state")
        }
    }, [clientId, error])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    // Resolve user IDs to names
    useEffect(() => {
        const officeId = String(profile?.officeId || "").trim()
        if (!officeId) return
        let active = true
        listEmployeesByOfficeId(officeId)
            .then((list) => {
                if (!active) return
                const map = new Map()
                for (const emp of Array.isArray(list) ? list : []) {
                    const id = String(emp?._id || emp?.id || "")
                    if (!id) continue
                    map.set(id, emp?.name || emp?.email || id)
                }
                setEmployeesById(map)
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [profile?.officeId])

    // Re-run pre-close checks when throughDate changes (debounced).
    useEffect(() => {
        if (!clientId || !throughDate) {
            setChecks(null)
            return
        }
        const handle = setTimeout(async () => {
            try {
                setIsChecking(true)
                const res = await getPreCloseChecks(clientId, throughDate)
                setChecks(res || null)
            } catch (err) {
                error(err?.message || "Failed to run pre-close checks")
            } finally {
                setIsChecking(false)
            }
        }, 250)
        return () => clearTimeout(handle)
    }, [clientId, throughDate, error])

    const handleClose = async () => {
        if (!throughDate) {
            error("Pick a closing date first")
            return
        }
        try {
            setIsMutating(true)
            await closePeriod(clientId, { throughDate, note })
            success(`Closed through ${formatDateLong(throughDate)}`)
            setIsConfirmCloseOpen(false)
            setNote("")
            await loadAll()
        } catch (err) {
            error(err?.message || "Failed to close period")
        } finally {
            setIsMutating(false)
        }
    }

    const handleReopen = async () => {
        try {
            setIsMutating(true)
            await reopenPeriod(clientId, { note: "" })
            success("Period reopened")
            setIsConfirmReopenOpen(false)
            await loadAll()
        } catch (err) {
            error(err?.message || "Failed to reopen period")
        } finally {
            setIsMutating(false)
        }
    }

    const nameOf = (id) => (id ? employeesById.get(String(id)) || "" : "")
    const closedByName = nameOf(state.closedBy)
    const isClosed = Boolean(state.closedThroughDate)

    return (
        <section className="h-full w-full px-12 py-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold text-gray-900">Period Close</h1>
                <p className="text-sm text-gray-500">{client?.name || ""}</p>
            </header>

            <section
                className={`rounded-xl border p-4 ${
                    isClosed ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"
                }`}
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Current state
                        </p>
                        {isClosed ? (
                            <>
                                <h2 className="mt-1 text-lg font-semibold text-emerald-800">
                                    Closed through {formatDateLong(state.closedThroughDate)}
                                </h2>
                                <p className="text-sm text-emerald-900/80">
                                    {state.closedAt
                                        ? `Closed ${formatTimestamp(state.closedAt)}${
                                              closedByName ? ` by ${closedByName}` : ""
                                          }`
                                        : ""}
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="mt-1 text-lg font-semibold text-gray-900">
                                    Books are open
                                </h2>
                                <p className="text-sm text-gray-600">
                                    No period has been closed yet.
                                </p>
                            </>
                        )}
                    </div>
                    {isClosed && (
                        <button
                            type="button"
                            onClick={() => setIsConfirmReopenOpen(true)}
                            disabled={isMutating}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 3-6.7" />
                                <path d="M3 4v5h5" />
                            </svg>
                            Reopen period
                        </button>
                    )}
                </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-base font-semibold text-gray-900">Close a new period</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Locks every transaction dated on or before the chosen date. To make further changes
                    inside that range, you'll need to reopen the period.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Close through
                        </span>
                        <input
                            type="date"
                            value={throughDate}
                            onChange={(e) => setThroughDate(e.target.value)}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Memo <span className="text-gray-400 normal-case">(optional)</span>
                        </span>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. April month-end close after reconciliation"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </label>
                </div>

                <PreCloseChecks checks={checks} isChecking={isChecking} />

                <div className="mt-4 flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => setIsConfirmCloseOpen(true)}
                        disabled={!throughDate || isMutating}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Close period
                    </button>
                </div>
            </section>

            {history.length > 0 && (
                <section className="rounded-xl border border-gray-200 bg-white">
                    <header className="border-b border-gray-100 px-4 py-2.5">
                        <h2 className="text-sm font-semibold text-gray-900">History</h2>
                    </header>
                    <ul className="divide-y divide-gray-50">
                        {history.map((row) => {
                            const actorName = nameOf(row.createdBy)
                            const wasClose = row.action === "close"
                            return (
                                <li
                                    key={row._id}
                                    className="flex items-start gap-3 px-4 py-2.5 text-sm"
                                >
                                    <span
                                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                            wasClose
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-amber-100 text-amber-800"
                                        }`}
                                    >
                                        {row.action}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-gray-900">
                                            {wasClose
                                                ? `Closed through ${formatDateLong(row.closedThroughDate)}`
                                                : `Reopened — books now ${
                                                      row.closedThroughDate
                                                          ? `closed through ${formatDateLong(row.closedThroughDate)}`
                                                          : "fully open"
                                                  }`}
                                        </p>
                                        <p className="text-[12px] text-gray-500">
                                            {formatTimestamp(row.createdAt)}
                                            {actorName ? ` · ${actorName}` : ""}
                                            {row.note ? ` · "${row.note}"` : ""}
                                        </p>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}
          </div>

          <ConfirmModal
              isOpen={isConfirmCloseOpen}
              title="Close period"
              message={`This will lock every transaction dated on or before ${formatDateLong(
                  throughDate,
              )}. Edits, deletes and new entries inside that range will be blocked until the period is reopened.`}
              confirmLabel="Close period"
              cancelLabel="Cancel"
              variant="primary"
              isLoading={isMutating}
              onConfirm={handleClose}
              onClose={() => (isMutating ? undefined : setIsConfirmCloseOpen(false))}
          />

          <ConfirmModal
              isOpen={isConfirmReopenOpen}
              title="Reopen period"
              message={`Anyone with write access will be able to edit transactions dated on or before ${formatDateLong(
                  state.closedThroughDate,
              )} again. This action is logged.`}
              confirmLabel="Reopen period"
              cancelLabel="Cancel"
              variant="danger"
              isLoading={isMutating}
              onConfirm={handleReopen}
              onClose={() => (isMutating ? undefined : setIsConfirmReopenOpen(false))}
          />
        </section>
    )
}

function PreCloseChecks({ checks, isChecking }) {
    if (!checks && !isChecking) return null
    const unreconciled = checks?.unreconciledByAccount || []
    const uncategorized = Number(checks?.uncategorizedCount || 0)
    const hasWarnings = unreconciled.length > 0 || uncategorized > 0

    if (!hasWarnings) {
        return (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                    {isChecking
                        ? "Running pre-close checks…"
                        : "All bank accounts are reconciled and every transaction in the period is categorized."}
                </span>
            </div>
        )
    }

    return (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <p className="font-semibold">
                {isChecking ? "Running pre-close checks…" : "Heads up before closing"}
            </p>
            {unreconciled.length > 0 && (
                <div>
                    <p>Bank accounts with uncleared transactions in this period:</p>
                    <ul className="ml-4 mt-0.5 list-disc">
                        {unreconciled.map((row) => (
                            <li key={row.accountId}>
                                <strong>{row.name}</strong> — {row.unclearedCount} uncleared
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {uncategorized > 0 && (
                <p>
                    <strong>{uncategorized}</strong> uncategorized transaction(s) still pointing to the
                    suspense account.
                </p>
            )}
            <p className="text-[11px] italic">
                You can still close — these are just warnings. Fix them first if you want clean books.
            </p>
        </div>
    )
}

export default PeriodClosePage
