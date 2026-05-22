import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import { getTrialBalanceReport } from "../services/trialBalance.service"
import { useNotification } from "../contexts/notification.context"
import { downloadPdfDocument } from "../utils/pdf"
import { ACCOUNT_TYPE_LABELS } from "../constants/accountTypes"
import EmptyState from "../components/ui/EmptyState"

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

function buildCsv({ clientName, asOfDate, rows, totals }) {
    const escape = (value) => {
        const safe = String(value ?? "").replace(/"/g, '""')
        return /[",\n]/.test(safe) ? `"${safe}"` : safe
    }

    const lines = [
        `Trial Balance - ${clientName || ""}`,
        `As of ${asOfDate}`,
        "",
        ["Account", "Type", "Debit", "Credit"].map(escape).join(","),
    ]

    for (const row of rows) {
        lines.push(
            [
                row.name,
                ACCOUNT_TYPE_LABELS[row.accountType] || row.accountType,
                row.debit || "",
                row.credit || "",
            ].map(escape).join(","),
        )
    }

    if (totals) {
        lines.push("")
        lines.push(["Total", "", totals.debits, totals.credits].map(escape).join(","))
    }

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

function buildPdfLines({ clientName, asOfDate, rows, totals }) {
    const pad = (text, length) => String(text || "").slice(0, length).padEnd(length)
    const padRight = (text, length) => String(text || "").padStart(length).slice(-length)

    const lines = [
        "Trial Balance",
        clientName || "-",
        `As of ${asOfDate}`,
        "",
        `${pad("Account", 32)}  ${pad("Type", 18)}  ${padRight("Debit", 14)}  ${padRight("Credit", 14)}`,
        "-".repeat(82),
    ]

    for (const row of rows) {
        lines.push(
            `${pad(row.name, 32)}  ${pad(ACCOUNT_TYPE_LABELS[row.accountType] || row.accountType, 18)}  ${padRight(row.debit ? formatCurrency(row.debit) : "", 14)}  ${padRight(row.credit ? formatCurrency(row.credit) : "", 14)}`,
        )
    }

    if (totals) {
        lines.push("-".repeat(82))
        lines.push(
            `${pad("Total", 32)}  ${pad("", 18)}  ${padRight(formatCurrency(totals.debits), 14)}  ${padRight(formatCurrency(totals.credits), 14)}`,
        )
    }

    return lines
}

function TrialBalancePage() {
    const { clientId } = useParams()
    const { error } = useNotification()

    const [client, setClient] = useState(null)
    const [asOfDate, setAsOfDate] = useState(todayIso())
    const [report, setReport] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!clientId) return
        getClientById(clientId)
            .then((data) => setClient(data || null))
            .catch(() => setClient(null))
    }, [clientId])

    const reload = useCallback(async () => {
        if (!clientId || !asOfDate) return
        setIsLoading(true)
        try {
            const payload = await getTrialBalanceReport(clientId, {
                asOfDate,
                silentLoading: true,
            })
            setReport(payload || null)
        } catch (err) {
            error(err?.message || "Failed to load trial balance")
        } finally {
            setIsLoading(false)
        }
    }, [clientId, asOfDate, error])

    useEffect(() => {
        reload()
    }, [reload])

    const totals = report?.totals || { debits: 0, credits: 0 }
    const difference = useMemo(
        () => Math.round((Number(totals.debits || 0) - Number(totals.credits || 0)) * 100) / 100,
        [totals],
    )
    const isBalanced = Math.abs(difference) < 0.005

    const visibleRows = useMemo(() => {
        if (!report?.rows) return []
        // Skip accounts with both columns zero — keeps the report compact.
        return report.rows.filter(
            (r) => Math.abs(Number(r.debit || 0)) > 0.005 || Math.abs(Number(r.credit || 0)) > 0.005,
        )
    }, [report])

    const handleExportCsv = () => {
        if (!report) return
        const csv = buildCsv({
            clientName: client?.name || "",
            asOfDate,
            rows: visibleRows,
            totals,
        })
        downloadCsv(`trial-balance-${asOfDate}.csv`, csv)
    }

    const handleExportPdf = () => {
        if (!report) return
        const lines = buildPdfLines({
            clientName: client?.name || "",
            asOfDate,
            rows: visibleRows,
            totals,
        })
        downloadPdfDocument({
            filename: `trial-balance-${asOfDate}.pdf`,
            title: "Trial Balance",
            lines,
        })
    }

    return (
        <section className="h-full w-full px-12 py-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
                <header className="flex h-full flex-col justify-between gap-8">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-gray-900">Trial Balance</h1>
                        <p className="text-sm text-gray-500">
                            As of: {asOfDate ? formatDateLong(asOfDate) : "-"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={!report?.rows?.length}
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
                            disabled={!report?.rows?.length}
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
                        <div className="flex min-w-45 flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Balance as of
                            </span>
                            <div className="relative">
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
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <input
                                    type="date"
                                    value={asOfDate}
                                    onChange={(e) => setAsOfDate(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
                {isLoading && !report ? (
                    <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
                        Loading…
                    </div>
                ) : !report || visibleRows.length === 0 ? (
                    <EmptyState
                        icon={(
                            <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12h7" />
                                <path d="M14 12h7" />
                                <path d="M12 4v16" />
                                <circle cx="12" cy="12" r="2" />
                            </svg>
                        )}
                        title="No accounts with movement yet"
                        description="The trial balance lists every account that received a debit or credit up to the chosen date. Import transactions first — once they're categorized, they show up here grouped by side."
                        primaryAction={{
                            label: "Open Transactions",
                            to: `/clients/${clientId}/transactions`,
                        }}
                    />
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left">Account</th>
                                <th className="px-4 py-2.5 text-left">Type</th>
                                <th className="px-4 py-2.5 text-right">Debit</th>
                                <th className="px-4 py-2.5 text-right">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleRows.map((row) => (
                                <tr key={row.accountId}>
                                    <td className="px-4 py-2 text-gray-900">{row.name || "—"}</td>
                                    <td className="px-4 py-2 text-gray-600">
                                        {ACCOUNT_TYPE_LABELS[row.accountType] || row.accountType || "—"}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                                        {Math.abs(Number(row.debit || 0)) > 0.005
                                            ? formatCurrency(row.debit)
                                            : ""}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                                        {Math.abs(Number(row.credit || 0)) > 0.005
                                            ? formatCurrency(row.credit)
                                            : ""}
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
                                    {formatCurrency(totals.debits)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                    {formatCurrency(totals.credits)}
                                </td>
                            </tr>
                            <tr
                                className={
                                    isBalanced
                                        ? "border-t border-gray-200 text-emerald-700"
                                        : "border-t border-gray-200 text-rose-700"
                                }
                            >
                                <td className="px-4 py-2 text-[12px] font-medium" colSpan={2}>
                                    {isBalanced
                                        ? "Debits = Credits — the ledger is balanced."
                                        : "Difference (debits − credits)"}
                                </td>
                                <td className="px-4 py-2" />
                                <td className="px-4 py-2 text-right tabular-nums">
                                    {isBalanced ? "—" : formatCurrency(difference)}
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

export default TrialBalancePage
