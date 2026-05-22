import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import {
    getChartOfAccounts,
    listCoaPresets,
    applyCoaPreset,
    createCustomCoaPreset,
    deleteCustomCoaPreset,
} from "../services/chartOfAccounts.service"
import {
    createAccount,
    updateAccountById,
    deleteAccountById,
} from "../services/accounts.service"
import { ACCOUNT_TYPE_OPTIONS, PNL_ACCOUNT_TYPES } from "../constants/accountTypes"
import { useNotification } from "../contexts/notification.context"
import { downloadPdfDocument } from "../utils/pdf"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"

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
        ["Account", "Group", "Description", "Balance"].map(escape).join(","),
    ]

    for (const group of groups || []) {
        for (const item of group.items) {
            lines.push(
                [item.name, group.label, item.description || "", item.balance].map(escape).join(","),
            )
        }
        lines.push([`${group.label} Total`, "", "", group.total].map(escape).join(","))
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
        lines.push(group.label)
        lines.push("-".repeat(60))
        for (const item of group.items) {
            lines.push(`  ${pad(item.name, 40)}  ${padRight(formatCurrency(item.balance), 14)}`)
        }
        lines.push(`  ${pad(`${group.label} Total`, 40)}  ${padRight(formatCurrency(group.total), 14)}`)
        lines.push("")
    }

    return lines
}

function ChartOfAccountsPage() {
    const { clientId } = useParams()
    const { error, success } = useNotification()

    const [client, setClient] = useState(null)
    const [report, setReport] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [search, setSearch] = useState("")

    // CRUD form state. `editingId === null` means create-mode.
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [formName, setFormName] = useState("")
    const [formAccountType, setFormAccountType] = useState("")
    const [formDescription, setFormDescription] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    // Delete confirmation
    const [accountToDelete, setAccountToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // CoA starter presets (loaded lazily when the report is empty)
    const [presets, setPresets] = useState([])
    const [applyingPresetId, setApplyingPresetId] = useState("")
    const [presetSearch, setPresetSearch] = useState("")

    // Custom preset creator modal
    const [isCustomPresetOpen, setIsCustomPresetOpen] = useState(false)
    const [customPresetName, setCustomPresetName] = useState("")
    const [customPresetDescription, setCustomPresetDescription] = useState("")
    const [customPresetAccounts, setCustomPresetAccounts] = useState([
        { name: "", accountType: "", description: "" },
    ])
    const [isSavingCustomPreset, setIsSavingCustomPreset] = useState(false)

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

    // Lazy-load presets only when the report is empty (avoids the
    // extra round-trip on the common case where the client has a CoA).
    useEffect(() => {
        if (presets.length > 0) return
        if (!report) return
        if ((report.groups || []).length > 0) return
        let cancelled = false
        listCoaPresets()
            .then((payload) => {
                if (cancelled) return
                setPresets(Array.isArray(payload?.presets) ? payload.presets : [])
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [report, presets.length])

    const handleApplyPreset = async (presetId) => {
        if (!presetId || applyingPresetId) return
        try {
            setApplyingPresetId(presetId)
            const result = await applyCoaPreset(clientId, presetId)
            success(`Added ${result?.insertedCount || 0} accounts from the preset`)
            await reload()
        } catch (err) {
            error(err?.message || "Failed to apply preset")
        } finally {
            setApplyingPresetId("")
        }
    }

    const openCustomPresetModal = () => {
        setCustomPresetName("")
        setCustomPresetDescription("")
        setCustomPresetAccounts([{ name: "", accountType: "", description: "" }])
        setIsCustomPresetOpen(true)
    }

    const closeCustomPresetModal = () => {
        if (isSavingCustomPreset) return
        setIsCustomPresetOpen(false)
    }

    const updateCustomAccount = (index, field, value) => {
        setCustomPresetAccounts((current) =>
            current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        )
    }

    const addCustomAccountRow = () => {
        setCustomPresetAccounts((current) => [
            ...current,
            { name: "", accountType: "", description: "" },
        ])
    }

    const removeCustomAccountRow = (index) => {
        setCustomPresetAccounts((current) =>
            current.length <= 1 ? current : current.filter((_, i) => i !== index),
        )
    }

    const handleSaveCustomPreset = async (e) => {
        e?.preventDefault?.()
        const trimmedName = customPresetName.trim()
        if (!trimmedName) {
            error("Preset name is required")
            return
        }
        const cleaned = customPresetAccounts
            .map((row) => ({
                name: String(row.name || "").trim(),
                accountType: String(row.accountType || "").trim(),
                description: String(row.description || "").trim(),
            }))
            .filter((row) => row.name && row.accountType)
        if (cleaned.length === 0) {
            error("Add at least one account with name and type")
            return
        }
        try {
            setIsSavingCustomPreset(true)
            const created = await createCustomCoaPreset({
                name: trimmedName,
                description: customPresetDescription.trim(),
                accounts: cleaned,
            })
            setPresets((current) => [created, ...current])
            setIsCustomPresetOpen(false)
            const applyResult = await applyCoaPreset(clientId, created.id)
            success(`Saved preset and added ${applyResult?.insertedCount || 0} accounts`)
            await reload()
        } catch (err) {
            error(err?.message || "Failed to save preset")
        } finally {
            setIsSavingCustomPreset(false)
        }
    }

    const handleDeleteCustomPreset = async (presetId, e) => {
        e?.stopPropagation?.()
        if (!presetId) return
        try {
            await deleteCustomCoaPreset(presetId)
            setPresets((current) => current.filter((p) => p.id !== presetId))
            success("Custom preset deleted")
        } catch (err) {
            error(err?.message || "Failed to delete preset")
        }
    }

    const filteredGroups = useMemo(() => {
        if (!report?.groups) return []
        const safeSearch = search.trim().toLowerCase()
        if (!safeSearch) return report.groups
        return report.groups
            .map((group) => {
                const items = group.items.filter((item) => {
                    const haystack = `${item.name} ${item.description || ""}`.toLowerCase()
                    return haystack.includes(safeSearch)
                })
                if (items.length === 0) return null
                const total = items.reduce((sum, item) => sum + Number(item.balance || 0), 0)
                return { ...group, items, total }
            })
            .filter(Boolean)
    }, [report, search])

    const totalsByParent = useMemo(() => {
        if (!report?.groups) return null
        const map = new Map()
        for (const group of report.groups) {
            map.set(group.parent, (map.get(group.parent) || 0) + Number(group.total || 0))
        }
        return map
    }, [report])

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

    const openCreateForm = (presetAccountType = "") => {
        setEditingId(null)
        setFormName("")
        setFormAccountType(presetAccountType)
        setFormDescription("")
        setIsFormOpen(true)
    }

    const openEditForm = (item) => {
        setEditingId(item.id)
        setFormName(item.name || "")
        setFormAccountType(item.accountType || "")
        setFormDescription(item.description || "")
        setIsFormOpen(true)
    }

    const closeForm = () => {
        if (isSaving) return
        setIsFormOpen(false)
        setEditingId(null)
        setFormName("")
        setFormAccountType("")
        setFormDescription("")
    }

    const handleSubmit = async (e) => {
        e?.preventDefault?.()
        const name = formName.trim()
        const accountType = formAccountType.trim()
        if (!name || !accountType) return

        setIsSaving(true)
        try {
            if (editingId) {
                await updateAccountById(editingId, {
                    name,
                    accountType,
                    description: formDescription,
                })
                success("Account updated")
            } else {
                await createAccount({
                    clientId,
                    name,
                    accountType,
                    description: formDescription,
                })
                success("Account created")
            }
            setIsFormOpen(false)
            setEditingId(null)
            await reload()
        } catch (err) {
            error(err?.message || "Failed to save account")
        } finally {
            setIsSaving(false)
        }
    }

    const handleConfirmDelete = async () => {
        if (!accountToDelete) return
        setIsDeleting(true)
        try {
            await deleteAccountById(accountToDelete.id)
            success("Account deleted")
            setAccountToDelete(null)
            await reload()
        } catch (err) {
            error(err?.message || "Failed to delete account")
        } finally {
            setIsDeleting(false)
        }
    }

    const formValid = formName.trim().length > 0 && Boolean(formAccountType)

    return (
        <section className="h-full w-full px-12 py-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-gray-900">Chart of Accounts</h1>
                    <p className="text-sm text-gray-500">
                        All financial accounts — banks, cards, income, expenses, equity — in one canonical list.
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
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        PDF
                    </button>
                    <button
                        type="button"
                        onClick={() => openCreateForm()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                        </svg>
                        New Account
                    </button>
                </div>
            </header>

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
                    placeholder="Filter by name or description"
                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-500"
                />
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
                    search.trim() ? (
                        <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                            {`No matches for "${search}".`}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900">Start with a preset</h2>
                                <p className="text-sm text-gray-600">
                                    Pick the option closest to this client's business. We'll create a starter set
                                    of accounts so you can categorize transactions right away.
                                </p>
                            </div>
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
                                    value={presetSearch}
                                    onChange={(e) => setPresetSearch(e.target.value)}
                                    placeholder="Search presets (e.g. restaurant, real estate, saas)"
                                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={openCustomPresetModal}
                                    disabled={Boolean(applyingPresetId)}
                                    className="flex flex-col items-start gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-left transition hover:border-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-gray-900">
                                            + Create custom preset
                                        </span>
                                    </div>
                                    <span className="text-[12px] text-gray-500">
                                        Define your own accounts and save the preset for reuse on other clients.
                                    </span>
                                </button>
                                {presets.length === 0 ? (
                                    <p className="text-sm text-gray-500">Loading presets…</p>
                                ) : (() => {
                                    const safe = presetSearch.trim().toLowerCase()
                                    const filtered = safe
                                        ? presets.filter((p) =>
                                            `${p.label} ${p.description}`.toLowerCase().includes(safe),
                                        )
                                        : presets
                                    if (filtered.length === 0) {
                                        return (
                                            <p className="text-sm text-gray-500">
                                                No presets match "{presetSearch}".
                                            </p>
                                        )
                                    }
                                    return filtered.map((preset) => (
                                        <div
                                            key={preset.id}
                                            className="group relative"
                                        >
                                            <button
                                                type="button"
                                                disabled={Boolean(applyingPresetId)}
                                                onClick={() => handleApplyPreset(preset.id)}
                                                className="flex w-full flex-col items-start gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <span className="truncate text-sm font-semibold text-gray-900">
                                                            {preset.label}
                                                        </span>
                                                        {preset.source === "custom" && (
                                                            <span className="shrink-0 rounded-sm bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-indigo-700">
                                                                Custom
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                                        {preset.accountCount} accounts
                                                    </span>
                                                </div>
                                                <span className="text-[12px] text-gray-500">{preset.description}</span>
                                                {applyingPresetId === preset.id && (
                                                    <span className="text-[11px] font-medium text-gray-500">Applying…</span>
                                                )}
                                            </button>
                                            {preset.source === "custom" && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                                                    title="Delete custom preset"
                                                    aria-label="Delete custom preset"
                                                    className="absolute right-2 top-2 rounded-md p-1 text-gray-400 opacity-0 transition hover:bg-red-100 hover:text-red-700 group-hover:opacity-100"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" />
                                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))
                                })()}
                            </div>
                        </div>
                    )
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredGroups.map((group) => (
                            <article
                                key={group.id}
                                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                            >
                                <header className="flex items-baseline justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                                    <div className="flex min-w-0 items-baseline gap-3">
                                        <h2 className="truncate text-sm font-semibold text-gray-900">{group.label}</h2>
                                        <span className="text-[11px] uppercase tracking-wide text-gray-400">
                                            {group.parentLabel}
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <span className="text-sm font-semibold tabular-nums text-gray-900">
                                            {formatCurrency(group.total)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openCreateForm(group.id)}
                                            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                                            title={`Add ${group.label.toLowerCase()} account`}
                                            aria-label={`Add ${group.label.toLowerCase()} account`}
                                        >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 5v14" />
                                                <path d="M5 12h14" />
                                            </svg>
                                        </button>
                                    </div>
                                </header>
                                <ul className="divide-y divide-gray-50">
                                    {group.items.map((item) => (
                                        <li
                                            key={item.id}
                                            className="group flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-gray-50"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-gray-900">{item.name || "—"}</span>
                                                    {item.description && (
                                                        <span className="block truncate text-[11px] text-gray-500">
                                                            {item.description}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <span className="tabular-nums text-gray-900">{formatCurrency(item.balance)}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditForm(item)}
                                                    className="rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100"
                                                    title="Edit account"
                                                    aria-label="Edit account"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAccountToDelete(item)}
                                                    className="rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                                                    title="Delete account"
                                                    aria-label="Delete account"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" />
                                                        <path d="M8 6V4h8v2" />
                                                        <path d="M19 6l-1 14H6L5 6" />
                                                        <path d="M10 11v6M14 11v6" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </li>
                                    ))}
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

            <PopupModal
                isOpen={isFormOpen}
                title={editingId ? "Edit account" : "New account"}
                onClose={closeForm}
                maxWidthClass="max-w-md"
            >
                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</span>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="e.g. Chase Business Checking, or Advertising & Marketing"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            autoFocus
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Account type</span>
                        <div className="relative">
                            <select
                                value={formAccountType}
                                onChange={(e) => setFormAccountType(e.target.value)}
                                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 outline-none focus:border-gray-500"
                            >
                                <option value="">Select type</option>
                                {ACCOUNT_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <svg
                                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
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
                    {PNL_ACCOUNT_TYPES.includes(formAccountType) && (
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                AI categorization hint
                            </span>
                            <textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="e.g. Recurring SaaS subscriptions and cloud services. Examples: AWS, Google Workspace, Figma, Notion."
                                rows={4}
                                className="min-h-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            />
                            <span className="text-[11px] text-gray-500">
                                What the AI reads to decide when to assign a transaction to this account. Mention typical merchants, transaction descriptions, or scenarios. Specific examples help a lot.
                            </span>
                        </label>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={closeForm}
                            disabled={isSaving}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !formValid}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {isSaving ? "Saving…" : editingId ? "Save changes" : "Create account"}
                        </button>
                    </div>
                </form>
            </PopupModal>

            <ConfirmModal
                isOpen={Boolean(accountToDelete)}
                title="Delete account"
                message={accountToDelete ? `Delete "${accountToDelete.name}"? This cannot be undone. Accounts referenced by existing journal entries cannot be deleted.` : ""}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={handleConfirmDelete}
                onClose={() => (isDeleting ? undefined : setAccountToDelete(null))}
            />

            <PopupModal
                isOpen={isCustomPresetOpen}
                title="Create custom preset"
                onClose={closeCustomPresetModal}
                maxWidthClass="max-w-3xl"
            >
                <form className="flex flex-col gap-5" onSubmit={handleSaveCustomPreset}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Preset name
                            </span>
                            <input
                                type="text"
                                value={customPresetName}
                                onChange={(e) => setCustomPresetName(e.target.value)}
                                placeholder="e.g. My standard service business"
                                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                autoFocus
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Description <span className="text-gray-400 normal-case">(optional)</span>
                            </span>
                            <input
                                type="text"
                                value={customPresetDescription}
                                onChange={(e) => setCustomPresetDescription(e.target.value)}
                                placeholder="Short note about when to use this preset"
                                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                        </label>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
                        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v4" />
                            <path d="M12 16h.01" />
                        </svg>
                        <span>
                            The AI hint is what teaches the categorizer when to use this account. Only{" "}
                            <strong>income and expense</strong> accounts need a hint — bank, credit card and equity
                            accounts skip it.
                        </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Accounts
                            </span>
                            <button
                                type="button"
                                onClick={addCustomAccountRow}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
                            >
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 5v14" />
                                    <path d="M5 12h14" />
                                </svg>
                                Add account
                            </button>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {customPresetAccounts.map((row, idx) => {
                                const isPnl = PNL_ACCOUNT_TYPES.includes(row.accountType)
                                return (
                                    <div
                                        key={idx}
                                        className="group rounded-lg border border-gray-200 bg-white p-3 transition hover:border-gray-300"
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                                                <input
                                                    type="text"
                                                    value={row.name}
                                                    onChange={(e) => updateCustomAccount(idx, "name", e.target.value)}
                                                    placeholder="Account name"
                                                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                                />
                                                <div className="relative sm:w-56">
                                                    <select
                                                        value={row.accountType}
                                                        onChange={(e) => updateCustomAccount(idx, "accountType", e.target.value)}
                                                        className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                                    >
                                                        <option value="">Account type…</option>
                                                        {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
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
                                            <button
                                                type="button"
                                                onClick={() => removeCustomAccountRow(idx)}
                                                disabled={customPresetAccounts.length <= 1}
                                                title="Remove account"
                                                aria-label="Remove account"
                                                className="mt-0.5 rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" />
                                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                </svg>
                                            </button>
                                        </div>
                                        {isPnl && (
                                            <div className="mt-2.5 flex flex-col gap-1">
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                    AI categorization hint
                                                </span>
                                                <textarea
                                                    value={row.description}
                                                    onChange={(e) => updateCustomAccount(idx, "description", e.target.value)}
                                                    placeholder="What activity belongs here? Mention typical merchants, statement descriptions (e.g. 'STRIPE FEE', 'AMAZON', 'UBER EATS')."
                                                    rows={2}
                                                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="-mx-5 -mb-4 mt-1 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:-mx-6 sm:-mb-4 sm:px-6">
                        <button
                            type="button"
                            onClick={closeCustomPresetModal}
                            disabled={isSavingCustomPreset}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingCustomPreset}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSavingCustomPreset ? "Saving…" : "Save & apply"}
                        </button>
                    </div>
                </form>
            </PopupModal>
          </div>
        </section>
    )
}

export default ChartOfAccountsPage
