import { useEffect, useMemo, useRef, useState } from "react"
import LedgerEntryRow from "./LedgerEntryRow"

function LedgerEntriesTable({
    ledgerEntries,
    categories,
    searchTerm,
    onSearchTermChange,
    onUpdateEntry,
    onDeleteEntry,
    isLoading = false,
    isLoadingMore,
}) {
    const [editingId, setEditingId] = useState(null)
    const [editingDraft, setEditingDraft] = useState(null)
    const [searchInput, setSearchInput] = useState(searchTerm || "")
    const [onlyUncategorized, setOnlyUncategorized] = useState(false)
    const [showFilterModal, setShowFilterModal] = useState(false)
    const [appliedFilters, setAppliedFilters] = useState({
        account: [],
        category: [],
        fromDate: "",
        toDate: "",
        minAmount: "",
        maxAmount: "",
    })
    const [draftFilters, setDraftFilters] = useState(appliedFilters)
    const filterPanelRef = useRef(null)
    const scrollContainerRef = useRef(null)

    useEffect(() => {
        setSearchInput(searchTerm || "")
    }, [searchTerm])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const nextValue = searchInput.trim()
            const currentValue = String(searchTerm || "").trim()
            if (nextValue === currentValue) return
            onSearchTermChange?.(nextValue)
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [searchInput, searchTerm, onSearchTermChange])

    useEffect(() => {
        setEditingId(null)
        setEditingDraft(null)
    }, [ledgerEntries])

    const accountOptions = useMemo(() => {
        const unique = [...new Set(ledgerEntries.map((entry) => entry.account).filter(Boolean))]
        return unique.sort((a, b) => a.localeCompare(b))
    }, [ledgerEntries])

    const filteredEntries = useMemo(() => {
        const selectedAccounts = Array.isArray(appliedFilters.account) ? appliedFilters.account : []
        const selectedCategories = Array.isArray(appliedFilters.category) ? appliedFilters.category : []

        return ledgerEntries.filter((entry) => {
            const entryCategory = entry.category || ""

            if (onlyUncategorized && entryCategory) return false
            if (selectedAccounts.length > 0 && !selectedAccounts.includes(entry.account)) return false
            if (selectedCategories.length > 0 && !selectedCategories.includes(entryCategory)) return false
            if (appliedFilters.fromDate && entry.date < appliedFilters.fromDate) return false
            if (appliedFilters.toDate && entry.date > appliedFilters.toDate) return false
            if (appliedFilters.minAmount !== "" && entry.amount < Number(appliedFilters.minAmount)) return false
            if (appliedFilters.maxAmount !== "" && entry.amount > Number(appliedFilters.maxAmount)) return false

            return true
        })
    }, [ledgerEntries, onlyUncategorized, appliedFilters])

    const activeFiltersCount = useMemo(() => {
        const selectedAccounts = Array.isArray(appliedFilters.account) ? appliedFilters.account : []
        const selectedCategories = Array.isArray(appliedFilters.category) ? appliedFilters.category : []

        let count = 0
        if (selectedAccounts.length > 0) count += 1
        if (selectedCategories.length > 0) count += 1
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
        setEditingId(entry.id)
        setEditingDraft({
            date: entry.date,
            description: entry.description,
            account: entry.account,
            category: entry.category || "",
            amount: String(entry.amount),
        })
    }

    const cancelEditEntry = () => {
        setEditingId(null)
        setEditingDraft(null)
    }

    const saveEditEntry = async (id) => {
        if (!editingDraft) return

        try {
            const selectedCategory = categories.find((item) => item.name === editingDraft.category)
            await onUpdateEntry?.(id, {
                date: editingDraft.date,
                description: editingDraft.description,
                accountName: editingDraft.account,
                category: editingDraft.category || null,
                categoryId: editingDraft.category ? selectedCategory?.id || null : null,
                amount: Number(editingDraft.amount || 0),
            })
            setEditingId(null)
            setEditingDraft(null)
        } catch (err) {
            console.error(err)
        }
    }

    const deleteEntry = async (id) => {
        try {
            await onDeleteEntry?.(id)
        } catch (err) {
            console.error(err)
        }
    }

    const changeEntryCategory = async (id, categoryName) => {
        try {
            const selectedCategory = categories.find((item) => item.name === categoryName)
            await onUpdateEntry?.(id, {
                category: categoryName || null,
                categoryId: categoryName ? selectedCategory?.id || null : null,
            })
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="flex h-full min-h-0 gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
                <div>
                    <div className="grid grid-cols-[minmax(140px,max-content)_1fr] items-center gap-4 rounded-t-lg bg-gray-100 px-3 py-2.5">
                        <div className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="h-4 w-4" />
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

                            <label className="inline-flex items-center gap-2 px-1 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={onlyUncategorized}
                                    onChange={(e) => setOnlyUncategorized(e.target.checked)}
                                />
                                <span>Uncategorized</span>
                            </label>

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
                                                    Account {Array.isArray(draftFilters.account) && draftFilters.account.length > 0 ? `(${draftFilters.account.length})` : ""}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {["all", ...accountOptions].map((account) => (
                                                        <button
                                                            key={account}
                                                            type="button"
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs ${
                                                                (account === "all" && (!Array.isArray(draftFilters.account) || draftFilters.account.length === 0)) ||
                                                                (Array.isArray(draftFilters.account) && draftFilters.account.includes(account))
                                                                    ? "border-gray-900 bg-gray-900 text-white"
                                                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                                            }`}
                                                            onClick={() =>
                                                                setDraftFilters((current) => {
                                                                    const currentAccounts = Array.isArray(current.account) ? current.account : []
                                                                    if (account === "all") return { ...current, account: [] }
                                                                    const exists = currentAccounts.includes(account)
                                                                    return {
                                                                        ...current,
                                                                        account: exists
                                                                            ? currentAccounts.filter((item) => item !== account)
                                                                            : [...currentAccounts, account],
                                                                    }
                                                                })
                                                            }
                                                        >
                                                            {account === "all" ? "All accounts" : account}
                                                        </button>
                                                    ))}
                                                </div>
                                            </section>

                                            <section className="space-y-2">
                                                <p className="text-sm font-medium text-gray-700">
                                                    Category {Array.isArray(draftFilters.category) && draftFilters.category.length > 0 ? `(${draftFilters.category.length})` : ""}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {["all", ...categories.map((category) => category.name)].map((categoryName) => (
                                                        <button
                                                            key={categoryName}
                                                            type="button"
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs ${
                                                                (categoryName === "all" && (!Array.isArray(draftFilters.category) || draftFilters.category.length === 0)) ||
                                                                (Array.isArray(draftFilters.category) && draftFilters.category.includes(categoryName))
                                                                    ? "border-gray-900 bg-gray-900 text-white"
                                                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                                            }`}
                                                            onClick={() =>
                                                                setDraftFilters((current) => {
                                                                    const currentCategories = Array.isArray(current.category) ? current.category : []
                                                                    if (categoryName === "all") return { ...current, category: [] }
                                                                    const exists = currentCategories.includes(categoryName)
                                                                    return {
                                                                        ...current,
                                                                        category: exists
                                                                            ? currentCategories.filter((item) => item !== categoryName)
                                                                            : [...currentCategories, categoryName],
                                                                    }
                                                                })
                                                            }
                                                        >
                                                            {categoryName === "all" ? "All categories" : categoryName}
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
                                                    account: [],
                                                    category: [],
                                                    fromDate: "",
                                                    toDate: "",
                                                    minAmount: "",
                                                    maxAmount: "",
                                                }
                                                setDraftFilters(reset)
                                                setAppliedFilters(reset)
                                                setShowFilterModal(false)
                                            }}
                                        >
                                            Clear
                                        </button>

                                        <button
                                            type="button"
                                            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                                            onClick={() => {
                                                setAppliedFilters(draftFilters)
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
                    {filteredEntries.map((entry, index) => (
                        <div key={entry.id}>
                            <LedgerEntryRow
                                index={index}
                                categories={categories}
                                id={entry.id}
                                date={entry.date}
                                description={entry.description}
                                account={entry.account}
                                category={entry.category}
                                amount={entry.amount}
                                isEditing={editingId === entry.id}
                                editingDraft={editingDraft}
                                onStartEdit={() => startEditEntry(entry)}
                                onCancelEdit={cancelEditEntry}
                                onSaveEdit={() => saveEditEntry(entry.id)}
                                onChangeDraft={(patch) =>
                                    setEditingDraft((current) => ({ ...current, ...patch }))
                                }
                                onDelete={deleteEntry}
                                onCategoryChange={changeEntryCategory}
                            />
                        </div>
                    ))}

                    {isLoading && (
                        <div className="px-3 py-8 text-center text-sm text-gray-500">
                            Loading transactions...
                        </div>
                    )}

                    {!isLoading && filteredEntries.length === 0 && (
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
        </div>
    )
}

export default LedgerEntriesTable
