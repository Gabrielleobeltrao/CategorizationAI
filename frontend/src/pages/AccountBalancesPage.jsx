import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import { getAccountBalancesReport } from "../services/accountBalances.service"
import { useNotification } from "../contexts/notification.context"
import { downloadPdfDocument } from "../utils/pdf"

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

function formatDelta(value) {
    const n = Number(value || 0)
    const sign = n > 0 ? "+" : n < 0 ? "−" : ""
    const abs = Math.abs(n)
    return `${sign}${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(abs)}`
}

function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—"
    const n = Number(value)
    const sign = n > 0 ? "+" : n < 0 ? "−" : ""
    return `${sign}${Math.abs(n).toFixed(1)}%`
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

function buildCsv({ clientName, asOfDate, compareDate, rows, totals }) {
    const escape = (value) => {
        const safe = String(value ?? "").replace(/"/g, '""')
        return /[",\n]/.test(safe) ? `"${safe}"` : safe
    }

    const header = compareDate
        ? ["Account", "Type", `Balance ${asOfDate}`, `Balance ${compareDate}`, "Delta", "% Change"]
        : ["Account", "Type", `Balance ${asOfDate}`]

    const lines = [
        `Account Balances - ${clientName || ""}`,
        compareDate ? `As of ${asOfDate} vs ${compareDate}` : `As of ${asOfDate}`,
        "",
        header.map(escape).join(","),
    ]

    for (const row of rows) {
        const cells = compareDate
            ? [row.name, row.type, row.balance, row.compareBalance ?? 0, row.delta ?? 0, row.percentChange ?? ""]
            : [row.name, row.type, row.balance]
        lines.push(cells.map(escape).join(","))
    }

    if (totals) {
        const totalsRow = compareDate
            ? ["Total", "", totals.balance, totals.compareBalance, totals.delta, ""]
            : ["Total", "", totals.balance]
        lines.push(totalsRow.map(escape).join(","))
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

function buildPdfLines({ clientName, asOfDate, compareDate, rows, totals }) {
    const lines = [
        "Account Balances",
        clientName || "-",
        compareDate ? `As of ${asOfDate}  |  vs  ${compareDate}` : `As of ${asOfDate}`,
        "",
    ]

    if (compareDate) {
        lines.push("Account                          Type              Balance         Compare         Delta")
    } else {
        lines.push("Account                          Type                                     Balance")
    }
    lines.push("-".repeat(80))

    const pad = (text, length) => String(text || "").slice(0, length).padEnd(length)
    const padRight = (text, length) => String(text || "").padStart(length).slice(-length)

    for (const row of rows) {
        if (compareDate) {
            lines.push(
                `${pad(row.name, 30)}  ${pad(row.type, 14)}  ${padRight(formatCurrency(row.balance), 14)}  ${padRight(formatCurrency(row.compareBalance ?? 0), 14)}  ${padRight(formatDelta(row.delta ?? 0), 12)}`,
            )
        } else {
            lines.push(`${pad(row.name, 32)}  ${pad(row.type, 14)}  ${padRight(formatCurrency(row.balance), 26)}`)
        }
    }

    lines.push("-".repeat(80))
    if (totals) {
        if (compareDate) {
            lines.push(
                `${pad("Total", 30)}  ${pad("", 14)}  ${padRight(formatCurrency(totals.balance), 14)}  ${padRight(formatCurrency(totals.compareBalance), 14)}  ${padRight(formatDelta(totals.delta), 12)}`,
            )
        } else {
            lines.push(`${pad("Total", 32)}  ${pad("", 14)}  ${padRight(formatCurrency(totals.balance), 26)}`)
        }
    }

    return lines
}

function AccountBalancesPage() {
    const { clientId } = useParams()
    const { error } = useNotification()

    const [client, setClient] = useState(null)
    const [asOfDate, setAsOfDate] = useState(todayIso())
    const [compareEnabled, setCompareEnabled] = useState(false)
    const [compareDate, setCompareDate] = useState("")
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
            const payload = await getAccountBalancesReport(clientId, {
                asOfDate,
                compareDate: compareEnabled && compareDate ? compareDate : undefined,
                silentLoading: true,
            })
            setReport(payload || null)
        } catch (err) {
            error(err?.message || "Failed to load account balances")
        } finally {
            setIsLoading(false)
        }
    }, [clientId, asOfDate, compareEnabled, compareDate, error])

    useEffect(() => {
        reload()
    }, [reload])

    const totals = useMemo(() => {
        if (!report?.rows?.length) return null
        let balance = 0
        let compareBalance = 0
        for (const row of report.rows) {
            balance += Number(row.balance || 0)
            compareBalance += Number(row.compareBalance || 0)
        }
        return {
            balance,
            compareBalance,
            delta: balance - compareBalance,
        }
    }, [report])

    const handleExportCsv = () => {
        if (!report) return
        const csv = buildCsv({
            clientName: client?.name || "",
            asOfDate,
            compareDate: compareEnabled && compareDate ? compareDate : "",
            rows: report.rows || [],
            totals,
        })
        downloadCsv(`account-balances-${asOfDate}.csv`, csv)
    }

    const handleExportPdf = () => {
        if (!report) return
        const lines = buildPdfLines({
            clientName: client?.name || "",
            asOfDate,
            compareDate: compareEnabled && compareDate ? compareDate : "",
            rows: report.rows || [],
            totals,
        })
        downloadPdfDocument({
            filename: `account-balances-${asOfDate}.pdf`,
            lines,
        })
    }

    return (
        <section className="flex h-full flex-col gap-4 px-4 py-4 sm:px-6">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <header className="flex h-full flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-gray-900">Account Balances</h1>
                    <p className="text-sm text-gray-500">
                        As of: {asOfDate ? formatDateLong(asOfDate) : "-"}
                        {compareEnabled && compareDate ? ` (vs ${formatDateLong(compareDate)})` : ""}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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

            <div className="rounded-xl border border-gray-200 bg-white p-4">
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

                    {compareEnabled && (
                        <>
                            <div className="flex h-9 items-center pb-1 text-gray-400">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14" />
                                    <path d="m12 5 7 7-7 7" />
                                </svg>
                            </div>
                            <div className="flex min-w-45 flex-col gap-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Compare with
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
                                        value={compareDate}
                                        onChange={(e) => setCompareDate(e.target.value)}
                                        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-500"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="ml-auto flex items-center gap-2 self-end pb-1">
                        <span className="text-xs font-medium text-gray-600">Compare two dates</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={compareEnabled}
                            onClick={() => setCompareEnabled((current) => !current)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                compareEnabled ? "bg-gray-900" : "bg-gray-200"
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    compareEnabled ? "translate-x-4" : "translate-x-0.5"
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
                {isLoading && (!report || report.rows.length === 0) ? (
                    <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">Loading…</div>
                ) : !report?.rows?.length ? (
                    <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
                        No accounts found for this client.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-4 py-3">Account</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3 text-right">
                                    Balance
                                    <div className="text-[10px] font-normal normal-case text-gray-400">{formatDateLong(asOfDate)}</div>
                                </th>
                                {compareEnabled && compareDate && (
                                    <>
                                        <th className="px-4 py-3 text-right">
                                            Compare
                                            <div className="text-[10px] font-normal normal-case text-gray-400">{formatDateLong(compareDate)}</div>
                                        </th>
                                        <th className="px-4 py-3 text-right">Delta</th>
                                        <th className="px-4 py-3 text-right">%</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {report.rows.map((row) => (
                                <tr key={row.accountId} className="border-b border-gray-50 last:border-b-0">
                                    <td className="px-4 py-3 font-medium text-gray-900">{row.name || "—"}</td>
                                    <td className="px-4 py-3 text-gray-500">{row.type || "—"}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.balance)}</td>
                                    {compareEnabled && compareDate && (
                                        <>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                                {formatCurrency(row.compareBalance ?? 0)}
                                            </td>
                                            <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                                                (row.delta || 0) > 0 ? "text-emerald-700" : (row.delta || 0) < 0 ? "text-red-700" : "text-gray-500"
                                            }`}>
                                                {formatDelta(row.delta || 0)}
                                            </td>
                                            <td className={`px-4 py-3 text-right tabular-nums ${
                                                (row.percentChange || 0) > 0 ? "text-emerald-700" : (row.percentChange || 0) < 0 ? "text-red-700" : "text-gray-500"
                                            }`}>
                                                {formatPercent(row.percentChange)}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        {totals && (
                            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
                                <tr>
                                    <td className="px-4 py-3">Total</td>
                                    <td className="px-4 py-3" />
                                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.balance)}</td>
                                    {compareEnabled && compareDate && (
                                        <>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                                {formatCurrency(totals.compareBalance)}
                                            </td>
                                            <td className={`px-4 py-3 text-right tabular-nums ${
                                                totals.delta > 0 ? "text-emerald-700" : totals.delta < 0 ? "text-red-700" : "text-gray-500"
                                            }`}>
                                                {formatDelta(totals.delta)}
                                            </td>
                                            <td />
                                        </>
                                    )}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                )}
            </div>
        </section>
    )
}

export default AccountBalancesPage
