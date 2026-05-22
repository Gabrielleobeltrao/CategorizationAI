import { useEffect, useMemo, useState } from "react"
import PopupModal from "../ui/PopupModal"
import { listAccountsByClientId } from "../../services/accounts.service"
import { createJournalEntry } from "../../services/journalEntries.service"
import { ACCOUNT_TYPE_LABELS } from "../../constants/accountTypes"
import { useNotification } from "../../contexts/notification.context"

// Multi-leg manual journal entry editor. Lets the bookkeeper post
// adjustments that don't fit the bank-import shape (depreciation,
// accruals, payroll splits, reclassifications). Each row is one leg
// — either a debit OR a credit, never both — and the entry only saves
// when total debits = total credits and at least 2 legs are filled.

const BALANCE_EPSILON = 0.005

function todayIso() {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
        .toISOString()
        .slice(0, 10)
}

function emptyLeg() {
    return { accountId: "", debit: "", credit: "", description: "" }
}

function round2(value) {
    return Math.round(Number(value || 0) * 100) / 100
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))
}

function JournalEntryModal({ isOpen, onClose, clientId, onCreated }) {
    const { error, success } = useNotification()
    const [date, setDate] = useState(todayIso())
    const [description, setDescription] = useState("")
    const [legs, setLegs] = useState([emptyLeg(), emptyLeg()])
    const [accounts, setAccounts] = useState([])
    const [isSaving, setIsSaving] = useState(false)

    // Load full chart of accounts when the modal opens.
    useEffect(() => {
        if (!isOpen || !clientId) return
        let active = true
        listAccountsByClientId(clientId, { includeAllTypes: true })
            .then((list) => {
                if (!active) return
                const arr = Array.isArray(list) ? list : []
                arr.sort((a, b) => {
                    const at = String(a?.accountType || "")
                    const bt = String(b?.accountType || "")
                    if (at !== bt) return at.localeCompare(bt)
                    return String(a?.name || "").localeCompare(String(b?.name || ""))
                })
                setAccounts(arr)
            })
            .catch((err) => {
                if (!active) return
                error(err?.message || "Failed to load accounts")
            })
        return () => {
            active = false
        }
    }, [isOpen, clientId, error])

    // Reset state when the modal opens.
    useEffect(() => {
        if (!isOpen) return
        setDate(todayIso())
        setDescription("")
        setLegs([emptyLeg(), emptyLeg()])
    }, [isOpen])

    const updateLeg = (index, field, value) => {
        setLegs((current) =>
            current.map((row, i) => {
                if (i !== index) return row
                const next = { ...row, [field]: value }
                // Mutually exclusive: typing in debit clears credit and vice-versa.
                if (field === "debit" && value !== "") next.credit = ""
                if (field === "credit" && value !== "") next.debit = ""
                return next
            }),
        )
    }

    const addLeg = () => setLegs((current) => [...current, emptyLeg()])

    const removeLeg = (index) =>
        setLegs((current) =>
            current.length <= 2 ? current : current.filter((_, i) => i !== index),
        )

    const totals = useMemo(() => {
        let debits = 0
        let credits = 0
        for (const leg of legs) {
            const d = Number(leg.debit || 0)
            const c = Number(leg.credit || 0)
            if (Number.isFinite(d)) debits += d
            if (Number.isFinite(c)) credits += c
        }
        debits = round2(debits)
        credits = round2(credits)
        return { debits, credits, difference: round2(debits - credits) }
    }, [legs])

    const filledLegs = useMemo(
        () =>
            legs.filter(
                (l) =>
                    l.accountId &&
                    (Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0),
            ),
        [legs],
    )

    const isBalanced = Math.abs(totals.difference) < BALANCE_EPSILON
    const canSave =
        Boolean(date) &&
        filledLegs.length >= 2 &&
        isBalanced &&
        totals.debits > 0 &&
        !isSaving

    const handleSave = async (e) => {
        e?.preventDefault?.()
        if (!canSave) return
        try {
            setIsSaving(true)
            const payload = {
                clientId,
                date,
                description: description.trim(),
                legs: filledLegs.map((l) => ({
                    accountId: l.accountId,
                    debit: Number(l.debit || 0) || 0,
                    credit: Number(l.credit || 0) || 0,
                    description: l.description?.trim() || "",
                })),
                source: "manual",
            }
            const created = await createJournalEntry(payload)
            success("Journal entry created")
            onClose?.()
            onCreated?.(created)
        } catch (err) {
            error(err?.message || "Failed to create journal entry")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <PopupModal
            isOpen={isOpen}
            title="New journal entry"
            onClose={() => (isSaving ? undefined : onClose?.())}
            maxWidthClass="max-w-4xl"
        >
            <form className="flex flex-col gap-5" onSubmit={handleSave}>
                <p className="text-[12px] text-gray-500">
                    Manual journal entries are for adjustments that don't come from a bank import:
                    depreciation, accruals, payroll splits, reclassifications. Each line is one leg —
                    either a debit OR a credit. Total debits must equal total credits.
                </p>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Date
                        </span>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Memo <span className="text-gray-400 normal-case">(optional)</span>
                        </span>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. April depreciation, Q1 payroll accrual"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </label>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Lines
                        </span>
                        <button
                            type="button"
                            onClick={addLeg}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                            </svg>
                            Add line
                        </button>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Account</th>
                                    <th className="w-24 px-3 py-2 text-right">Debit</th>
                                    <th className="w-24 px-3 py-2 text-right">Credit</th>
                                    <th className="px-3 py-2 text-left">Line memo</th>
                                    <th className="w-8 px-1 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {legs.map((leg, idx) => (
                                    <tr key={idx} className="bg-white">
                                        <td className="px-2 py-1.5">
                                            <div className="relative">
                                                <select
                                                    value={leg.accountId}
                                                    onChange={(e) =>
                                                        updateLeg(idx, "accountId", e.target.value)
                                                    }
                                                    className="w-full appearance-none rounded-md border border-gray-300 bg-white px-2.5 py-1.5 pr-7 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                                >
                                                    <option value="">Account…</option>
                                                    {accounts.map((acc) => (
                                                        <option key={acc._id || acc.id} value={String(acc._id || acc.id)}>
                                                            {acc.name}
                                                            {acc.accountType
                                                                ? `  ·  ${ACCOUNT_TYPE_LABELS[acc.accountType] || acc.accountType}`
                                                                : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                <svg
                                                    className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
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
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={leg.debit}
                                                onChange={(e) => updateLeg(idx, "debit", e.target.value)}
                                                placeholder="0.00"
                                                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                            />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={leg.credit}
                                                onChange={(e) => updateLeg(idx, "credit", e.target.value)}
                                                placeholder="0.00"
                                                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                            />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input
                                                type="text"
                                                value={leg.description}
                                                onChange={(e) =>
                                                    updateLeg(idx, "description", e.target.value)
                                                }
                                                placeholder="Line note (optional)"
                                                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                            />
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => removeLeg(idx)}
                                                disabled={legs.length <= 2}
                                                title="Remove line"
                                                aria-label="Remove line"
                                                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                            >
                                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" />
                                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div
                    className={`grid grid-cols-3 gap-3 rounded-lg border px-3 py-2.5 ${
                        isBalanced && totals.debits > 0
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-rose-200 bg-rose-50"
                    }`}
                >
                    <Kpi label="Total debits" value={formatCurrency(totals.debits)} />
                    <Kpi label="Total credits" value={formatCurrency(totals.credits)} />
                    <Kpi
                        label="Difference"
                        value={formatCurrency(totals.difference)}
                        emphasis={isBalanced && totals.debits > 0 ? "good" : "bad"}
                    />
                </div>

                <div className="-mx-5 -mb-4 mt-1 flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:-mx-6 sm:-mb-4 sm:px-6">
                    <p className="text-[11px] text-gray-500">
                        {filledLegs.length < 2
                            ? "At least 2 lines with account + amount are required."
                            : isBalanced
                            ? "The entry is balanced and ready to save."
                            : `Difference: ${formatCurrency(totals.difference)}`}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSave}
                            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSaving ? "Saving…" : "Post entry"}
                        </button>
                    </div>
                </div>
            </form>
        </PopupModal>
    )
}

function Kpi({ label, value, emphasis }) {
    return (
        <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <span
                className={`text-base font-semibold tabular-nums ${
                    emphasis === "good"
                        ? "text-emerald-700"
                        : emphasis === "bad"
                        ? "text-rose-700"
                        : "text-gray-900"
                }`}
            >
                {value}
            </span>
        </div>
    )
}

export default JournalEntryModal
