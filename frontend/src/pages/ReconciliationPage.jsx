import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import { listAccountsByClientId } from "../services/accounts.service"
import {
    listReconciliations,
    getActiveReconciliation,
    getOpeningBalance,
    startReconciliation,
    getReconciliationWorksheet,
    updateReconciliation,
    completeReconciliation,
    reopenReconciliation,
    cancelReconciliation,
} from "../services/reconciliation.service"
import { ACCOUNT_TYPE_LABELS } from "../constants/accountTypes"
import { useNotification } from "../contexts/notification.context"
import { useAuth } from "../contexts/auth.context"
import { listEmployeesByOfficeId } from "../services/employees.service"
import { createHalfEntry } from "../services/journalEntries.service"
import ConfirmModal from "../components/ui/ConfirmModal"
import PopupModal from "../components/ui/PopupModal"

const BANK_LIKE_TYPES = [
    "asset_current",
    "asset_noncurrent",
    "liability_current",
    "liability_noncurrent",
]

function todayIso() {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
        .toISOString()
        .slice(0, 10)
}

function formatCurrency(value) {
    const n = Number(value || 0)
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n)
}

function formatDate(iso) {
    if (!iso) return ""
    const d = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(d)
}

function ReconciliationPage() {
    const { clientId } = useParams()
    const { error, success } = useNotification()
    const { profile } = useAuth()

    const [client, setClient] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [history, setHistory] = useState([])
    const [employeesById, setEmployeesById] = useState(new Map())

    // Add-missing-transaction modal
    const [isAddTxnOpen, setIsAddTxnOpen] = useState(false)
    const [newTxnDate, setNewTxnDate] = useState(todayIso())
    const [newTxnDescription, setNewTxnDescription] = useState("")
    const [newTxnAmount, setNewTxnAmount] = useState("")
    const [newTxnDirection, setNewTxnDirection] = useState("out")  // "in" | "out"
    const [isSavingNewTxn, setIsSavingNewTxn] = useState(false)

    // Worksheet filters
    const [filterFrom, setFilterFrom] = useState("")
    const [filterTo, setFilterTo] = useState("")
    const [filterSearch, setFilterSearch] = useState("")

    // Setup
    const [accountId, setAccountId] = useState("")
    const [statementDate, setStatementDate] = useState(todayIso())
    const [statementEndingBalance, setStatementEndingBalance] = useState("")
    const [openingBalance, setOpeningBalance] = useState(0)
    const [isStarting, setIsStarting] = useState(false)

    // Active reconciliation worksheet
    const [worksheet, setWorksheet] = useState(null)
    const [isLoadingWorksheet, setIsLoadingWorksheet] = useState(false)
    const [checkedKeys, setCheckedKeys] = useState(new Set())
    const [isSaving, setIsSaving] = useState(false)
    const [confirmCancel, setConfirmCancel] = useState(false)
    const [reopeningId, setReopeningId] = useState("")

    // Load client + bank-like accounts + history on mount
    useEffect(() => {
        if (!clientId) return
        let active = true
        Promise.all([
            getClientById(clientId).catch(() => null),
            listAccountsByClientId(clientId).catch(() => []),
            listReconciliations(clientId, { limit: 50 }).catch(() => ({ items: [] })),
        ]).then(([clientDoc, accountList, recHistory]) => {
            if (!active) return
            setClient(clientDoc || null)
            const bankLike = (Array.isArray(accountList) ? accountList : []).filter((acc) =>
                BANK_LIKE_TYPES.includes(acc.accountType),
            )
            setAccounts(bankLike)
            setHistory(Array.isArray(recHistory?.items) ? recHistory.items : [])
        })
        return () => {
            active = false
        }
    }, [clientId])

    // Resolve user IDs (createdBy / completedBy / reopenedBy) to names
    // via the office's employees list.
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

    // When the user picks an account, check if there's an in-progress
    // reconciliation to resume, and load the proposed opening balance.
    useEffect(() => {
        if (!clientId || !accountId) {
            setOpeningBalance(0)
            return
        }
        let active = true
        Promise.all([
            getActiveReconciliation(clientId, accountId).catch(() => ({ reconciliation: null })),
            getOpeningBalance(clientId, accountId).catch(() => ({ openingBalance: 0 })),
        ]).then(async ([activeRes, openingRes]) => {
            if (!active) return
            setOpeningBalance(Number(openingRes?.openingBalance || 0))
            if (activeRes?.reconciliation?._id) {
                loadWorksheet(String(activeRes.reconciliation._id))
            } else {
                setWorksheet(null)
                setCheckedKeys(new Set())
            }
        })
        return () => {
            active = false
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId, accountId])

    const loadWorksheet = useCallback(async (reconciliationId) => {
        setIsLoadingWorksheet(true)
        try {
            const payload = await getReconciliationWorksheet(reconciliationId)
            setWorksheet(payload || null)
            const next = new Set(
                (payload?.items || [])
                    .filter((it) => it.isCheckedInThisReconciliation)
                    .map((it) => `${it.entryId}:${it.legIndex}`),
            )
            setCheckedKeys(next)
        } catch (err) {
            error(err?.message || "Failed to load worksheet")
        } finally {
            setIsLoadingWorksheet(false)
        }
    }, [error])

    const reloadHistory = useCallback(async () => {
        try {
            const res = await listReconciliations(clientId, { limit: 50 })
            setHistory(Array.isArray(res?.items) ? res.items : [])
        } catch {
            /* ignore */
        }
    }, [clientId])

    const handleStart = async (e) => {
        e?.preventDefault?.()
        if (!accountId) {
            error("Select an account")
            return
        }
        const balance = Number(statementEndingBalance)
        if (!Number.isFinite(balance)) {
            error("Enter the statement ending balance")
            return
        }
        try {
            setIsStarting(true)
            const created = await startReconciliation(clientId, {
                accountId,
                statementDate,
                statementEndingBalance: balance,
                openingBalance,
            })
            await loadWorksheet(String(created._id))
            await reloadHistory()
        } catch (err) {
            error(err?.message || "Failed to start reconciliation")
        } finally {
            setIsStarting(false)
        }
    }

    const toggleLeg = (key) => {
        setCheckedKeys((current) => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const buildLegRefs = useCallback(() => {
        const refs = []
        for (const key of checkedKeys) {
            const [entryId, idx] = key.split(":")
            refs.push({ entryId, legIndex: Number(idx) })
        }
        return refs
    }, [checkedKeys])

    // Autosave progress whenever checked set changes (debounced).
    useEffect(() => {
        if (!worksheet?.reconciliation?._id) return
        if (worksheet?.reconciliation?.status !== "in_progress") return
        const id = String(worksheet.reconciliation._id)
        const refs = buildLegRefs()
        const handle = setTimeout(async () => {
            try {
                setIsSaving(true)
                const updated = await updateReconciliation(id, refs)
                setWorksheet((current) =>
                    current ? { ...current, reconciliation: updated || current.reconciliation } : current,
                )
            } catch {
                /* swallow autosave errors */
            } finally {
                setIsSaving(false)
            }
        }, 350)
        return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkedKeys])

    const computed = useMemo(() => {
        if (!worksheet) return { clearedTotal: 0, target: 0, difference: 0 }
        let cleared = 0
        for (const item of worksheet.items || []) {
            const key = `${item.entryId}:${item.legIndex}`
            if (checkedKeys.has(key)) cleared += Number(item.signedAmount || 0)
        }
        const rounded = Math.round(cleared * 100) / 100
        const target = Number(worksheet.target || 0)
        return {
            clearedTotal: rounded,
            target,
            difference: Math.round((rounded - target) * 100) / 100,
        }
    }, [worksheet, checkedKeys])

    const isBalanced = Math.abs(computed.difference) < 0.005

    const handleComplete = async () => {
        if (!worksheet?.reconciliation?._id) return
        if (!isBalanced) {
            error(`Cannot complete: difference is ${formatCurrency(computed.difference)}`)
            return
        }
        try {
            setIsSaving(true)
            await completeReconciliation(
                String(worksheet.reconciliation._id),
                buildLegRefs(),
            )
            success("Reconciliation completed")
            setWorksheet(null)
            setCheckedKeys(new Set())
            setStatementEndingBalance("")
            await reloadHistory()
        } catch (err) {
            error(err?.message || "Failed to complete reconciliation")
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancelInProgress = async () => {
        if (!worksheet?.reconciliation?._id) return
        try {
            await cancelReconciliation(String(worksheet.reconciliation._id))
            success("Reconciliation cancelled")
            setWorksheet(null)
            setCheckedKeys(new Set())
            setConfirmCancel(false)
            await reloadHistory()
        } catch (err) {
            error(err?.message || "Failed to cancel reconciliation")
        }
    }

    const openAddTxnModal = () => {
        setNewTxnDate(worksheet?.reconciliation?.statementDate || todayIso())
        setNewTxnDescription("")
        setNewTxnAmount("")
        setNewTxnDirection("out")
        setIsAddTxnOpen(true)
    }

    const handleAddMissingTransaction = async (e) => {
        e?.preventDefault?.()
        if (!worksheet?.reconciliation) return
        const amountAbs = Number(newTxnAmount)
        if (!Number.isFinite(amountAbs) || amountAbs <= 0) {
            error("Amount must be a positive number")
            return
        }
        const description = newTxnDescription.trim()
        if (!description) {
            error("Description is required")
            return
        }
        const signed = newTxnDirection === "in" ? amountAbs : -amountAbs
        try {
            setIsSavingNewTxn(true)
            await createHalfEntry({
                clientId,
                bankAccountId: worksheet.reconciliation.accountId,
                date: newTxnDate,
                description,
                amount: signed,
            })
            success("Transaction added")
            setIsAddTxnOpen(false)
            await loadWorksheet(String(worksheet.reconciliation._id))
        } catch (err) {
            error(err?.message || "Failed to add transaction")
        } finally {
            setIsSavingNewTxn(false)
        }
    }

    const handleReopen = async (reconciliationId) => {
        try {
            setReopeningId(reconciliationId)
            const reopened = await reopenReconciliation(reconciliationId)
            setAccountId(String(reopened.accountId || ""))
            await loadWorksheet(reconciliationId)
            await reloadHistory()
            success("Reconciliation reopened")
        } catch (err) {
            error(err?.message || "Failed to reopen reconciliation")
        } finally {
            setReopeningId("")
        }
    }

    const isWorksheetActive = Boolean(worksheet?.reconciliation?._id)

    return (
        <section className="h-full w-full px-12 py-8">
            <div className="mx-auto flex h-full max-w-7xl flex-col gap-6">
                <header className="flex flex-col gap-1">
                    <h1 className="text-xl font-semibold text-gray-900">Bank Reconciliation</h1>
                    <p className="text-sm text-gray-500">
                        {client?.name || ""}
                    </p>
                </header>

                {!isWorksheetActive ? (
                    <SetupCard
                        accounts={accounts}
                        accountId={accountId}
                        setAccountId={setAccountId}
                        statementDate={statementDate}
                        setStatementDate={setStatementDate}
                        statementEndingBalance={statementEndingBalance}
                        setStatementEndingBalance={setStatementEndingBalance}
                        openingBalance={openingBalance}
                        onSubmit={handleStart}
                        isStarting={isStarting}
                    />
                ) : (
                    <Worksheet
                        worksheet={worksheet}
                        isLoading={isLoadingWorksheet}
                        checkedKeys={checkedKeys}
                        toggleLeg={toggleLeg}
                        computed={computed}
                        isBalanced={isBalanced}
                        isSaving={isSaving}
                        onComplete={handleComplete}
                        onCancel={() => setConfirmCancel(true)}
                        onAddMissingTxn={openAddTxnModal}
                        filterFrom={filterFrom}
                        filterTo={filterTo}
                        filterSearch={filterSearch}
                        setFilterFrom={setFilterFrom}
                        setFilterTo={setFilterTo}
                        setFilterSearch={setFilterSearch}
                    />
                )}

                <HistorySection
                    history={history}
                    accounts={accounts}
                    reopeningId={reopeningId}
                    onReopen={handleReopen}
                    employeesById={employeesById}
                />
            </div>

            <ConfirmModal
                isOpen={confirmCancel}
                title="Cancel reconciliation"
                message="The in-progress worksheet will be deleted. Any checked legs go back to uncleared. Continue?"
                confirmLabel="Cancel reconciliation"
                cancelLabel="Keep working"
                variant="danger"
                onConfirm={handleCancelInProgress}
                onClose={() => setConfirmCancel(false)}
            />

            <PopupModal
                isOpen={isAddTxnOpen}
                title="Add missing transaction"
                onClose={() => (isSavingNewTxn ? undefined : setIsAddTxnOpen(false))}
                maxWidthClass="max-w-lg"
            >
                <form className="flex flex-col gap-4" onSubmit={handleAddMissingTransaction}>
                    <p className="text-[12px] text-gray-500">
                        Use this when a line on the statement isn't in the system yet. The transaction
                        will be created as <strong>uncategorized</strong> — you can pick the contra-account
                        later from the Transactions page.
                    </p>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date</span>
                            <input
                                type="date"
                                value={newTxnDate}
                                onChange={(e) => setNewTxnDate(e.target.value)}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Direction</span>
                            <div className="relative">
                                <select
                                    value={newTxnDirection}
                                    onChange={(e) => setNewTxnDirection(e.target.value)}
                                    className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                >
                                    <option value="in">Money in (deposit / credit)</option>
                                    <option value="out">Money out (withdrawal / debit)</option>
                                </select>
                                <svg
                                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </div>
                        </label>
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</span>
                        <input
                            type="text"
                            value={newTxnDescription}
                            onChange={(e) => setNewTxnDescription(e.target.value)}
                            placeholder="Copy from the statement line"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            autoFocus
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newTxnAmount}
                            onChange={(e) => setNewTxnAmount(e.target.value)}
                            placeholder="0.00"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                        <span className="text-[11px] text-gray-500">
                            Enter as a positive number — the direction above sets the sign.
                        </span>
                    </label>

                    <div className="mt-1 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                        <button
                            type="button"
                            onClick={() => setIsAddTxnOpen(false)}
                            disabled={isSavingNewTxn}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingNewTxn}
                            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSavingNewTxn ? "Saving…" : "Add transaction"}
                        </button>
                    </div>
                </form>
            </PopupModal>
        </section>
    )
}

function SetupCard({
    accounts,
    accountId,
    setAccountId,
    statementDate,
    setStatementDate,
    statementEndingBalance,
    setStatementEndingBalance,
    openingBalance,
    onSubmit,
    isStarting,
}) {
    return (
        <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6"
        >
            <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-gray-900">Start a new reconciliation</h2>
                <p className="text-sm text-gray-500">
                    Pick the bank or credit-card account and enter the statement ending balance.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Account
                    </span>
                    <div className="relative">
                        <select
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        >
                            <option value="">Select…</option>
                            {accounts.map((acc) => (
                                <option key={acc._id || acc.id} value={String(acc._id || acc.id)}>
                                    {acc.name} ({ACCOUNT_TYPE_LABELS[acc.accountType] || acc.accountType})
                                </option>
                            ))}
                        </select>
                        <svg
                            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </div>
                </label>

                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Statement ending date
                    </span>
                    <input
                        type="date"
                        value={statementDate}
                        onChange={(e) => setStatementDate(e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    />
                </label>

                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Statement ending balance
                    </span>
                    <input
                        type="number"
                        step="0.01"
                        value={statementEndingBalance}
                        onChange={(e) => setStatementEndingBalance(e.target.value)}
                        placeholder="0.00"
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    />
                </label>
            </div>

            <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-[12px] text-gray-700">
                Opening balance (from last reconciliation):{" "}
                <strong className="tabular-nums">{formatCurrency(openingBalance)}</strong>
            </div>

            <div className="flex justify-end gap-2">
                <button
                    type="submit"
                    disabled={isStarting || !accountId}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isStarting ? "Starting…" : "Start reconciliation"}
                </button>
            </div>
        </form>
    )
}

function Worksheet({
    worksheet,
    isLoading,
    checkedKeys,
    toggleLeg,
    computed,
    isBalanced,
    isSaving,
    onComplete,
    onCancel,
    onAddMissingTxn,
    filterFrom,
    filterTo,
    filterSearch,
    setFilterFrom,
    setFilterTo,
    setFilterSearch,
}) {
    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                Loading worksheet…
            </div>
        )
    }

    if (!worksheet) return null

    const rec = worksheet.reconciliation
    const account = worksheet.account
    const items = worksheet.items || []

    const safeSearch = (filterSearch || "").trim().toLowerCase()
    const matchesFilter = (it) => {
        if (filterFrom && it.date < filterFrom) return false
        if (filterTo && it.date > filterTo) return false
        if (safeSearch && !(it.description || "").toLowerCase().includes(safeSearch)) return false
        return true
    }

    const visibleItems = items.filter(matchesFilter)
    const hasActiveFilters = Boolean(filterFrom || filterTo || safeSearch)

    const uncleared = visibleItems.filter((it) => {
        const key = `${it.entryId}:${it.legIndex}`
        return !checkedKeys.has(key) && !it.belongsToOtherReconciliation
    })
    const cleared = visibleItems.filter((it) => {
        const key = `${it.entryId}:${it.legIndex}`
        return checkedKeys.has(key)
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Reconciling
                    </p>
                    <h2 className="text-base font-semibold text-gray-900">
                        {account?.name || "Account"}{" "}
                        <span className="text-sm font-normal text-gray-500">
                            • statement of {formatDate(rec.statementDate)}
                        </span>
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">
                        {isSaving ? "Saving…" : "Saved"}
                    </span>
                    <button
                        type="button"
                        onClick={onAddMissingTxn}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        title="Add a transaction from the statement that isn't in the system yet"
                    >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                        </svg>
                        Add missing
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onComplete}
                        disabled={!isBalanced || isSaving}
                        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Complete
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiCard label="Opening balance" value={formatCurrency(rec.openingBalance)} />
                <KpiCard label="Statement ending" value={formatCurrency(rec.statementEndingBalance)} />
                <KpiCard label="Cleared total" value={formatCurrency(computed.clearedTotal)} highlight />
                <KpiCard
                    label="Difference"
                    value={formatCurrency(computed.difference)}
                    tone={isBalanced ? "good" : "bad"}
                />
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">From</span>
                    <input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">To</span>
                    <input
                        type="date"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Search</span>
                    <div className="relative">
                        <svg
                            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            type="text"
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            placeholder="Filter by description"
                            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                </label>
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={() => {
                            setFilterFrom("")
                            setFilterTo("")
                            setFilterSearch("")
                        }}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <LegColumn
                    title="Uncleared"
                    items={uncleared}
                    onToggle={(key) => toggleLeg(key)}
                    isChecked={() => false}
                    emptyText={hasActiveFilters ? "No matches in this column for the current filters." : "All transactions checked!"}
                />
                <LegColumn
                    title="Cleared this session"
                    items={cleared}
                    onToggle={(key) => toggleLeg(key)}
                    isChecked={() => true}
                    emptyText={hasActiveFilters ? "No matches in this column for the current filters." : "No transactions checked yet."}
                />
            </div>
        </div>
    )
}

function KpiCard({ label, value, highlight, tone }) {
    const valueColor =
        tone === "good"
            ? "text-emerald-700"
            : tone === "bad"
            ? "text-rose-700"
            : highlight
            ? "text-gray-900"
            : "text-gray-900"
    return (
        <div
            className={`rounded-xl border bg-white p-3 ${
                tone === "good"
                    ? "border-emerald-200 bg-emerald-50"
                    : tone === "bad"
                    ? "border-rose-200 bg-rose-50"
                    : "border-gray-200"
            }`}
        >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${valueColor}`}>{value}</p>
        </div>
    )
}

function LegColumn({ title, items, onToggle, isChecked, emptyText }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white">
            <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                    {items.length}
                </span>
            </header>
            {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">{emptyText}</p>
            ) : (
                <ul className="max-h-[28rem] divide-y divide-gray-50 overflow-y-auto">
                    {items.map((item) => {
                        const key = `${item.entryId}:${item.legIndex}`
                        const amount = Number(item.signedAmount || 0)
                        const isIn = amount > 0
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    onClick={() => onToggle(key)}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                                >
                                    <input
                                        type="checkbox"
                                        readOnly
                                        checked={isChecked(key)}
                                        className="h-4 w-4 shrink-0"
                                    />
                                    <span className="w-20 shrink-0 text-[12px] tabular-nums text-gray-500">
                                        {formatDate(item.date)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-gray-800">
                                        {item.description || "—"}
                                    </span>
                                    <span
                                        className={`shrink-0 tabular-nums ${
                                            isIn ? "text-emerald-700" : "text-rose-700"
                                        }`}
                                    >
                                        {isIn ? "+" : ""}
                                        {formatCurrency(amount)}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
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

function HistorySection({ history, accounts, reopeningId, onReopen, employeesById }) {
    if (history.length === 0) return null
    const accountsById = new Map(accounts.map((a) => [String(a._id || a.id), a]))

    // Precompute the latest completed reconciliation per account so we can
    // restrict the "Reopen" button to that one only (matches backend rule).
    const latestCompletedIdByAccount = new Map()
    for (const rec of history) {
        if (rec.status !== "completed") continue
        const key = String(rec.accountId)
        if (!latestCompletedIdByAccount.has(key)) {
            latestCompletedIdByAccount.set(key, String(rec._id))
        }
    }

    const nameOf = (id) => {
        if (!id) return ""
        return employeesById?.get(String(id)) || ""
    }

    return (
        <section className="rounded-xl border border-gray-200 bg-white">
            <header className="border-b border-gray-100 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-gray-900">Reconciliation history</h2>
            </header>
            <ul className="divide-y divide-gray-50">
                {history.map((rec) => {
                    const acc = accountsById.get(String(rec.accountId))
                    const isLatestCompleted =
                        rec.status === "completed" &&
                        latestCompletedIdByAccount.get(String(rec.accountId)) === String(rec._id)
                    const completedByName = nameOf(rec.completedBy)
                    const reopenedByName = nameOf(rec.reopenedBy)
                    const createdByName = nameOf(rec.createdBy)
                    const audit = []
                    if (rec.completedAt) {
                        audit.push(
                            `Completed ${formatTimestamp(rec.completedAt)}${
                                completedByName ? ` by ${completedByName}` : ""
                            }`,
                        )
                    } else if (rec.createdAt) {
                        audit.push(
                            `Started ${formatTimestamp(rec.createdAt)}${
                                createdByName ? ` by ${createdByName}` : ""
                            }`,
                        )
                    }
                    if (rec.reopenedAt) {
                        audit.push(
                            `Reopened ${formatTimestamp(rec.reopenedAt)}${
                                reopenedByName ? ` by ${reopenedByName}` : ""
                            }`,
                        )
                    }

                    return (
                        <li
                            key={rec._id}
                            className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-gray-50"
                        >
                            <span className="w-24 shrink-0 pt-0.5 text-gray-700 tabular-nums">
                                {formatDate(rec.statementDate)}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-gray-900">{acc?.name || "Unknown account"}</p>
                                {audit.length > 0 && (
                                    <p className="text-[11px] text-gray-500">{audit.join(" • ")}</p>
                                )}
                            </div>
                            <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                    rec.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                }`}
                            >
                                {rec.status}
                            </span>
                            <span className="w-32 shrink-0 pt-0.5 text-right tabular-nums text-gray-700">
                                {formatCurrency(rec.statementEndingBalance)}
                            </span>
                            {isLatestCompleted && (
                                <button
                                    type="button"
                                    onClick={() => onReopen(String(rec._id))}
                                    disabled={reopeningId === String(rec._id)}
                                    className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                                >
                                    {reopeningId === String(rec._id) ? "Reopening…" : "Reopen"}
                                </button>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

export default ReconciliationPage
