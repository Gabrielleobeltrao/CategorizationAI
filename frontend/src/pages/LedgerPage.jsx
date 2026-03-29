import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import LedgerEntriesTable from "../components/ledger/LedgerEntriesTable"
import LedgerHeader from "../components/ledger/LedgerHeader"
import AccountsSection from "../components/ledger/AccountsSection"
import CategoriesSection from "../components/ledger/CategoriesSection"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import { getClientById } from "../services/clients.service"
import {
    createAccount,
    deleteAccountById,
    listAccountsByClientId,
    updateAccountById,
} from "../services/accounts.service"
import {
    createCategory,
    deleteCategoryById,
    listCategoriesByClientId,
    updateCategoryById,
} from "../services/categories.service"
import {
    listTransactionsByClientId,
    listTransactionPeriodOptions,
    updateTransactionById,
    deleteTransactionById,
    createTransactionsBatch,
    categorizeTransactionsWithLlm,
} from "../services/transactions.service"
import { useNotification } from "../contexts/notification.context"

const DEFAULT_TRANSACTIONS_FILTERS = {
    accountIds: [],
    categoryIds: [],
    includeUncategorizedIncome: false,
    includeUncategorizedExpenses: false,
    splitMode: "all",
    llmProcessed: "all",
    years: [],
    months: [],
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: "",
}

function mapAccount(item = {}) {
    return {
        id: item?._id || item?.id || "",
        clientId: item?.clientId || "",
        name: item?.name || "",
        type: item?.type || "",
    }
}

function mapCategory(item = {}) {
    return {
        id: item?._id || item?.id || "",
        clientId: item?.clientId || "",
        name: item?.name || "",
        type: item?.type || "",
        description: item?.description || "",
    }
}

function mapTransaction(item = {}) {
    return {
        id: item?._id || item?.id || "",
        accountId: item?.accountId || "",
        categoryId: item?.categoryId || "",
        date: item?.date || "",
        description: item?.description || "",
        account: item?.accountName || item?.account || "",
        category: item?.category || "",
        amount: Number(item?.amount || 0),
        isSplit: Boolean(item?.isSplit),
        llmProcessed: Boolean(item?.llmProcessed),
        llmStatus: String(item?.llmStatus || "not_processed").trim().toLowerCase(),
        llmProcessedAt: item?.llmProcessedAt || null,
        llmCategorySuggestionId: item?.llmCategorySuggestionId || null,
        llmCategorySuggestionName: item?.llmCategorySuggestionName || null,
        splits: Array.isArray(item?.splits)
            ? item.splits.map((split, index) => ({
                id: split?.id || `${item?._id || item?.id || "tx"}-split-${index}`,
                categoryId: split?.categoryId || null,
                category: split?.category || null,
                amount: Number(split?.amount || 0),
            }))
            : [],
    }
}

function LedgerPage() {
    const { clientId: routeClientId } = useParams()
    const [searchParams] = useSearchParams()
    const clientId = routeClientId || searchParams.get("clientId")
    const preselectedCategoryName = String(searchParams.get("category") || "").trim()
    const { success, error } = useNotification()

    const [activeSection, setActiveSection] = useState("ledger")
    const [client, setClient] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [categoryList, setCategoryList] = useState([])
    const [ledgerEntries, setLedgerEntries] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [transactionsHasMore, setTransactionsHasMore] = useState(false)
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
    const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = useState(false)
    const [isCategorizingWithLlm, setIsCategorizingWithLlm] = useState(false)
    const [transactionsSearchTerm, setTransactionsSearchTerm] = useState("")
    const [transactionsFilters, setTransactionsFilters] = useState(DEFAULT_TRANSACTIONS_FILTERS)
    const [transactionsPeriodOptions, setTransactionsPeriodOptions] = useState({
        years: [],
        months: [],
    })
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [isBaseDataLoaded, setIsBaseDataLoaded] = useState(false)
    const [hasAppliedPreselectedCategory, setHasAppliedPreselectedCategory] = useState(false)

    const [showAccountForm, setShowAccountForm] = useState(false)
    const [showCategoryForm, setShowCategoryForm] = useState(false)

    const [newAccountName, setNewAccountName] = useState("")
    const [newAccountType, setNewAccountType] = useState("")

    const [newCategoryName, setNewCategoryName] = useState("")
    const [newCategoryType, setNewCategoryType] = useState("")
    const [newCategoryDescription, setNewCategoryDescription] = useState("")

    const [accountToDelete, setAccountToDelete] = useState(null)
    const [categoryToDelete, setCategoryToDelete] = useState(null)
    const pageScrollRef = useRef(null)
    const loadingMoreRef = useRef(false)
    const pageRef = useRef(1)
    const lastScrollTopRef = useRef(0)

    useEffect(() => {
        let active = true
        setIsBaseDataLoaded(false)

        if (!clientId) {
            setClient(null)
            setAccounts([])
            setCategoryList([])
            setLedgerEntries([])
            setIsBaseDataLoaded(true)
            return () => {
                active = false
            }
        }

        Promise.all([
            getClientById(clientId),
            listAccountsByClientId(clientId),
            listCategoriesByClientId(clientId),
        ])
            .then(([clientData, accountsData, categoriesData]) => {
                if (!active) return

                setClient(clientData || null)
                setAccounts(Array.isArray(accountsData) ? accountsData.map(mapAccount) : [])
                setCategoryList(Array.isArray(categoriesData) ? categoriesData.map(mapCategory) : [])
                setIsBaseDataLoaded(true)
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load ledger data")
                setClient(null)
                setAccounts([])
                setCategoryList([])
                setIsBaseDataLoaded(true)
            })

        return () => {
            active = false
        }
    }, [clientId, error])

    useEffect(() => {
        setHasAppliedPreselectedCategory(false)
    }, [clientId, preselectedCategoryName])

    useEffect(() => {
        if (!clientId || !isBaseDataLoaded || hasAppliedPreselectedCategory) return

        const normalizedCategory = String(preselectedCategoryName || "").trim()
        if (!normalizedCategory) {
            setHasAppliedPreselectedCategory(true)
            return
        }

        const lowerCategory = normalizedCategory.toLowerCase()
        const matchedCategory = categoryList.find(
            (item) => String(item?.name || "").trim().toLowerCase() === lowerCategory
        )

        setActiveSection("ledger")
        setTransactionsFilters({
            ...DEFAULT_TRANSACTIONS_FILTERS,
            categoryIds: matchedCategory?.id ? [matchedCategory.id] : [],
            includeUncategorizedIncome: lowerCategory === "uncategorized" || lowerCategory === "uncategorized income",
            includeUncategorizedExpenses: lowerCategory === "uncategorized" || lowerCategory === "uncategorized expenses",
        })
        pageRef.current = 1
        setHasAppliedPreselectedCategory(true)
    }, [
        clientId,
        isBaseDataLoaded,
        hasAppliedPreselectedCategory,
        preselectedCategoryName,
        categoryList,
    ])

    useEffect(() => {
        let active = true

        if (!clientId) {
            setLedgerEntries([])
            setTransactionsHasMore(false)
            setTransactionsPeriodOptions({ years: [], months: [] })
            pageRef.current = 1
            lastScrollTopRef.current = 0
            setTransactionsFilters(DEFAULT_TRANSACTIONS_FILTERS)
            return () => {
                active = false
            }
        }

        setIsLoadingTransactions(true)

        listTransactionsByClientId(clientId, {
            page: 1,
            limit: 30,
            search: transactionsSearchTerm,
            ...transactionsFilters,
        })
            .then((payload) => {
                if (!active) return
                const items = Array.isArray(payload?.items) ? payload.items : []
                const mapped = items.map(mapTransaction)
                const page = Number(payload?.page || 1)
                const totalPages = Number(payload?.totalPages || 1)

                setLedgerEntries(mapped)
                setTransactionsHasMore(page < totalPages)
                pageRef.current = page
                lastScrollTopRef.current = 0
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load transactions")
                setLedgerEntries([])
                setTransactionsHasMore(false)
                pageRef.current = 1
            })
            .finally(() => {
                if (!active) return
                setIsLoadingTransactions(false)
            })

        return () => {
            active = false
        }
    }, [clientId, transactionsSearchTerm, transactionsFilters, error])

    useEffect(() => {
        let active = true

        if (!clientId) {
            setTransactionsPeriodOptions({ years: [], months: [] })
            return () => {
                active = false
            }
        }

        listTransactionPeriodOptions(clientId, { silentLoading: true })
            .then((payload) => {
                if (!active) return
                setTransactionsPeriodOptions({
                    years: Array.isArray(payload?.years) ? payload.years : [],
                    months: Array.isArray(payload?.months) ? payload.months : [],
                })
            })
            .catch(() => {
                if (!active) return
                setTransactionsPeriodOptions({ years: [], months: [] })
            })

        return () => {
            active = false
        }
    }, [clientId])

    const loadMoreTransactions = async () => {
        if (!clientId || !transactionsHasMore || isLoadingTransactions) return
        if (loadingMoreRef.current) return

        try {
            loadingMoreRef.current = true
            setIsLoadingMoreTransactions(true)
            const nextPage = pageRef.current + 1
            const payload = await listTransactionsByClientId(clientId, {
                page: nextPage,
                limit: 30,
                search: transactionsSearchTerm,
                ...transactionsFilters,
                silentLoading: true,
            })

            const items = Array.isArray(payload?.items) ? payload.items : []
            const mapped = items.map(mapTransaction)
            const page = Number(payload?.page || nextPage)
            const totalPages = Number(payload?.totalPages || page)

            if (items.length === 0 || page <= pageRef.current) {
                setTransactionsHasMore(false)
                return
            }

            setLedgerEntries((current) => [...current, ...mapped])
            setTransactionsHasMore(page < totalPages)
            pageRef.current = page
        } catch (err) {
            error(err.message || "Failed to load more transactions")
        } finally {
            loadingMoreRef.current = false
            setIsLoadingMoreTransactions(false)
        }
    }

    const handlePageScroll = () => {
        if (activeSection !== "ledger") return
        const container = pageScrollRef.current
        if (!container) return
        if (!transactionsHasMore || isLoadingTransactions) return

        const currentScrollTop = container.scrollTop
        const scrollingDown = currentScrollTop > lastScrollTopRef.current
        lastScrollTopRef.current = currentScrollTop
        if (!scrollingDown) return
        if (loadingMoreRef.current) return

        const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
        if (distanceToBottom <= 100) {
            loadMoreTransactions()
        }
    }

    const handleApplyTransactionsFilters = (nextFilters = DEFAULT_TRANSACTIONS_FILTERS) => {
        setTransactionsFilters({
            accountIds: Array.isArray(nextFilters.accountIds) ? nextFilters.accountIds : [],
            categoryIds: Array.isArray(nextFilters.categoryIds) ? nextFilters.categoryIds : [],
            includeUncategorizedIncome: Boolean(nextFilters.includeUncategorizedIncome),
            includeUncategorizedExpenses: Boolean(nextFilters.includeUncategorizedExpenses),
            splitMode: String(nextFilters.splitMode || "all"),
            llmProcessed: String(nextFilters.llmProcessed || "all"),
            years: Array.isArray(nextFilters.years) ? nextFilters.years : [],
            months: Array.isArray(nextFilters.months) ? nextFilters.months : [],
            fromDate: String(nextFilters.fromDate || ""),
            toDate: String(nextFilters.toDate || ""),
            minAmount: String(nextFilters.minAmount || ""),
            maxAmount: String(nextFilters.maxAmount || ""),
        })
        pageRef.current = 1
    }

    const handleUpdateTransaction = async (id, patch) => {
        try {
            const updated = await updateTransactionById(id, patch)
            const normalized = mapTransaction(updated)
            setLedgerEntries((current) =>
                current.map((item) => (item.id === id ? normalized : item))
            )
            if (patch?.date !== undefined) {
                const periodOptions = await listTransactionPeriodOptions(clientId, { silentLoading: true })
                setTransactionsPeriodOptions({
                    years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                    months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
                })
            }
            success("Transaction updated successfully")
            return updated
        } catch (err) {
            error(err.message || "Failed to update transaction")
            throw err
        }
    }

    const handleDeleteTransaction = async (id) => {
        try {
            await deleteTransactionById(id)
            setLedgerEntries((current) => current.filter((item) => item.id !== id))
            const periodOptions = await listTransactionPeriodOptions(clientId, { silentLoading: true })
            setTransactionsPeriodOptions({
                years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
            })
            success("Transaction deleted successfully")
        } catch (err) {
            error(err.message || "Failed to delete transaction")
            throw err
        }
    }

    const handleDeleteTransactionsBulk = async (ids = []) => {
        const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : []
        if (targetIds.length === 0) return

        try {
            await Promise.all(targetIds.map((id) => deleteTransactionById(id)))
            const targetSet = new Set(targetIds)
            setLedgerEntries((current) => current.filter((item) => !targetSet.has(item.id)))
            const periodOptions = await listTransactionPeriodOptions(clientId, { silentLoading: true })
            setTransactionsPeriodOptions({
                years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
            })
            success(
                targetIds.length === 1
                    ? "Transaction deleted successfully"
                    : `${targetIds.length} transactions deleted successfully`
            )
        } catch (err) {
            error(err.message || "Failed to delete transactions")
            throw err
        }
    }

    const handleImportTransactions = async (transactions, summary = null) => {
        const result = await createTransactionsBatch(transactions)
        const insertedCount = Number(result?.insertedCount || 0)
        const totalRows = Number(summary?.totals?.totalRows || transactions.length)
        const skippedRows = Number(summary?.totals?.skippedRows || Math.max(totalRows - insertedCount, 0))
        const filesCount = Number(summary?.totals?.files || 1)

        success(
            `${insertedCount} transactions imported from ${filesCount} file(s). ${skippedRows} skipped out of ${totalRows} row(s).`
        )

        const periodOptions = await listTransactionPeriodOptions(clientId, { silentLoading: true })
        setTransactionsPeriodOptions({
            years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
            months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
        })
        setTransactionsFilters((current) => ({ ...current }))
    }

    const handleCategorizeWithLlmPreview = (payload = {}) => {
        const mode = payload?.mode === "selected" ? "selected" : "all_client"
        const targetIds = Array.isArray(payload?.targetIds) ? payload.targetIds : []
        const targetCount = Number(payload?.targetCount || 0)

        if (mode === "selected" && targetCount <= 0) {
            error("No eligible selected transactions. Split and categorized entries are skipped.")
            return
        }

        setIsCategorizingWithLlm(true)

        categorizeTransactionsWithLlm({
            clientId,
            mode,
            transactionIds: mode === "selected" ? targetIds : [],
        })
            .then((result) => {
                const processedCount = Number(result?.processedCount || 0)
                const categorizedCount = Number(result?.categorizedCount || 0)
                const emptyCount = Number(result?.emptyCount || 0)

                if (processedCount <= 0) {
                    error("No eligible transactions found to send to LLM.")
                    return
                }

                success(
                    `LLM done: ${processedCount} processed, ${categorizedCount} categorized, ${emptyCount} empty.`
                )
                pageRef.current = 1
                setTransactionsFilters((current) => ({ ...current }))
            })
            .catch((err) => {
                error(err.message || "Failed to categorize transactions with LLM")
            })
            .finally(() => {
                setIsCategorizingWithLlm(false)
            })
    }

    const handleCreateAccount = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            const created = await createAccount({
                clientId,
                name: newAccountName,
                type: newAccountType,
            })

            setAccounts((current) => [mapAccount(created), ...current])
            setNewAccountName("")
            setNewAccountType("")
            setShowAccountForm(false)
            success("Account created successfully")
        } catch (err) {
            error(err.message || "Failed to create account")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCreateCategory = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            const created = await createCategory({
                clientId,
                name: newCategoryName,
                type: newCategoryType,
                description: newCategoryDescription,
            })

            setCategoryList((current) => [mapCategory(created), ...current])
            setNewCategoryName("")
            setNewCategoryType("")
            setNewCategoryDescription("")
            setShowCategoryForm(false)
            success("Category created successfully")
        } catch (err) {
            error(err.message || "Failed to create category")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSaveAccountEdit = async (accountId, patch) => {
        try {
            setIsSubmitting(true)

            const updated = await updateAccountById(accountId, patch)

            setAccounts((current) =>
                current.map((item) => (item.id === accountId ? mapAccount(updated) : item))
            )
            success("Account updated successfully")
            return updated
        } catch (err) {
            error(err.message || "Failed to update account")
            throw err
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSaveCategoryEdit = async (categoryId, patch) => {
        try {
            setIsSubmitting(true)

            const updated = await updateCategoryById(categoryId, patch)

            setCategoryList((current) =>
                current.map((item) => (item.id === categoryId ? mapCategory(updated) : item))
            )
            success("Category updated successfully")
            return updated
        } catch (err) {
            error(err.message || "Failed to update category")
            throw err
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!accountToDelete?.id) return

        try {
            setIsSubmitting(true)
            await deleteAccountById(accountToDelete.id)
            setAccounts((current) => current.filter((item) => item.id !== accountToDelete.id))
            setAccountToDelete(null)
            success("Account deleted successfully")
        } catch (err) {
            error(err.message || "Failed to delete account")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteCategory = async () => {
        if (!categoryToDelete?.id) return

        try {
            setIsSubmitting(true)
            await deleteCategoryById(categoryToDelete.id)
            setCategoryList((current) => current.filter((item) => item.id !== categoryToDelete.id))
            setCategoryToDelete(null)
            success("Category deleted successfully")
        } catch (err) {
            error(err.message || "Failed to delete category")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section
            ref={pageScrollRef}
            onScroll={handlePageScroll}
            className="w-full h-full min-h-0 box-border p-4 overflow-y-auto"
        >
            <div className="min-h-full flex flex-col gap-4 pb-4">
                <LedgerHeader
                    clientName={client?.name || ""}
                    activeSection={activeSection}
                    onChangeSection={setActiveSection}
                />

                <section className={`min-h-[460px] rounded-lg border border-gray-200 bg-white p-4 flex flex-col ${activeSection === "ledger" ? "overflow-visible" : "overflow-hidden"}`}>
                    {activeSection === "ledger" && (
                        <section className="min-h-0 h-full p-1 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold">Transactions</h3>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    onClick={() => setShowUploadModal(true)}
                                >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 16V4" />
                                        <path d="m7 9 5-5 5 5" />
                                        <path d="M20 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" />
                                    </svg>
                                    <span>Upload CSV</span>
                                </button>
                            </div>
                            <div className="min-h-0 flex-1">
                                <LedgerEntriesTable
                                    ledgerEntries={ledgerEntries}
                                    accounts={accounts}
                                    categories={categoryList}
                                    yearOptions={transactionsPeriodOptions.years}
                                    monthOptions={transactionsPeriodOptions.months}
                                    clientId={clientId}
                                    searchTerm={transactionsSearchTerm}
                                    filters={transactionsFilters}
                                    onApplyFilters={handleApplyTransactionsFilters}
                                    onSearchTermChange={setTransactionsSearchTerm}
                                    onUpdateEntry={handleUpdateTransaction}
                                    onDeleteEntry={handleDeleteTransaction}
                                    onDeleteEntries={handleDeleteTransactionsBulk}
                                    onImportTransactions={handleImportTransactions}
                                    onCategorizeWithLlm={handleCategorizeWithLlmPreview}
                                    isCategorizingWithLlm={isCategorizingWithLlm}
                                    isLoading={isLoadingTransactions}
                                    isLoadingMore={isLoadingMoreTransactions}
                                    showUploadModal={showUploadModal}
                                    onCloseUploadModal={() => setShowUploadModal(false)}
                                />
                            </div>
                        </section>
                    )}

                    {activeSection === "accounts" && (
                        <AccountsSection
                            accounts={accounts}
                            onCreate={() => setShowAccountForm(true)}
                            onSaveEdit={handleSaveAccountEdit}
                            onDelete={setAccountToDelete}
                        />
                    )}

                    {activeSection === "categories" && (
                        <CategoriesSection
                            categories={categoryList}
                            onCreate={() => setShowCategoryForm(true)}
                            onSaveEdit={handleSaveCategoryEdit}
                            onDelete={setCategoryToDelete}
                        />
                    )}
                </section>
            </div>

            <PopupModal
                isOpen={showAccountForm}
                title="New Account"
                onClose={() => setShowAccountForm(false)}
            >
                <form className="flex flex-col gap-2" onSubmit={handleCreateAccount}>
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Account name"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                    />
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Type"
                        value={newAccountType}
                        onChange={(e) => setNewAccountType(e.target.value)}
                    />
                    <button className="bg-gray-100 rounded-md p-2" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Save"}
                    </button>
                </form>
            </PopupModal>

            <PopupModal
                isOpen={showCategoryForm}
                title="New Category"
                onClose={() => setShowCategoryForm(false)}
            >
                <form className="flex flex-col gap-2" onSubmit={handleCreateCategory}>
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Type"
                        value={newCategoryType}
                        onChange={(e) => setNewCategoryType(e.target.value)}
                    />
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Description"
                        value={newCategoryDescription}
                        onChange={(e) => setNewCategoryDescription(e.target.value)}
                    />
                    <button className="bg-gray-100 rounded-md p-2" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Save"}
                    </button>
                </form>
            </PopupModal>

            <ConfirmModal
                isOpen={Boolean(accountToDelete)}
                title="Delete Account"
                message={`This action will permanently delete ${accountToDelete?.name || "this account"}.`}
                confirmLabel="Delete Account"
                onConfirm={handleDeleteAccount}
                onClose={() => setAccountToDelete(null)}
                isLoading={isSubmitting}
            />

            <ConfirmModal
                isOpen={Boolean(categoryToDelete)}
                title="Delete Category"
                message={`This action will permanently delete ${categoryToDelete?.name || "this category"}.`}
                confirmLabel="Delete Category"
                onConfirm={handleDeleteCategory}
                onClose={() => setCategoryToDelete(null)}
                isLoading={isSubmitting}
            />
        </section>
    )
}

export default LedgerPage
