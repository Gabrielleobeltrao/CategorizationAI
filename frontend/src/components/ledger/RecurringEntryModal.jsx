import { useEffect, useMemo, useState } from "react"
import PopupModal from "../ui/PopupModal"
import { listAccountsByClientId } from "../../services/accounts.service"
import {
    createRecurringEntry,
    updateRecurringEntry,
} from "../../services/recurring.service"
import { ACCOUNT_TYPE_LABELS } from "../../constants/accountTypes"
import { useNotification } from "../../contexts/notification.context"

const BALANCE_EPSILON = 0.005
const FREQUENCIES = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "biweekly", label: "Every two weeks" },
    { value: "weekly", label: "Weekly" },
]
const DAYS_OF_WEEK = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
]
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

function todayIso() {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
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

function RecurringEntryModal({ isOpen, onClose, clientId, initial, onSaved }) {
    const { error, success } = useNotification()
    const isEdit = Boolean(initial?._id)

    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [frequency, setFrequency] = useState("monthly")
    const [dayOfMonth, setDayOfMonth] = useState(1)
    const [monthOfYear, setMonthOfYear] = useState(1)
    const [dayOfWeek, setDayOfWeek] = useState(1)
    const [startDate, setStartDate] = useState(todayIso())
    const [endDate, setEndDate] = useState("")
    const [legs, setLegs] = useState([emptyLeg(), emptyLeg()])
    const [accounts, setAccounts] = useState([])
    const [isSaving, setIsSaving] = useState(false)

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

    // Hydrate form from `initial` when editing; reset when opening for create.
    useEffect(() => {
        if (!isOpen) return
        if (initial?._id) {
            setName(initial.name || "")
            setDescription(initial.description || "")
            setFrequency(initial.frequency || "monthly")
            setDayOfMonth(initial.dayOfMonth || 1)
            setMonthOfYear(initial.monthOfYear || 1)
            setDayOfWeek(initial.dayOfWeek ?? 1)
            setStartDate(initial.startDate || todayIso())
            setEndDate(initial.endDate || "")
            setLegs(
                Array.isArray(initial.legs) && initial.legs.length > 0
                    ? initial.legs.map((l) => ({
                          accountId: String(l.accountId || ""),
                          debit: l.debit ? String(l.debit) : "",
                          credit: l.credit ? String(l.credit) : "",
                          description: l.description || "",
                      }))
                    : [emptyLeg(), emptyLeg()],
            )
        } else {
            setName("")
            setDescription("")
            setFrequency("monthly")
            setDayOfMonth(1)
            setMonthOfYear(1)
            setDayOfWeek(1)
            setStartDate(todayIso())
            setEndDate("")
            setLegs([emptyLeg(), emptyLeg()])
        }
    }, [isOpen, initial])

    const updateLeg = (index, field, value) => {
        setLegs((current) =>
            current.map((row, i) => {
                if (i !== index) return row
                const next = { ...row, [field]: value }
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
            debits += Number(leg.debit || 0)
            credits += Number(leg.credit || 0)
        }
        debits = round2(debits)
        credits = round2(credits)
        return { debits, credits, difference: round2(debits - credits) }
    }, [legs])

    const filledLegs = useMemo(
        () =>
            legs.filter(
                (l) =>
                    l.accountId && (Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0),
            ),
        [legs],
    )

    const isBalanced = Math.abs(totals.difference) < BALANCE_EPSILON
    const canSave =
        Boolean(name.trim()) &&
        Boolean(startDate) &&
        filledLegs.length >= 2 &&
        isBalanced &&
        totals.debits > 0 &&
        !isSaving

    const handleSubmit = async (e) => {
        e?.preventDefault?.()
        if (!canSave) return
        try {
            setIsSaving(true)
            const payload = {
                name: name.trim(),
                description: description.trim(),
                frequency,
                dayOfMonth: ["monthly", "yearly"].includes(frequency) ? Number(dayOfMonth) : null,
                monthOfYear: frequency === "yearly" ? Number(monthOfYear) : null,
                dayOfWeek: ["weekly", "biweekly"].includes(frequency) ? Number(dayOfWeek) : null,
                startDate,
                endDate: endDate || null,
                legs: filledLegs.map((l) => ({
                    accountId: l.accountId,
                    debit: Number(l.debit || 0) || 0,
                    credit: Number(l.credit || 0) || 0,
                    description: l.description?.trim() || "",
                })),
                isActive: initial?._id ? Boolean(initial.isActive) : true,
            }
            const saved = isEdit
                ? await updateRecurringEntry(initial._id, payload)
                : await createRecurringEntry(clientId, payload)
            success(isEdit ? "Recurring entry updated" : "Recurring entry created")
            onSaved?.(saved)
            onClose?.()
        } catch (err) {
            error(err?.message || "Failed to save recurring entry")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <PopupModal
            isOpen={isOpen}
            title={isEdit ? "Edit recurring entry" : "New recurring entry"}
            onClose={() => (isSaving ? undefined : onClose?.())}
            maxWidthClass="max-w-4xl"
        >
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Name
                        </span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Monthly office rent"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            autoFocus
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Memo on generated entries{" "}
                            <span className="text-gray-400 normal-case">(optional)</span>
                        </span>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Defaults to name if empty"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </label>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Schedule
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Frequency
                            </span>
                            <div className="relative">
                                <select
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value)}
                                    className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                >
                                    {FREQUENCIES.map((f) => (
                                        <option key={f.value} value={f.value}>
                                            {f.label}
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

                        {frequency === "monthly" && (
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                    Day of month
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={dayOfMonth}
                                    onChange={(e) => setDayOfMonth(e.target.value)}
                                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                />
                            </label>
                        )}
                        {frequency === "yearly" && (
                            <>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                        Month
                                    </span>
                                    <div className="relative">
                                        <select
                                            value={monthOfYear}
                                            onChange={(e) => setMonthOfYear(Number(e.target.value))}
                                            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                        >
                                            {MONTHS.map((m, i) => (
                                                <option key={m} value={i + 1}>
                                                    {m}
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
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                        Day of month
                                    </span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={dayOfMonth}
                                        onChange={(e) => setDayOfMonth(e.target.value)}
                                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                    />
                                </label>
                            </>
                        )}
                        {(frequency === "weekly" || frequency === "biweekly") && (
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                    Day of week
                                </span>
                                <div className="relative">
                                    <select
                                        value={dayOfWeek}
                                        onChange={(e) => setDayOfWeek(Number(e.target.value))}
                                        className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                    >
                                        {DAYS_OF_WEEK.map((d) => (
                                            <option key={d.value} value={d.value}>
                                                {d.label}
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
                        )}

                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Start date
                            </span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                End date <span className="text-gray-400 normal-case">(optional)</span>
                            </span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                        </label>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Lines (each run posts these)
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
                                                        <option
                                                            key={acc._id || acc.id}
                                                            value={String(acc._id || acc.id)}
                                                        >
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

                <div className="-mx-5 -mb-4 mt-1 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:-mx-6 sm:-mb-4 sm:px-6">
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
                        {isSaving ? "Saving…" : isEdit ? "Save changes" : "Create recurring entry"}
                    </button>
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

export default RecurringEntryModal
