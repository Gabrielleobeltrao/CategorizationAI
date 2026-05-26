import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import { getBalanceSheetReport } from "../services/balanceSheet.service"
import { useNotification } from "../contexts/notification.context"
import { downloadPdfDocument } from "../utils/pdf"
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

const SECTION_GROUP_LABEL = {
    asset: "Assets",
    liability: "Liabilities",
    equity: "Equity",
    uncategorized: "Uncategorized",
}

function buildCsv({ clientName, asOfDate, report }) {
    const escape = (value) => {
        const safe = String(value ?? "").replace(/"/g, '""')
        return /[",\n]/.test(safe) ? `"${safe}"` : safe
    }

    const lines = [
        `Balance Sheet - ${clientName || ""}`,
        `As of ${asOfDate}`,
        "",
        ["Section", "Account", "Type", "Balance"].map(escape).join(","),
    ]

    for (const section of report?.sections || []) {
        for (const row of section.rows) {
            lines.push([section.label, row.name, row.accountType, row.balance].map(escape).join(","))
        }
        lines.push([`${section.label} Total`, "", "", section.total].map(escape).join(","))
    }

    lines.push("")
    lines.push(["Total Assets", "", "", report.totals.assets].map(escape).join(","))
    lines.push(["Total Liabilities", "", "", report.totals.liabilities].map(escape).join(","))
    lines.push(["Total Equity", "", "", report.totals.equity].map(escape).join(","))
    lines.push(["Liabilities + Equity", "", "", report.totals.liabilitiesPlusEquity].map(escape).join(","))
    lines.push(["Difference (Assets − L+E)", "", "", report.totals.difference].map(escape).join(","))

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

function buildPdfLines({ clientName, asOfDate, report }) {
    const pad = (text, length) => String(text || "").slice(0, length).padEnd(length)
    const padRight = (text, length) => String(text || "").padStart(length).slice(-length)

    const lines = [
        "Balance Sheet",
        clientName || "-",
        `As of ${asOfDate}`,
        "",
    ]

    for (const section of report?.sections || []) {
        lines.push(section.label.toUpperCase())
        lines.push("-".repeat(60))
        for (const row of section.rows) {
            lines.push(`  ${pad(row.name, 40)}  ${padRight(formatCurrency(row.balance), 14)}`)
        }
        lines.push(`  ${pad(`${section.label} Total`, 40)}  ${padRight(formatCurrency(section.total), 14)}`)
        lines.push("")
    }

    lines.push("=".repeat(60))
    lines.push(`${pad("Total Assets", 40)}  ${padRight(formatCurrency(report.totals.assets), 14)}`)
    lines.push(`${pad("Total Liabilities", 40)}  ${padRight(formatCurrency(report.totals.liabilities), 14)}`)
    lines.push(`${pad("Total Equity", 40)}  ${padRight(formatCurrency(report.totals.equity), 14)}`)
    lines.push(`${pad("Liabilities + Equity", 40)}  ${padRight(formatCurrency(report.totals.liabilitiesPlusEquity), 14)}`)
    lines.push(`${pad("Difference (Assets − L+E)", 40)}  ${padRight(formatCurrency(report.totals.difference), 14)}`)

    return lines
}

function SectionBlock({ section }) {
    if (!section?.rows?.length) {
        return (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                {section.label}: no accounts classified yet.
            </div>
        )
    }
    return (
        <div>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {section.label}
            </h3>
            <ul className="flex flex-col gap-1">
                {section.rows.map((row) => (
                    <li
                        key={row.accountId || `${section.id}-${row.name}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-white px-3 py-1.5 text-sm"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-gray-900">{row.name || "—"}</span>
                            {row.isDerived && (
                                <span
                                    title="Derived from cumulative net income (P&L) up to the snapshot date."
                                    className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700"
                                >
                                    derived
                                </span>
                            )}
                        </span>
                        <span className="tabular-nums text-gray-900">{formatCurrency(row.balance)}</span>
                    </li>
                ))}
                <li className="flex items-center justify-between gap-3 border-t border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-900">
                    <span>{section.label} Total</span>
                    <span className="tabular-nums">{formatCurrency(section.total)}</span>
                </li>
            </ul>
        </div>
    )
}

function GroupColumn({ title, accent, sections, total }) {
    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
                <h2 className={`text-sm font-semibold uppercase tracking-wide ${accent}`}>{title}</h2>
                <span className="text-base font-semibold tabular-nums text-gray-900">{formatCurrency(total)}</span>
            </div>
            <div className="flex flex-col gap-4">
                {sections.map((section) => (
                    <SectionBlock key={section.id} section={section} />
                ))}
            </div>
        </div>
    )
}

function BalanceSheetPage() {
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
            const payload = await getBalanceSheetReport(clientId, {
                asOfDate,
                silentLoading: true,
            })
            setReport(payload || null)
        } catch (err) {
            error(err?.message || "Failed to load balance sheet")
        } finally {
            setIsLoading(false)
        }
    }, [clientId, asOfDate, error])

    useEffect(() => {
        reload()
    }, [reload])

    const grouped = useMemo(() => {
        if (!report?.sections) return null
        const byGroup = { asset: [], liability: [], equity: [], uncategorized: [] }
        for (const section of report.sections) {
            const group = section.group || "uncategorized"
            byGroup[group]?.push(section)
        }
        return byGroup
    }, [report])

    const handleExportCsv = () => {
        if (!report) return
        downloadCsv(
            `balance-sheet-${asOfDate}.csv`,
            buildCsv({ clientName: client?.name || "", asOfDate, report }),
        )
    }

    const handleExportPdf = () => {
        if (!report) return
        downloadPdfDocument({
            filename: `balance-sheet-${asOfDate}.pdf`,
            lines: buildPdfLines({ clientName: client?.name || "", asOfDate, report }),
        })
    }

    const difference = Number(report?.totals?.difference || 0)
    const balanced = Math.abs(difference) < 0.005

    return (
        <section className="h-full w-full px-12 py-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
                <header className="flex h-full flex-col justify-between gap-8">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-gray-900">Balance Sheet</h1>
                        <p className="text-sm text-gray-500">
                            As of: {asOfDate ? formatDateLong(asOfDate) : "-"}
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

            {report && (
                <div
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                        balanced
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {balanced ? (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                                <circle cx="12" cy="12" r="9" />
                            </svg>
                        )}
                        <span className="font-semibold">
                            {balanced ? "Balanced" : "Out of balance"}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span>Assets: <span className="font-semibold tabular-nums">{formatCurrency(report.totals.assets)}</span></span>
                        <span>Liabilities + Equity: <span className="font-semibold tabular-nums">{formatCurrency(report.totals.liabilitiesPlusEquity)}</span></span>
                        {!balanced && (
                            <span>Difference: <span className="font-semibold tabular-nums">{formatCurrency(difference)}</span></span>
                        )}
                    </div>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto">
                {isLoading && !report ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                        Loading…
                    </div>
                ) : !report || (report.sections || []).every((s) => (s.rows || []).length === 0) ? (
                    <div className="rounded-xl border border-gray-200 bg-white">
                        <EmptyState
                            icon={(
                                <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 3v18" />
                                    <path d="M6 7l-3 4 3 4" />
                                    <path d="M18 7l3 4-3 4" />
                                    <path d="M3 11h18" />
                                </svg>
                            )}
                            title="No balance sheet to show"
                            description="Once this client has categorized transactions, assets, liabilities and equity will populate here. Start by setting up the Chart of Accounts and importing a bank statement."
                            primaryAction={{
                                label: "Open Transactions",
                                to: `/clients/${clientId}/transactions`,
                            }}
                            secondaryAction={{
                                label: "Chart of Accounts",
                                to: `/clients/${clientId}/chart-of-accounts`,
                            }}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <GroupColumn
                            title={SECTION_GROUP_LABEL.asset}
                            accent="text-gray-900"
                            sections={grouped?.asset || []}
                            total={report.totals.assets}
                        />
                        <div className="flex flex-col gap-4">
                            <GroupColumn
                                title={SECTION_GROUP_LABEL.liability}
                                accent="text-gray-900"
                                sections={grouped?.liability || []}
                                total={report.totals.liabilities}
                            />
                            <GroupColumn
                                title={SECTION_GROUP_LABEL.equity}
                                accent="text-gray-900"
                                sections={grouped?.equity || []}
                                total={report.totals.equity}
                            />
                        </div>
                        {grouped?.uncategorized?.length > 0 && (
                            <div className="lg:col-span-2">
                                <GroupColumn
                                    title={SECTION_GROUP_LABEL.uncategorized}
                                    accent="text-amber-700"
                                    sections={grouped.uncategorized}
                                    total={report.totals.uncategorized}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>
        </section>
    )
}

export default BalanceSheetPage
