import { useEffect, useMemo, useRef, useState } from "react"
import LedgerEntryRow from "./LedgerEntryRow"
import ConfirmModal from "../ui/ConfirmModal"

const UNCATEGORIZED_FILTER_VALUE = "__uncategorized__"

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
        </div>
    )
}

export default LedgerEntriesTable
