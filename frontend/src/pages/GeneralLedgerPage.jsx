import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import { listAccountsByClientId } from "../services/accounts.service"
import { getGeneralLedgerReport } from "../services/generalLedger.service"
import { ACCOUNT_TYPE_LABELS } from "../constants/accountTypes"
import { useNotification } from "../contexts/notification.context"
import { downloadPdfDocument } from "../utils/pdf"

function todayIso() {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
        .toISOString()
        .slice(0, 10)
}

function firstOfMonth() {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10)
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))
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

function buildCsv({ clientName, accountName, fromDate, toDate, report }) {
    const escape = (value) => {
        const safe = String(value ?? "").replace(/"/g, '""')
        return /[",\n]/.test(safe) ? `"${safe}"` : safe
    }
    const lines = [
        `General Ledger - ${clientName || ""}`,
        `Account: ${accountName || ""}`,
        `Period: ${fromDate || "—"} to ${toDate || "—"}`,
        "",
        ["Date", "Description", "Line memo", "Debit", "Credit", "Running balance"].map(escape).join(","),
        ["Opening balance", "", "", "", "", report?.openingBalance ?? 0].map(escape).join(","),
    ]
    for (const row of report?.rows || []) {
        lines.push(
            [
                row.date,
                row.description,
                row.lineDescription,
                row.debit || "",
                row.credit || "",
                row.runningBalance,
            ].map(escape).join(","),
        )
    }
    lines.push("")
    lines.push(["Total debits", "", "", report?.totals?.debit ?? 0, "", ""].map(escape).join(","))
    lines.push(["Total credits", "", "", "", report?.totals?.credit ?? 0, ""].map(escape).join(","))
    lines.push(["Closing balance", "", "", "", "", report?.closingBalance ?? 0].map(escape).join(","))
    return lines.join("\n")
}

function downloadCsv(filename, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

function buildPdfLines({ clientName, accountName, fromDate, toDate, report }) {
    const pad = (text, length) => String(text || "").slice(0, length).padEnd(length)
    const padRight = (text, length) => String(text || "").padStart(length).slice(-length)

    const lines = [
        "General Ledger",
        clientName || "-",
        `Account: ${accountName || "-"}`,
        `Period: ${fromDate || "—"} to ${toDate || "—"}`,
        "",
        `${pad("Date", 10)}  ${pad("Description", 32)}  ${padRight("Debit", 12)}  ${padRight("Credit", 12)}  ${padRight("Balance", 14)}`,
        "-".repeat(86),
        `${pad("Opening balance", 56)}  ${padRight(formatCurrency(report?.openingBalance ?? 0), 14)}`,
    ]
    for (const row of report?.rows || []) {
        const desc = row.description + (row.lineDescription ? `  (${row.lineDescription})` : "")
        lines.push(
            `${pad(row.date, 10)}  ${pad(desc, 32)}  ${padRight(row.debit ? formatCurrency(row.debit) : "", 12)}  ${padRight(row.credit ? formatCurrency(row.credit) : "", 12)}  ${padRight(formatCurrency(row.runningBalance), 14)}`,
        )
    }
    lines.push("-".repeat(86))
    lines.push(
        `${pad("Total", 10)}  ${pad("", 32)}  ${padRight(formatCurrency(report?.totals?.debit ?? 0), 12)}  ${padRight(formatCurrency(report?.totals?.credit ?? 0), 12)}`,
    )
    lines.push(
        `${pad("Closing balance", 56)}  ${padRight(formatCurrency(report?.closingBalance ?? 0), 14)}`,
    )
    return lines
}

function GeneralLedgerPage() {
    const { clientId } = useParams()
    const { error } = useNotification()

    const [client, setClient] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [accountId, setAccountId] = useState("")
    const [fromDate, setFromDate] = useState(firstOfMonth())
    const [toDate, setToDate] = useState(todayIso())
    const [report, setReport] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!clientId) return
        let active = true
        Promise.all([
            getClientById(clientId).catch(() => null),
            listAccountsByClientId(clientId, { includeAllTypes: true }).catch(() => []),
        ]).then(([clientDoc, accountList]) => {
            if (!active) return
            setClient(clientDoc || null)
            const list = Array.isArray(accountList) ? accountList : []
            list.sort((a, b) => {
                const at = String(a?.accountType || "")
                const bt = String(b?.accountType || "")
                if (at !== bt) return at.localeCompare(bt)
                return String(a?.name || "").localeCompare(String(b?.name || ""))
            })
            setAccounts(list)
            if (!accountId && list.length > 0) {
                setAccountId(String(list[0]._id || list[0].id))
            }
        })
        return () => {
            active = false
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId])

    const reload = useCallback(async () => {
        if (!clientId || !accountId) return
        setIsLoading(true)
        try {
            const payload = await getGeneralLedgerReport(clientId, {
                accountId,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
                silentLoading: true,
            })
            setReport(payload || null)
        } catch (err) {
            error(err?.message || "Failed to load general ledger")
        } finally {
            setIsLoading(false)
        }
    }, [clientId, accountId, fromDate, toDate, error])

    useEffect(() => {
        reload()
    }, [reload])

    const accountName = report?.account?.name || accounts.find((a) => String(a._id || a.id) === String(accountId))?.name || ""

    const handleExportCsv = () => {
        if (!report) return
        const csv = buildCsv({
            clientName: client?.name || "",
            accountName,
            fromDate,
            toDate,
            report,
        })
        downloadCsv(`general-ledger-${accountName.replace(/\s+/g, "-")}-${fromDate || "all"}_${toDate || "today"}.csv`, csv)
    }

    const handleExportPdf = () => {
        if (!report) return
        const lines = buildPdfLines({
            clientName: client?.name || "",
            accountName,
            fromDate,
            toDate,
            report,
        })
        downloadPdfDocument({
            filename: `general-ledger-${accountName.replace(/\s+/g, "-")}-${fromDate || "all"}_${toDate || "today"}.pdf`,
            title: "General Ledger",
            lines,
        })
    }

    const hasRows = (report?.rows || []).length > 0

    return (
        <section className="h-full w-full px-12 py-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
                <header className="flex h-full flex-col justify-between gap-8">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-gray-900">General Ledger</h1>
                        <p className="text-sm text-gray-500">
                            {accountName ? `${accountName} · ` : ""}
                            {fromDate ? formatDateLong(fromDate) : "—"} to {toDate ? formatDateLong(toDate) : "—"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={!report}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportPdf}
                            disabled={!report}
                            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            PDF
                        </button>
                    </div>
                </header>

                <div className="flex h-full flex-col justify-center rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
                                            {acc.name}
                                            {acc.accountType
                                                ? `  ·  ${ACCOUNT_TYPE_LABELS[acc.accountType] || acc.accountType}`
                                                : ""}
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
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                From
                            </span>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                To
                            </span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <SummaryCard label="Opening balance" value={formatCurrency(report?.openingBalance ?? 0)} />
                <SummaryCard label="Total debits" value={formatCurrency(report?.totals?.debit ?? 0)} />
                <SummaryCard label="Total credits" value={formatCurrency(report?.totals?.credit ?? 0)} />
                <SummaryCard label="Closing balance" value={formatCurrency(report?.closingBalance ?? 0)} highlight />
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
                {isLoading && !report ? (
                    <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
                        Loading…
                    </div>
                ) : !accountId ? (
                    <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
                        Pick an account to see its general ledger.
                    </div>
                ) : !hasRows ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-sm text-gray-500">
                        <p>No movement in this period.</p>
                        <p className="text-xs">Opening balance: <strong className="tabular-nums">{formatCurrency(report?.openingBalance ?? 0)}</strong></p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left">Date</th>
                                <th className="px-4 py-2.5 text-left">Description</th>
                                <th className="w-28 px-4 py-2.5 text-right">Debit</th>
                                <th className="w-28 px-4 py-2.5 text-right">Credit</th>
                                <th className="w-32 px-4 py-2.5 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr className="bg-gray-50/50 text-gray-600">
                                <td className="px-4 py-2 italic" colSpan={4}>
                                    Opening balance
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">
                                    {formatCurrency(report?.openingBalance ?? 0)}
                                </td>
                            </tr>
                            {report.rows.map((row) => (
                                <tr key={`${row.entryId}:${row.legIndex}`}>
                                    <td className="px-4 py-2 text-gray-700 tabular-nums">
                                        {formatDateLong(row.date)}
                                    </td>
                                    <td className="px-4 py-2 text-gray-900">
                                        <span className="block truncate">{row.description || "—"}</span>
                                        {row.lineDescription && (
                                            <span className="block truncate text-[11px] text-gray-500">
                                                {row.lineDescription}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                                        {row.debit > 0 ? formatCurrency(row.debit) : ""}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                                        {row.credit > 0 ? formatCurrency(row.credit) : ""}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">
                                        {formatCurrency(row.runningBalance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-sm font-semibold text-gray-900">
                            <tr>
                                <td className="px-4 py-2.5" colSpan={2}>
                                    Total
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                    {formatCurrency(report?.totals?.debit ?? 0)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                    {formatCurrency(report?.totals?.credit ?? 0)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                    {formatCurrency(report?.closingBalance ?? 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
          </div>
        </section>
    )
}

function SummaryCard({ label, value, highlight }) {
    return (
        <div
            className={`rounded-xl border bg-white p-3 ${
                highlight ? "border-gray-300" : "border-gray-200"
            }`}
        >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${highlight ? "text-gray-900" : "text-gray-800"}`}>{value}</p>
        </div>
    )
}

export default GeneralLedgerPage
