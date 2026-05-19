import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import { getChartOfAccounts } from "../services/chartOfAccounts.service"
import { useNotification } from "../contexts/notification.context"
import { downloadPdfDocument } from "../utils/pdf"

function formatCurrency(value) {
    const n = Number(value || 0)
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n)
}

function buildCsv({ clientName, groups }) {
    const escape = (value) => {
        const safe = String(value ?? "").replace(/"/g, '""')
        return /[",\n]/.test(safe) ? `"${safe}"` : safe
    }

    const lines = [
        `Chart of Accounts - ${clientName || ""}`,
        "",
        ["Code", "Account", "Group", "Source", "Subtype", "Balance"].map(escape).join(","),
    ]

    for (const group of groups || []) {
        for (const item of group.items) {
            lines.push(
                [item.code, item.name, group.label, item.source, item.subtypeLabel || "", item.balance].map(escape).join(","),
            )
        }
        lines.push([group.code, `${group.label} Total`, "", "", "", group.total].map(escape).join(","))
        lines.push("")
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

function buildPdfLines({ clientName, groups }) {
    const pad = (text, length) => String(text || "").slice(0, length).padEnd(length)
    const padRight = (text, length) => String(text || "").padStart(length).slice(-length)

    const lines = ["Chart of Accounts", clientName || "-", ""]

    for (const group of groups || []) {
        lines.push(`${group.code}  ${group.label}`)
        lines.push("-".repeat(60))
        for (const item of group.items) {
            lines.push(`  ${pad(item.code, 6)}  ${pad(item.name, 32)}  ${padRight(formatCurrency(item.balance), 14)}`)
        }
        lines.push(`  ${pad("", 6)}  ${pad(`${group.label} Total`, 32)}  ${padRight(formatCurrency(group.total), 14)}`)
        lines.push("")
    }

    return lines
}

const SOURCE_BADGE = {
    account: { label: "Account", className: "bg-sky-50 text-sky-700" },
    category: { label: "Category", className: "bg-emerald-50 text-emerald-700" },
}

function ChartOfAccountsPage() {
    const { clientId } = useParams()
    const { error, success } = useNotification()

    const [client, setClient] = useState(null)
    const [report, setReport] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [search, setSearch] = useState("")

    const [formOpen, setFormOpen] = useState(false)
    const [formMode, setFormMode] = useState("create")
    const [editingItem, setEditingItem] = useState(null)
    const [formGroup, setFormGroup] = useState("")
    const [formName, setFormName] = useState("")
    const [formSubtype, setFormSubtype] = useState("")
    const [formDescription, setFormDescription] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(null)

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
            const payload = await getChartOfAccounts(clientId, { silentLoading: true })
            setReport(payload || null)
        } catch (err) {
            error(err?.message || "Failed to load chart of accounts")
        } finally {
            setIsLoading(false)
        }
    }, [clientId, error])

    useEffect(() => {
        reload()
    }, [reload])

    const filteredGroups = useMemo(() => {
        if (!report?.groups) return []
        const safeSearch = search.trim().toLowerCase()
        if (!safeSearch) return report.groups
        return report.groups
            .map((group) => {
                const items = group.items.filter((item) => {
                    const haystack = `${item.code} ${item.name} ${item.subtypeLabel || ""}`.toLowerCase()
                    return haystack.includes(safeSearch)
                })
                if (items.length === 0) return null
                const total = items.reduce((sum, item) => sum + Number(item.balance || 0), 0)
                return { ...group, items, total }
            })
            .filter(Boolean)
    }, [report, search])

    const handleExportCsv = () => {
        if (!report) return
        downloadCsv(
            "chart-of-accounts.csv",
            buildCsv({ clientName: client?.name || "", groups: report.groups }),
        )
    }

    const handleExportPdf = () => {
        if (!report) return
        downloadPdfDocument({
            filename: "chart-of-accounts.pdf",
            lines: buildPdfLines({ clientName: client?.name || "", groups: report.groups }),
        })
    }

    const totalsByParent = useMemo(() => {
        if (!report?.groups) return null
        const map = new Map()
        for (const group of report.groups) {
            map.set(group.parent, (map.get(group.parent) || 0) + Number(group.total || 0))
        }
        return map
    }, [report])

    return (
        <section className="flex h-full flex-col gap-4 px-4 py-4 sm:px-6">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                <header className="flex h-full flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-gray-900">Chart of Accounts</h1>
                        <p className="text-sm text-gray-500">
                            Unified view of all accounts and categories grouped by financial type.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Search
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
                                <circle cx="11" cy="11" r="7" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter by code or name"
                                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
                {isLoading && !report ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                        Loading…
                    </div>
                ) : !report ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                        No data.
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                        No matches for "{search}".
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredGroups.map((group) => (
                            <article
                                key={group.id}
                                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                            >
                                <header className="flex items-baseline justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                                    <div className="flex min-w-0 items-baseline gap-3">
                                        <span className="text-[10px] font-semibold text-gray-400 tabular-nums">{group.code}</span>
                                        <h2 className="truncate text-sm font-semibold text-gray-900">{group.label}</h2>
                                        <span className="text-[11px] uppercase tracking-wide text-gray-400">
                                            {group.parentLabel}
                                        </span>
                                    </div>
                                    <span className="text-sm font-semibold tabular-nums text-gray-900">
                                        {formatCurrency(group.total)}
                                    </span>
                                </header>
                                <ul className="divide-y divide-gray-50">
                                    {group.items.map((item) => {
                                        const badge = SOURCE_BADGE[item.source]
                                        return (
                                            <li
                                                key={`${item.source}-${item.id}`}
                                                className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-gray-50"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-gray-400">
                                                        {item.code}
                                                    </span>
                                                    <span className="truncate text-gray-900">{item.name || "—"}</span>
                                                    {badge && (
                                                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>
                                                            {badge.label}
                                                        </span>
                                                    )}
                                                    {item.subtypeLabel && (
                                                        <span className="shrink-0 truncate text-[11px] text-gray-500">
                                                            {item.subtypeLabel}
                                                        </span>
                                                    )}
                                                    {item.isInferred && (
                                                        <span
                                                            title="Group inferred from account type — set it explicitly in the Accounts page."
                                                            className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
                                                        >
                                                            auto
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="tabular-nums text-gray-900">{formatCurrency(item.balance)}</span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </article>
                        ))}
                        {totalsByParent && search.trim() === "" && (
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                                {Array.from(totalsByParent.entries()).map(([parent, total]) => (
                                    <div
                                        key={parent}
                                        className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                                    >
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                            {parent === "asset" ? "Assets"
                                                : parent === "liability" ? "Liabilities"
                                                : parent === "equity" ? "Equity"
                                                : parent === "income" ? "Income"
                                                : parent === "expense" ? "Expenses"
                                                : "Other"}
                                        </p>
                                        <p className="text-sm font-semibold tabular-nums text-gray-900">
                                            {formatCurrency(total)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}

export default ChartOfAccountsPage
