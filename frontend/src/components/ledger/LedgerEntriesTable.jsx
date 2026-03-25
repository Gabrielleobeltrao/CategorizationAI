import { useEffect, useMemo, useRef, useState } from "react"
import LedgerEntryRow from "./LedgerEntryRow"
import ConfirmModal from "../ui/ConfirmModal"
import PopupModal from "../ui/PopupModal"

const UNCATEGORIZED_FILTER_VALUE = "__uncategorized__"
const CSV_TARGET_FIELDS = [
    { value: "date", label: "Date" },
    { value: "description", label: "Description" },
    { value: "amount", label: "Amount" },
    { value: "ignore", label: "Ignore" },
]
const REQUIRED_UPLOAD_FIELDS = ["date", "description", "amount"]

function formatPreviewDate(value = "") {
    const safeValue = String(value || "")
    if (safeValue.includes("-")) {
        return safeValue.split("-").reverse().join("/")
    }
    const slashParts = safeValue.split("/")
    if (slashParts.length === 3) {
        return `${slashParts[1]}/${slashParts[0]}/${slashParts[2]}`
    }
    return safeValue
}

function formatPreviewAmount(value = "") {
    const normalized = String(value || "").replace(/[^0-9.-]/g, "")
    const amount = Number(normalized)
    if (Number.isNaN(amount)) return String(value || "")
    return `$${amount.toFixed(2)}`
}

function getTargetFieldLabel(value = "") {
    const matched = CSV_TARGET_FIELDS.find((field) => field.value === value)
    return matched?.label || "Ignore"
}

function isMeaningfulPreviewValue(value = "") {
    const normalized = String(value || "").trim()
    if (normalized === "") return false
    const numeric = Number(normalized.replace(/[$,\s]/g, ""))
    if (!Number.isNaN(numeric) && numeric === 0) return false
    return true
}

function detectDelimiter(headerLine = "") {
    const commaCount = (headerLine.match(/,/g) || []).length
    const semicolonCount = (headerLine.match(/;/g) || []).length
    const tabCount = (headerLine.match(/\t/g) || []).length
    if (semicolonCount > commaCount && semicolonCount >= tabCount) return ";"
    if (tabCount > commaCount && tabCount > semicolonCount) return "\t"
    return ","
}

function parseCsvLine(line = "", delimiter = ",") {
    const values = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        const nextChar = line[i + 1]

        if (char === "\"") {
            if (inQuotes && nextChar === "\"") {
                current += "\""
                i += 1
                continue
            }
            inQuotes = !inQuotes
            continue
        }

        if (char === delimiter && !inQuotes) {
            values.push(current)
            current = ""
            continue
        }

        current += char
    }

    values.push(current)
    return values
}

function parseCsvText(csvText = "") {
    const normalized = String(csvText || "")
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")

    const lines = normalized
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() !== "")

    if (lines.length === 0) {
        return { columns: [], previewRows: [] }
    }

    const headerLine = lines[0]
    const delimiter = detectDelimiter(headerLine)
    const rawHeaders = parseCsvLine(headerLine, delimiter)
    const columns = rawHeaders.map((header, index) => {
        const safeHeader = String(header || "").trim()
        return safeHeader || `Column ${index + 1}`
    })

    const columnHasContent = {}
    columns.forEach((column) => {
        columnHasContent[column] = false
    })

    const allRows = []
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
        const values = parseCsvLine(lines[lineIndex], delimiter)

        const row = {}
        columns.forEach((column, columnIndex) => {
            row[column] = values[columnIndex] ?? ""
        })
        allRows.push(row)

        columns.forEach((column, columnIndex) => {
            const value = values[columnIndex] ?? ""
            if (isMeaningfulPreviewValue(value)) {
                columnHasContent[column] = true
            }
        })
    }

    const cleanedColumns = columns.filter((column) => columnHasContent[column])
    const cleanedRows = allRows
        .map((row) => {
            const cleanedRow = {}
            cleanedColumns.forEach((column) => {
                cleanedRow[column] = row[column] ?? ""
            })
            return cleanedRow
        })
        .filter((row) =>
            cleanedColumns.some((column) => isMeaningfulPreviewValue(row[column]))
        )

    const firstRowIndexByColumn = {}
    cleanedColumns.forEach((column) => {
        firstRowIndexByColumn[column] = cleanedRows.findIndex(
            (row) => isMeaningfulPreviewValue(row[column])
        )
    })

    const representativeIndexes = Array.from(
        new Set(
            Object.values(firstRowIndexByColumn)
                .filter((index) => index >= 0)
                .map((index) => Number(index))
        )
    ).sort((a, b) => a - b)

    const previewIndexes = [...representativeIndexes]
    for (let index = 0; index < cleanedRows.length && previewIndexes.length < 4; index += 1) {
        if (!previewIndexes.includes(index)) {
            previewIndexes.push(index)
        }
    }

    const finalPreviewIndexes = previewIndexes
        .sort((a, b) => a - b)
        .slice(0, Math.max(4, Math.min(8, previewIndexes.length)))

    const previewRows = finalPreviewIndexes.map((index) => cleanedRows[index]).filter(Boolean)

    return { columns: cleanedColumns, previewRows }
}

function guessTargetFieldFromHeader(header = "") {
    const normalized = String(header || "").trim().toLowerCase()
    if (!normalized) return "ignore"
    if (normalized === "date" || normalized.includes("transaction date")) return "date"
    if (normalized.includes("description") || normalized.includes("memo") || normalized.includes("payee") || normalized === "name") return "description"
    if (normalized === "amount" || normalized.includes("amount usd") || normalized.includes("debit") || normalized.includes("credit")) return "amount"
    return "ignore"
}

function buildDefaultColumnRoles(columns = []) {
    const usedTargets = new Set()
    const roles = {}

    columns.forEach((column) => {
        const guessed = guessTargetFieldFromHeader(column)
        if (guessed === "ignore") {
            roles[column] = "ignore"
            return
        }
        if (usedTargets.has(guessed)) {
            roles[column] = "ignore"
            return
        }
        usedTargets.add(guessed)
        roles[column] = guessed
    })

    return roles
}

function formatPreviewCell(value = "", mappedTarget = "ignore") {
    if (mappedTarget === "date") return formatPreviewDate(value)
    if (mappedTarget === "amount") return formatPreviewAmount(value)
    return String(value || "")
}

function LedgerEntriesTable({
    ledgerEntries,
    accounts,
    categories,
    searchTerm,
    filters,
    onApplyFilters,
    onSearchTermChange,
    onUpdateEntry,
    onDeleteEntry,
    isLoading = false,
    isLoadingMore,
    showUploadModal = false,
    onCloseUploadModal,
}) {
    const [editingTargetIds, setEditingTargetIds] = useState([])
    const [editingDraft, setEditingDraft] = useState(null)
    const [editingTouched, setEditingTouched] = useState({})
    const [selectedEntryIds, setSelectedEntryIds] = useState([])
    const [isApplyingCategoryBulk, setIsApplyingCategoryBulk] = useState(false)
    const [pendingDeleteIds, setPendingDeleteIds] = useState([])
    const [isDeletingEntries, setIsDeletingEntries] = useState(false)
    const [searchInput, setSearchInput] = useState(() => searchTerm || "")
    const [showFilterModal, setShowFilterModal] = useState(false)
    const [uploadedCsvFiles, setUploadedCsvFiles] = useState([])
    const [uploadAccountId, setUploadAccountId] = useState("")
    const appliedFilters = useMemo(() => ({
        accountIds: [],
        categoryIds: [],
        includeUncategorized: false,
        fromDate: "",
        toDate: "",
        minAmount: "",
        maxAmount: "",
        ...(filters || {}),
    }), [filters])
    const [draftFilters, setDraftFilters] = useState(appliedFilters)
    const filterPanelRef = useRef(null)
    const scrollContainerRef = useRef(null)
    const selectAllRef = useRef(null)
    const csvFileInputRef = useRef(null)

    const visibleEntryIds = useMemo(
        () => ledgerEntries.map((entry) => entry.id),
        [ledgerEntries]
    )
    const visibleEntryIdsSet = useMemo(
        () => new Set(visibleEntryIds),
        [visibleEntryIds]
    )
    const effectiveSelectedEntryIds = useMemo(
        () => selectedEntryIds.filter((id) => visibleEntryIdsSet.has(id)),
        [selectedEntryIds, visibleEntryIdsSet]
    )

    const allVisibleSelected = useMemo(
        () =>
            visibleEntryIds.length > 0 &&
            visibleEntryIds.every((id) => effectiveSelectedEntryIds.includes(id)),
        [visibleEntryIds, effectiveSelectedEntryIds]
    )

    const someVisibleSelected = useMemo(
        () =>
            !allVisibleSelected &&
            visibleEntryIds.some((id) => effectiveSelectedEntryIds.includes(id)),
        [visibleEntryIds, effectiveSelectedEntryIds, allVisibleSelected]
    )
    const isMultiSelectionMode = effectiveSelectedEntryIds.length > 1
    const isBatchEditing = editingTargetIds.length > 1
    const pendingDeleteEntries = useMemo(
        () => ledgerEntries.filter((entry) => pendingDeleteIds.includes(entry.id)),
        [ledgerEntries, pendingDeleteIds]
    )

    useEffect(() => {
        if (!selectAllRef.current) return
        selectAllRef.current.indeterminate = someVisibleSelected
    }, [someVisibleSelected])

    const toggleSelectAllVisible = (isChecked) => {
        if (!isChecked) {
            setSelectedEntryIds([])
            return
        }
        setSelectedEntryIds(visibleEntryIds)
    }

    const toggleSingleEntrySelection = (entryId, isChecked) => {
        setSelectedEntryIds((current) => {
            if (isChecked) {
                if (current.includes(entryId)) return current
                return [...current, entryId]
            }
            return current.filter((id) => id !== entryId)
        })
    }

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const nextValue = searchInput.trim()
            const currentValue = String(searchTerm || "").trim()
            if (nextValue === currentValue) return
            onSearchTermChange?.(nextValue)
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [searchInput, searchTerm, onSearchTermChange])

    const accountOptions = useMemo(() => {
        const safeAccounts = Array.isArray(accounts) ? accounts : []
        return [...safeAccounts].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    }, [accounts])
    const hasDuplicateMappingInAnyFile = useMemo(
        () =>
            uploadedCsvFiles.some((uploadedFile) => {
                const counts = {}
                Object.values(uploadedFile.columnRoles || {}).forEach((target) => {
                    if (!target || target === "ignore") return
                    counts[target] = (counts[target] || 0) + 1
                })
                return Object.values(counts).some((count) => count > 1)
            }),
        [uploadedCsvFiles]
    )
    const hasMissingRequiredMappingInAnyFile = useMemo(
        () =>
            uploadedCsvFiles.some((uploadedFile) => {
                const assignedTargets = new Set(
                    Object.values(uploadedFile.columnRoles || {}).filter(
                        (target) => target && target !== "ignore"
                    )
                )
                return REQUIRED_UPLOAD_FIELDS.some((requiredTarget) => !assignedTargets.has(requiredTarget))
            }),
        [uploadedCsvFiles]
    )

    const activeFiltersCount = useMemo(() => {
        const selectedAccounts = Array.isArray(appliedFilters.accountIds) ? appliedFilters.accountIds : []
        const selectedCategories = Array.isArray(appliedFilters.categoryIds) ? appliedFilters.categoryIds : []

        let count = 0
        if (selectedAccounts.length > 0) count += 1
        if (selectedCategories.length > 0 || appliedFilters.includeUncategorized) count += 1
        if (appliedFilters.fromDate !== "") count += 1
        if (appliedFilters.toDate !== "") count += 1
        if (appliedFilters.minAmount !== "") count += 1
        if (appliedFilters.maxAmount !== "") count += 1
        return count
    }, [appliedFilters])

    useEffect(() => {
        const onPointerDown = (event) => {
            if (!showFilterModal) return
            if (filterPanelRef.current && !filterPanelRef.current.contains(event.target)) {
                setShowFilterModal(false)
            }
        }

        document.addEventListener("mousedown", onPointerDown)
        return () => document.removeEventListener("mousedown", onPointerDown)
    }, [showFilterModal])

    const startEditEntry = (entry) => {
        const shouldStartBatchEdit =
            effectiveSelectedEntryIds.length > 1 &&
            effectiveSelectedEntryIds.includes(entry.id)
        const targets = shouldStartBatchEdit ? effectiveSelectedEntryIds : [entry.id]
        const selectedAccount = accounts.find((item) => item.name === entry.account)
        const base = {
            date: entry.date || "",
            description: entry.description || "",
            accountId: entry.accountId || selectedAccount?.id || "",
            category: entry.category || "",
            amount: String(entry.amount),
        }
        setEditingTargetIds(targets)
        setEditingDraft(base)
        setEditingTouched({})
    }

    const cancelEditEntry = () => {
        setEditingTargetIds([])
        setEditingDraft(null)
        setEditingTouched({})
    }

    const saveEditEntry = async (id) => {
        if (!editingDraft) return

        try {
            const selectedAccount = accounts.find((item) => item.id === editingDraft.accountId)
            const selectedCategory = categories.find((item) => item.name === editingDraft.category)
            const shouldApplyToSelection =
                editingTargetIds.length > 1 &&
                editingTargetIds.includes(id)
            const targetIds = shouldApplyToSelection ? editingTargetIds : [id]

            const patch = shouldApplyToSelection
                ? (() => {
                    const nextPatch = {}

                    if (editingTouched.date) {
                        nextPatch.date = editingDraft.date || null
                    }

                    if (editingTouched.accountId) {
                        nextPatch.accountId = editingDraft.accountId || null
                        nextPatch.accountName = selectedAccount?.name || null
                    }

                    if (editingTouched.category) {
                        nextPatch.category = editingDraft.category || null
                        nextPatch.categoryId = editingDraft.category ? selectedCategory?.id || null : null
                    }

                    return nextPatch
                })()
                : {
                    date: editingDraft.date,
                    description: editingDraft.description,
                    accountId: editingDraft.accountId || null,
                    accountName: selectedAccount?.name || null,
                    category: editingDraft.category || null,
                    categoryId: editingDraft.category ? selectedCategory?.id || null : null,
                    amount: Number(editingDraft.amount || 0),
                }

            if (shouldApplyToSelection && Object.keys(patch).length === 0) {
                setEditingTargetIds([])
                setEditingDraft(null)
                setEditingTouched({})
                return
            }

            await Promise.all(targetIds.map((targetId) => onUpdateEntry?.(targetId, patch)))
            setEditingTargetIds([])
            setEditingDraft(null)
            setEditingTouched({})
        } catch (err) {
            console.error(err)
        }
    }

    const deleteEntry = (id) => {
        const shouldApplyToSelection =
            effectiveSelectedEntryIds.length > 0 &&
            effectiveSelectedEntryIds.includes(id)
        const targetIds = shouldApplyToSelection ? effectiveSelectedEntryIds : [id]
        setPendingDeleteIds(targetIds)
    }

    const confirmDeleteEntries = async () => {
        if (pendingDeleteIds.length === 0) return
        try {
            setIsDeletingEntries(true)
            await Promise.all(pendingDeleteIds.map((targetId) => onDeleteEntry?.(targetId)))
            setPendingDeleteIds([])
            setSelectedEntryIds([])
        } catch (err) {
            console.error(err)
        } finally {
            setIsDeletingEntries(false)
        }
    }

    const cancelDeleteEntries = () => {
        if (isDeletingEntries) return
        setPendingDeleteIds([])
    }

    const changeEntryCategory = async (id, categoryName) => {
        try {
            const selectedCategory = categories.find((item) => item.name === categoryName)
            const shouldApplyToSelection =
                effectiveSelectedEntryIds.length > 0 &&
                effectiveSelectedEntryIds.includes(id)
            const targetIds = shouldApplyToSelection ? effectiveSelectedEntryIds : [id]

            setIsApplyingCategoryBulk(true)
            await Promise.all(
                targetIds.map((targetId) =>
                    onUpdateEntry?.(targetId, {
                        category: categoryName || null,
                        categoryId: categoryName ? selectedCategory?.id || null : null,
                    })
                )
            )
        } catch (err) {
            console.error(err)
        } finally {
            setIsApplyingCategoryBulk(false)
        }
    }

    const openCsvFilePicker = () => {
        csvFileInputRef.current?.click()
    }

    const handleCsvFilesSelected = async (event) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        const parsedFiles = await Promise.all(
            files.map(async (file, index) => {
                const fileContent = await file.text()
                const parsedCsv = parseCsvText(fileContent)
                return {
                    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
                    fileName: file.name,
                    isEditingMapping: false,
                    columns: parsedCsv.columns,
                    previewRows: parsedCsv.previewRows,
                    columnRoles: buildDefaultColumnRoles(parsedCsv.columns),
                }
            })
        )

        setUploadedCsvFiles((current) => [...current, ...parsedFiles])
        event.target.value = ""
    }

    const toggleFileMappingEdit = (fileId) => {
        setUploadedCsvFiles((current) =>
            current.map((uploadedFile) =>
                uploadedFile.id === fileId
                    ? { ...uploadedFile, isEditingMapping: !uploadedFile.isEditingMapping }
                    : uploadedFile
            )
        )
    }

    const updateFileColumnRole = (fileId, columnKey, nextRole) => {
        setUploadedCsvFiles((current) =>
            current.map((uploadedFile) =>
                uploadedFile.id === fileId
                    ? {
                        ...uploadedFile,
                        columnRoles: {
                            ...uploadedFile.columnRoles,
                            [columnKey]: nextRole,
                        },
                    }
                    : uploadedFile
            )
        )
    }

    const closeUploadModal = () => {
        onCloseUploadModal?.()
        setUploadedCsvFiles([])
        setUploadAccountId("")
        if (csvFileInputRef.current) {
            csvFileInputRef.current.value = ""
        }
    }

    return (
        <div className="flex h-full min-h-0 gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
                <div>
                    <div className="grid grid-cols-[minmax(140px,max-content)_1fr] items-center gap-4 rounded-t-lg bg-gray-100 px-3 py-2.5">
                        <div className="flex items-center gap-2 text-sm">
                            <input
                                ref={selectAllRef}
                                type="checkbox"
                                className="h-4 w-4"
                                checked={allVisibleSelected}
                                onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                            />
                            <h4 className="font-medium text-gray-700">Select All</h4>
                        </div>
                        <div className="relative flex items-center gap-3" ref={filterPanelRef}>
                            <div className="relative min-w-[220px] flex-1">
                                <input
                                    type="text"
                                    placeholder="Search"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-500 bg-white"
                                />
                                <svg
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M15.7955 15.8111L21 21M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>

                            <button
                                type="button"
                                className={`inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-2 text-sm font-medium hover:bg-gray-50 ${
                                    activeFiltersCount > 0
                                        ? "border-gray-900 text-gray-900"
                                        : "border-gray-200 text-gray-700"
                                }`}
                                onClick={() => {
                                    setDraftFilters(appliedFilters)
                                    setShowFilterModal(true)
                                }}
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 6h16l-6 7v5l-4 2v-7L4 6z" />
                                </svg>
                                <span>Filter{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}</span>
                            </button>

                            {showFilterModal && (
                                <aside className="absolute right-0 top-[calc(100%+8px)] z-30 w-[360px] rounded-lg border border-gray-200 bg-white shadow-2xl">
                                    <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                                        <h2 className="text-base font-semibold">Filter Entries</h2>
                                        <button type="button" className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" onClick={() => setShowFilterModal(false)}>
                                            Close
                                        </button>
                                    </header>

                                    <div className="px-4 py-3">
                                        <div className="space-y-4">
                                            <section className="space-y-2">
                                                <p className="text-sm font-medium text-gray-700">
                                                    Account {Array.isArray(draftFilters.accountIds) && draftFilters.accountIds.length > 0 ? `(${draftFilters.accountIds.length})` : ""}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {["all", ...accountOptions.map((account) => account.id)].map((accountId) => (
                                                        <button
                                                            key={accountId}
                                                            type="button"
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs ${
                                                                (accountId === "all" && (!Array.isArray(draftFilters.accountIds) || draftFilters.accountIds.length === 0)) ||
                                                                (Array.isArray(draftFilters.accountIds) && draftFilters.accountIds.includes(accountId))
                                                                    ? "border-gray-900 bg-gray-900 text-white"
                                                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                                            }`}
                                                            onClick={() =>
                                                                setDraftFilters((current) => {
                                                                    const currentAccounts = Array.isArray(current.accountIds) ? current.accountIds : []
                                                                    if (accountId === "all") return { ...current, accountIds: [] }
                                                                    const exists = currentAccounts.includes(accountId)
                                                                    return {
                                                                        ...current,
                                                                        accountIds: exists
                                                                            ? currentAccounts.filter((item) => item !== accountId)
                                                                            : [...currentAccounts, accountId],
                                                                    }
                                                                })
                                                            }
                                                        >
                                                            {accountId === "all"
                                                                ? "All accounts"
                                                                : accountOptions.find((item) => item.id === accountId)?.name || accountId}
                                                        </button>
                                                    ))}
                                                </div>
                                            </section>

                                            <section className="space-y-2">
                                                <p className="text-sm font-medium text-gray-700">
                                                    Category {Array.isArray(draftFilters.categoryIds) && draftFilters.categoryIds.length > 0 ? `(${draftFilters.categoryIds.length + (draftFilters.includeUncategorized ? 1 : 0)})` : draftFilters.includeUncategorized ? "(1)" : ""}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {["all", UNCATEGORIZED_FILTER_VALUE, ...categories.map((category) => category.id)].map((categoryId) => (
                                                        <button
                                                            key={categoryId}
                                                            type="button"
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs ${
                                                                (categoryId === "all" && (!Array.isArray(draftFilters.categoryIds) || draftFilters.categoryIds.length === 0) && !draftFilters.includeUncategorized) ||
                                                                (categoryId === UNCATEGORIZED_FILTER_VALUE && draftFilters.includeUncategorized) ||
                                                                (Array.isArray(draftFilters.categoryIds) && draftFilters.categoryIds.includes(categoryId))
                                                                    ? "border-gray-900 bg-gray-900 text-white"
                                                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                                            }`}
                                                            onClick={() =>
                                                                setDraftFilters((current) => {
                                                                    const currentCategories = Array.isArray(current.categoryIds) ? current.categoryIds : []
                                                                    if (categoryId === "all") return { ...current, categoryIds: [], includeUncategorized: false }
                                                                    if (categoryId === UNCATEGORIZED_FILTER_VALUE) {
                                                                        return { ...current, includeUncategorized: !current.includeUncategorized }
                                                                    }
                                                                    const exists = currentCategories.includes(categoryId)
                                                                    return {
                                                                        ...current,
                                                                        categoryIds: exists
                                                                            ? currentCategories.filter((item) => item !== categoryId)
                                                                            : [...currentCategories, categoryId],
                                                                    }
                                                                })
                                                            }
                                                        >
                                                            {categoryId === "all"
                                                                ? "All categories"
                                                                : categoryId === UNCATEGORIZED_FILTER_VALUE
                                                                    ? "Uncategorized"
                                                                    : categories.find((item) => item.id === categoryId)?.name || categoryId}
                                                        </button>
                                                    ))}
                                                </div>
                                            </section>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-gray-700">Date range</p>
                                                    <label className="flex flex-col gap-1 text-sm text-gray-600">
                                                        From
                                                        <input
                                                            type="date"
                                                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                                                            value={draftFilters.fromDate}
                                                            onChange={(e) => setDraftFilters((current) => ({ ...current, fromDate: e.target.value }))}
                                                        />
                                                    </label>
                                                    <label className="flex flex-col gap-1 text-sm text-gray-600">
                                                        To
                                                        <input
                                                            type="date"
                                                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                                                            value={draftFilters.toDate}
                                                            onChange={(e) => setDraftFilters((current) => ({ ...current, toDate: e.target.value }))}
                                                        />
                                                    </label>
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-gray-700">Amount range</p>
                                                    <label className="flex flex-col gap-1 text-sm text-gray-600">
                                                        Min
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                                                            value={draftFilters.minAmount}
                                                            onChange={(e) => setDraftFilters((current) => ({ ...current, minAmount: e.target.value }))}
                                                        />
                                                    </label>
                                                    <label className="flex flex-col gap-1 text-sm text-gray-600">
                                                        Max
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="9999.99"
                                                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                                                            value={draftFilters.maxAmount}
                                                            onChange={(e) => setDraftFilters((current) => ({ ...current, maxAmount: e.target.value }))}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <footer className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
                                        <button
                                            type="button"
                                            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={() => {
                                                const reset = {
                                                    accountIds: [],
                                                    categoryIds: [],
                                                    includeUncategorized: false,
                                                    fromDate: "",
                                                    toDate: "",
                                                    minAmount: "",
                                                    maxAmount: "",
                                                }
                                                setDraftFilters(reset)
                                                onApplyFilters?.(reset)
                                                setShowFilterModal(false)
                                            }}
                                        >
                                            Clear
                                        </button>

                                        <button
                                            type="button"
                                            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                                            onClick={() => {
                                                onApplyFilters?.(draftFilters)
                                                setShowFilterModal(false)
                                            }}
                                        >
                                            Apply
                                        </button>
                                    </footer>
                                </aside>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-[24px_minmax(110px,0.7fr)_minmax(180px,2fr)_minmax(120px,1fr)_minmax(160px,1.3fr)_100px_96px] items-center gap-4 bg-white px-2 py-3 text-sm font-semibold">
                        <span className="block h-4 w-4" aria-hidden="true" />
                        <h4>Date</h4>
                        <h4>Description</h4>
                        <h4>Account</h4>
                        <h4>Category</h4>
                        <div className="flex justify-end">
                            <h4>Amount</h4>
                        </div>
                        <div className="flex justify-end pr-6">
                            <h4>Actions</h4>
                        </div>
                    </div>
                </div>

                <div
                    ref={scrollContainerRef}
                    className="min-h-0 flex-1 overflow-y-auto rounded-b-lg border-b-4 border-gray-100"
                >
                    {ledgerEntries.map((entry, index) => (
                        <div key={entry.id}>
                            <LedgerEntryRow
                                index={index}
                                categories={categories}
                                id={entry.id}
                                date={entry.date}
                                description={entry.description}
                                accountId={entry.accountId}
                                accounts={accounts}
                                account={entry.account}
                                category={entry.category}
                                amount={entry.amount}
                                isEditing={editingTargetIds.includes(entry.id)}
                                editingDraft={editingDraft}
                                onStartEdit={() => startEditEntry(entry)}
                                onCancelEdit={cancelEditEntry}
                                onSaveEdit={() => saveEditEntry(entry.id)}
                                onChangeDraft={(patch) => {
                                    setEditingDraft((current) => ({ ...current, ...patch }))
                                    setEditingTouched((current) => {
                                        const next = { ...current }
                                        Object.keys(patch).forEach((key) => {
                                            next[key] = true
                                        })
                                        return next
                                    })
                                }}
                                onDelete={deleteEntry}
                                onCategoryChange={changeEntryCategory}
                                isSelected={effectiveSelectedEntryIds.includes(entry.id)}
                                onToggleSelect={(isChecked) =>
                                    toggleSingleEntrySelection(entry.id, isChecked)
                                }
                                isMultiSelectionMode={isMultiSelectionMode}
                                isBatchEditing={isBatchEditing}
                                editingTouched={editingTouched}
                                isApplyingCategoryBulk={isApplyingCategoryBulk}
                            />
                        </div>
                    ))}

                    {isLoading && (
                        <div className="px-3 py-8 text-center text-sm text-gray-500">
                            Loading transactions...
                        </div>
                    )}

                    {!isLoading && ledgerEntries.length === 0 && (
                        <div className="px-3 py-8 text-center text-sm text-gray-500">
                            {searchInput.trim()
                                ? "No transactions found for this search."
                                : "No transactions found."}
                        </div>
                    )}

                    {isLoadingMore && (
                        <div className="px-3 py-4 text-center text-xs text-gray-500">
                            Loading more transactions...
                        </div>
                    )}

                </div>
            </div>

            <ConfirmModal
                isOpen={pendingDeleteIds.length > 0}
                title={pendingDeleteIds.length > 1 ? "Delete Transactions" : "Delete Transaction"}
                message={
                    pendingDeleteIds.length > 1
                        ? `You are about to delete ${pendingDeleteIds.length} transactions.`
                        : "You are about to delete 1 transaction."
                }
                confirmLabel={pendingDeleteIds.length > 1 ? "Delete all" : "Delete"}
                onConfirm={confirmDeleteEntries}
                onClose={cancelDeleteEntries}
                isLoading={isDeletingEntries}
                maxWidthClass="max-w-4xl"
            >
                <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white">
                    <div className="overflow-x-auto">
                        <div className="min-w-[860px]">
                            <div className="grid grid-cols-[92px_1.3fr_1fr_1fr_70px] gap-3 border-b border-gray-200 bg-gray-100 pl-3 pr-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                <span>Date</span>
                                <span>Description</span>
                                <span>Account</span>
                                <span>Category</span>
                                <span className="text-left">Amount</span>
                            </div>
                            <ul>
                                {pendingDeleteEntries.slice(0, 8).map((entry, index) => (
                                    <li
                                        key={entry.id}
                                    className={`grid grid-cols-[92px_1.3fr_1fr_1fr_70px] gap-3 pl-3 pr-6 py-2 text-xs text-gray-700 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                                    >
                                        <span className="whitespace-nowrap">{String(entry.date || "").split("-").reverse().join("/")}</span>
                                        <span className="truncate">{entry.description || "No description"}</span>
                                        <span className="truncate">{entry.account || "No account"}</span>
                                        <span className="truncate">{entry.category || "Uncategorized"}</span>
                                        <span className="text-left font-medium tabular-nums">${Number(entry.amount || 0).toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    {pendingDeleteEntries.length > 8 && (
                        <p className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
                            +{pendingDeleteEntries.length - 8} more transactions
                        </p>
                    )}
                </div>
            </ConfirmModal>

            <PopupModal
                isOpen={showUploadModal}
                title="Upload Transactions CSV"
                onClose={closeUploadModal}
                maxWidthClass="max-w-5xl"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-600">
                        Upload a CSV and confirm if the columns are mapped correctly before importing.
                    </p>

                    <div className="max-w-sm">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Account for all files
                        </label>
                        <div className="relative">
                            <select
                                className="w-full rounded-full border-3 border-gray-100 bg-white p-2 pl-3 pr-8 text-sm text-gray-700 appearance-none outline-none"
                                value={uploadAccountId}
                                onChange={(e) => setUploadAccountId(e.target.value)}
                            >
                                <option value="">Select account</option>
                                {accountOptions.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
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
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            ref={csvFileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            multiple
                            className="hidden"
                            onChange={handleCsvFilesSelected}
                        />
                        <button
                            type="button"
                            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                            onClick={openCsvFilePicker}
                        >
                            Upload CSV Files
                        </button>
                        <span className="text-xs text-gray-500">You can upload one or more CSV files</span>
                    </div>

                    {uploadedCsvFiles.length === 0 && (
                        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-5 text-center text-sm text-gray-500">
                            No files selected yet.
                        </p>
                    )}

                    {uploadedCsvFiles.length > 0 && (
                        <div className="max-h-[56vh] space-y-4 overflow-y-auto pr-1">
                            {uploadedCsvFiles.map((uploadedFile) => {
                                const counts = {}
                                Object.values(uploadedFile.columnRoles || {}).forEach((target) => {
                                    if (!target || target === "ignore") return
                                    counts[target] = (counts[target] || 0) + 1
                                })
                                const duplicatedTargets = Object.keys(counts).filter((target) => counts[target] > 1)
                                const hasDuplicateInFile = duplicatedTargets.length > 0
                                const assignedTargets = new Set(
                                    Object.values(uploadedFile.columnRoles || {}).filter(
                                        (target) => target && target !== "ignore"
                                    )
                                )
                                const missingRequiredTargets = REQUIRED_UPLOAD_FIELDS.filter(
                                    (requiredTarget) => !assignedTargets.has(requiredTarget)
                                )

                                return (
                                    <div key={uploadedFile.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-semibold text-gray-700">{uploadedFile.fileName}</h3>
                                            </div>
                                            <button
                                                type="button"
                                                className={`rounded-md p-1 ${
                                                    uploadedFile.isEditingMapping
                                                        ? "bg-gray-900 text-white"
                                                        : "text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                                }`}
                                                onClick={() => toggleFileMappingEdit(uploadedFile.id)}
                                                title={uploadedFile.isEditingMapping ? "Finish column edit" : "Edit columns"}
                                                aria-label={uploadedFile.isEditingMapping ? "Finish column edit" : "Edit columns"}
                                            >
                                                {uploadedFile.isEditingMapping ? (
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M20 6 9 17l-5-5" />
                                                    </svg>
                                                ) : (
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>

                                        <div className="mt-4 overflow-x-auto rounded-md border border-gray-200 bg-white">
                                            <table className="min-w-[760px] w-max border-collapse">
                                                <thead>
                                                    <tr className="border-b border-gray-200 bg-gray-100">
                                                        {uploadedFile.columns.map((column) => (
                                                            <th key={column} className="min-w-[150px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                                            {uploadedFile.isEditingMapping ? (
                                                                <>
                                                                    <select
                                                                        className={`w-full rounded-full border-3 bg-white p-2 pl-3 pr-8 text-xs font-medium appearance-none outline-none ${
                                                                            hasDuplicateInFile &&
                                                                            uploadedFile.columnRoles[column] !== "ignore" &&
                                                                            duplicatedTargets.includes(uploadedFile.columnRoles[column])
                                                                                ? "border-rose-300 text-rose-700"
                                                                                : "border-gray-100 text-gray-700"
                                                                        }`}
                                                                        value={uploadedFile.columnRoles[column] || "ignore"}
                                                                        onChange={(e) =>
                                                                            updateFileColumnRole(uploadedFile.id, column, e.target.value)
                                                                        }
                                                                    >
                                                                        {CSV_TARGET_FIELDS.map((targetField) => (
                                                                            <option key={targetField.value} value={targetField.value}>
                                                                                {targetField.label}
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
                                                                </>
                                                            ) : (
                                                                <span>{getTargetFieldLabel(uploadedFile.columnRoles[column])}</span>
                                                            )}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {uploadedFile.previewRows.map((row, index) => (
                                                        <tr
                                                            key={`${uploadedFile.id}-row-${index}`}
                                                            className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                                        >
                                                            {uploadedFile.columns.map((column) => (
                                                                <td
                                                                    key={`${uploadedFile.id}-row-${index}-${column}`}
                                                                    className="max-w-[260px] px-3 py-2 text-sm text-gray-700"
                                                                    title={String(row[column] || "")}
                                                                >
                                                                    <span className="block truncate">
                                                                        {formatPreviewCell(row[column], uploadedFile.columnRoles[column])}
                                                                    </span>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {hasDuplicateInFile && (
                                            <p className="mt-2 text-xs font-medium text-rose-600">
                                                You cannot map two columns to the same field.
                                            </p>
                                        )}
                                        {missingRequiredTargets.length > 0 && (
                                            <p className="mt-2 text-xs font-medium text-amber-700">
                                                Missing required mapping: {missingRequiredTargets.map(getTargetFieldLabel).join(", ")}.
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            onClick={closeUploadModal}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={
                                uploadedCsvFiles.length === 0 ||
                                hasDuplicateMappingInAnyFile ||
                                hasMissingRequiredMappingInAnyFile ||
                                !uploadAccountId
                            }
                            onClick={closeUploadModal}
                        >
                            Confirm mapping
                        </button>
                    </div>
                </div>
            </PopupModal>
        </div>
    )
}

export default LedgerEntriesTable
