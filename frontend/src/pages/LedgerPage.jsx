import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useOutletContext, useParams, useSearchParams } from "react-router-dom"
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
    summarizeTransactionsByClientId,
    listTransactionPeriodOptions,
    updateTransactionById,
    updateTransactionsByIds,
    deleteTransactionById,
    deleteTransactionsByIds,
    createTransactionsBatch,
} from "../services/transactions.service"
import { useNotification } from "../contexts/notification.context"
import { useCategorizationJobs } from "../contexts/categorizationJobs.context"
import { trackClientOpened } from "../utils/recentClients"
import { emitDashboardRefresh } from "../utils/dashboardRefresh"
import { CATEGORY_TYPE_OPTIONS, getCategoryTypeLabel, normalizeCategoryType } from "../constants/categoryTypes"

const DEFAULT_TRANSACTIONS_FILTERS = {
    accountIds: [],
    categoryIds: [],
    includeUncategorizedIncome: false,
    includeUncategorizedExpenses: false,
    splitMode: "all",
    amountSign: "all",
    llmProcessed: "all",
    iconType: "all",
    years: [],
    months: [],
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: "",
}
const TRANSACTIONS_UPLOAD_CHUNK_SIZE = 400

function getLedgerFiltersStorageKey(clientId = "") {
    return `ledger-filters:${clientId || "global"}`
}

function normalizeTransactionsFilters(raw = {}) {
    return {
        accountIds: Array.isArray(raw?.accountIds) ? raw.accountIds : [],
        categoryIds: Array.isArray(raw?.categoryIds) ? raw.categoryIds : [],
        includeUncategorizedIncome: Boolean(raw?.includeUncategorizedIncome),
        includeUncategorizedExpenses: Boolean(raw?.includeUncategorizedExpenses),
        splitMode: String(raw?.splitMode || "all"),
        amountSign: String(raw?.amountSign || "all"),
        llmProcessed: String(raw?.llmProcessed || "all"),
        iconType: String(raw?.iconType || "all"),
        years: Array.isArray(raw?.years) ? raw.years : [],
        months: Array.isArray(raw?.months) ? raw.months : [],
        fromDate: String(raw?.fromDate || ""),
        toDate: String(raw?.toDate || ""),
        minAmount: String(raw?.minAmount || ""),
        maxAmount: String(raw?.maxAmount || ""),
    }
}

function readPersistedLedgerState(clientId = "") {
    const fallback = {
        searchTerm: "",
        filters: { ...DEFAULT_TRANSACTIONS_FILTERS },
    }

    if (typeof window === "undefined") return fallback

    try {
        const raw = window.sessionStorage.getItem(getLedgerFiltersStorageKey(clientId))
        if (!raw) return fallback
        const parsed = JSON.parse(raw)

        return {
            searchTerm: String(parsed?.searchTerm || ""),
            filters: normalizeTransactionsFilters(parsed?.filters || {}),
        }
    } catch {
        return fallback
    }
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
        type: normalizeCategoryType(item?.type) || "",
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
        categorizedSource: String(item?.categorizedSource || "").trim().toLowerCase(),
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

function getDefaultUncategorizedLabelByAmount(amount = 0) {
    const numericAmount = Number(amount || 0)
    return numericAmount >= 0 ? "Uncategorized income" : "Uncategorized expenses"
}

function isUncategorizedEntry(entry = {}) {
    const categoryId = String(entry?.categoryId || "").trim()
    const categoryName = String(entry?.category || "").trim().toLowerCase()
    if (!categoryId) return true
    return categoryName === "uncategorized income" || categoryName === "uncategorized expenses"
}

function isSplitEntry(entry = {}) {
    return Boolean(entry?.isSplit) || (Array.isArray(entry?.splits) && entry.splits.length > 1)
}

function isLlmAlreadyProcessed(entry = {}) {
    return (
        Boolean(entry?.llmProcessed) ||
        Boolean(entry?.llmProcessedAt) ||
        ["suggested", "empty", "error"].includes(String(entry?.llmStatus || "").toLowerCase())
    )
}

function isEligibleForAiProcessing(entry = {}) {
    return !isSplitEntry(entry) && !isLlmAlreadyProcessed(entry) && isUncategorizedEntry(entry)
}

function formatAccountSummaryLabel(accounts = [], accountIds = []) {
    const selectedIds = Array.isArray(accountIds) ? accountIds.filter(Boolean) : []
    if (selectedIds.length === 0) return "All accounts"

    const matchedAccounts = selectedIds
        .map((id) => accounts.find((account) => account.id === id))
        .filter(Boolean)

    if (matchedAccounts.length === 1) {
        return matchedAccounts[0].name || "Selected account"
    }

    if (matchedAccounts.length > 1) {
        return `${matchedAccounts.length} accounts selected`
    }

    return "Selected account"
}

function formatCurrency(value = 0) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(Number(value || 0))
}

function LedgerPage() {
    const outletContext = useOutletContext() || {}
    const sharedScrollRef = outletContext?.contentScrollRef || null
    const { clientId: routeClientId } = useParams()
    const [searchParams] = useSearchParams()
    const location = useLocation()
    const clientId = routeClientId || searchParams.get("clientId")
    const persistedState = readPersistedLedgerState(clientId)
    const preselectedCategoryName = String(searchParams.get("category") || "").trim()
    const { success, error } = useNotification()
    const { jobs, startCategorizationJob } = useCategorizationJobs()

    const [client, setClient] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [categoryList, setCategoryList] = useState([])
    const [ledgerEntries, setLedgerEntries] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [transactionsHasMore, setTransactionsHasMore] = useState(false)
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
    const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = useState(false)
    const [isCategorizingWithLlm, setIsCategorizingWithLlm] = useState(false)
    const [pendingLlmEntryIds, setPendingLlmEntryIds] = useState([])
    const [transactionsSearchTerm, setTransactionsSearchTerm] = useState(persistedState.searchTerm)
    const [transactionsFilters, setTransactionsFilters] = useState(persistedState.filters)
    const [transactionsPeriodOptions, setTransactionsPeriodOptions] = useState({
        years: [],
        months: [],
    })
    const [transactionsSummary, setTransactionsSummary] = useState({
        totalAmount: 0,
        totalCount: 0,
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
    const [accountIdsToDelete, setAccountIdsToDelete] = useState([])
    const [categoryIdsToDelete, setCategoryIdsToDelete] = useState([])
    const localPageScrollRef = useRef(null)
    const pageScrollRef = sharedScrollRef || localPageScrollRef
    const loadingMoreRef = useRef(false)
    const pageRef = useRef(1)
    const lastScrollTopRef = useRef(0)
    const handledCompletedJobIdsRef = useRef(new Set())
    const activeSection = location.pathname.endsWith("/ledger/accounts")
        ? "accounts"
        : location.pathname.endsWith("/ledger/categories")
            ? "categories"
            : "ledger"

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
        if (!clientId || !client?.name) return
        trackClientOpened({
            id: clientId,
            name: client.name,
            to: `${location.pathname}${location.search || ""}`,
        })
    }, [clientId, client?.name, location.pathname, location.search])

    useEffect(() => {
        const persisted = readPersistedLedgerState(clientId)
        setTransactionsSearchTerm(persisted.searchTerm)
        setTransactionsFilters(persisted.filters)
        pageRef.current = 1
    }, [clientId])

    useEffect(() => {
        if (typeof window === "undefined") return
        try {
            window.sessionStorage.setItem(
                getLedgerFiltersStorageKey(clientId),
                JSON.stringify({
                    searchTerm: transactionsSearchTerm,
                    filters: normalizeTransactionsFilters(transactionsFilters),
                })
            )
        } catch {
            // ignore storage write errors
        }
    }, [clientId, transactionsSearchTerm, transactionsFilters])

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

    useEffect(() => {
        let active = true

        if (!clientId) {
            setTransactionsSummary({
                totalAmount: 0,
                totalCount: 0,
            })
            return () => {
                active = false
            }
        }

        summarizeTransactionsByClientId(clientId, {
            accountIds: transactionsFilters.accountIds,
            silentLoading: true,
        })
            .then((payload) => {
                if (!active) return
                setTransactionsSummary({
                    totalAmount: Number(payload?.totalAmount || 0),
                    totalCount: Number(payload?.totalCount || 0),
                })
            })
            .catch(() => {
                if (!active) return
                setTransactionsSummary({
                    totalAmount: 0,
                    totalCount: 0,
                })
            })

        return () => {
            active = false
        }
    }, [clientId, transactionsFilters.accountIds])

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

    const handlePageScroll = useCallback(() => {
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
    }, [activeSection, isLoadingTransactions, loadMoreTransactions, pageScrollRef, transactionsHasMore])

    useEffect(() => {
        const container = pageScrollRef.current
        if (!container) return undefined

        container.addEventListener("scroll", handlePageScroll)

        return () => {
            container.removeEventListener("scroll", handlePageScroll)
        }
    }, [handlePageScroll, pageScrollRef])

    const handleApplyTransactionsFilters = (nextFilters = DEFAULT_TRANSACTIONS_FILTERS) => {
        setTransactionsFilters(normalizeTransactionsFilters(nextFilters))
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
            emitDashboardRefresh("transaction-updated")
            success("Transaction updated successfully")
            return updated
        } catch (err) {
            error(err.message || "Failed to update transaction")
            throw err
        }
    }

    const handleUpdateTransactionsBulk = async (updates = []) => {
        const safeUpdates = Array.isArray(updates)
            ? updates
                .map((item) => ({
                    id: String(item?.id || "").trim(),
                    patch: item?.patch || {},
                }))
                .filter((item) => item.id && Object.keys(item.patch).length > 0)
            : []

        if (safeUpdates.length === 0) return

        try {
            await updateTransactionsByIds(safeUpdates)

            const patchById = new Map(
                safeUpdates.map((item) => [item.id, item.patch])
            )

            setLedgerEntries((current) =>
                current.map((entry) => {
                    const patch = patchById.get(entry.id)
                    if (!patch) return entry

                    const nextAmount = patch.amount !== undefined ? Number(patch.amount || 0) : entry.amount
                    const nextCategoryId = patch.categoryId !== undefined ? (patch.categoryId || "") : entry.categoryId
                    const nextCategory = patch.category !== undefined
                        ? (patch.category || (nextCategoryId ? "" : getDefaultUncategorizedLabelByAmount(nextAmount)))
                        : entry.category

                    return {
                        ...entry,
                        date: patch.date !== undefined ? (patch.date || "") : entry.date,
                        accountId: patch.accountId !== undefined ? (patch.accountId || "") : entry.accountId,
                        account: patch.accountName !== undefined ? (patch.accountName || "") : entry.account,
                        categoryId: nextCategoryId,
                        category: nextCategory,
                    }
                })
            )

            const touchedDate = safeUpdates.some((item) => Object.prototype.hasOwnProperty.call(item.patch, "date"))
            if (touchedDate) {
                const periodOptions = await listTransactionPeriodOptions(clientId, { silentLoading: true })
                setTransactionsPeriodOptions({
                    years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                    months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
                })
            }

            emitDashboardRefresh("transactions-batch-updated")
            success(
                safeUpdates.length === 1
                    ? "Transaction updated successfully"
                    : `${safeUpdates.length} transactions updated successfully`
            )
        } catch (err) {
            error(err.message || "Failed to update transactions")
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
            emitDashboardRefresh("transaction-deleted")
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
            if (targetIds.length > 1) {
                await deleteTransactionsByIds(targetIds)
            } else {
                await deleteTransactionById(targetIds[0])
            }
            const targetSet = new Set(targetIds)
            setLedgerEntries((current) => current.filter((item) => !targetSet.has(item.id)))
            const periodOptions = await listTransactionPeriodOptions(clientId, { silentLoading: true })
            setTransactionsPeriodOptions({
                years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
            })
            emitDashboardRefresh("transactions-batch-deleted")
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

    const handleImportTransactions = async (transactions, summary = null, onProgress) => {
        const total = Array.isArray(transactions) ? transactions.length : 0
        if (total === 0) {
            throw new Error("No transactions to import")
        }

        const totalChunks = Math.ceil(total / TRANSACTIONS_UPLOAD_CHUNK_SIZE)
        let insertedCount = 0

        onProgress?.({
            status: "uploading",
            currentChunk: 0,
            totalChunks,
            processed: 0,
            total,
            insertedCount,
        })

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
            const start = chunkIndex * TRANSACTIONS_UPLOAD_CHUNK_SIZE
            const end = start + TRANSACTIONS_UPLOAD_CHUNK_SIZE
            const chunk = transactions.slice(start, end)

            const result = await createTransactionsBatch(chunk, { silentLoading: true })
            insertedCount += Number(result?.insertedCount || 0)

            onProgress?.({
                status: "uploading",
                currentChunk: chunkIndex + 1,
                totalChunks,
                processed: Math.min(end, total),
                total,
                insertedCount,
            })
        }

        onProgress?.({
            status: "done",
            currentChunk: totalChunks,
            totalChunks,
            processed: total,
            total,
            insertedCount,
        })

        const totalRows = Number(summary?.totals?.totalRows || transactions.length)
        const skippedRows = Number(summary?.totals?.skippedRows || Math.max(totalRows - insertedCount, 0))
        const filesCount = Number(summary?.totals?.files || 1)

        success(
            `${insertedCount} transactions imported from ${filesCount} file(s). ${skippedRows} skipped out of ${totalRows} row(s).`
        )
        emitDashboardRefresh("transactions-imported")

        const periodOptions = await listTransactionPeriodOptions(clientId, { silentLoading: true })
        setTransactionsPeriodOptions({
            years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
            months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
        })
        setTransactionsFilters((current) => ({ ...current }))
    }

    const refreshLedgerAfterCategorization = useCallback(async () => {
        if (!clientId) return

        const [categoriesData, payload] = await Promise.all([
            listCategoriesByClientId(clientId),
            listTransactionsByClientId(clientId, {
                page: 1,
                limit: 30,
                search: transactionsSearchTerm,
                ...transactionsFilters,
                silentLoading: true,
            }),
        ])

        const items = Array.isArray(payload?.items) ? payload.items : []
        const mapped = items.map(mapTransaction)
        const page = Number(payload?.page || 1)
        const totalPages = Number(payload?.totalPages || 1)

        setCategoryList(Array.isArray(categoriesData) ? categoriesData.map(mapCategory) : [])
        setLedgerEntries(mapped)
        setTransactionsHasMore(page < totalPages)
        pageRef.current = page
    }, [clientId, transactionsSearchTerm, transactionsFilters])

    const handleCategorizeWithLlmPreview = (payload = {}) => {
        const mode = payload?.mode === "selected" ? "selected" : "all_client"
        const targetIds = Array.isArray(payload?.targetIds) ? payload.targetIds : []
        const targetCount = Number(payload?.targetCount || 0)

        if (mode === "selected" && targetCount <= 0) {
            error("No eligible selected transactions. Split and categorized entries are skipped.")
            return
        }

        setIsCategorizingWithLlm(true)

        if (mode === "selected") {
            setPendingLlmEntryIds(targetIds)
        } else {
            const visibleEligibleIds = ledgerEntries
                .filter((entry) => isEligibleForAiProcessing(entry))
                .map((entry) => entry.id)
            setPendingLlmEntryIds(visibleEligibleIds)
        }

        startCategorizationJob({
            clientId,
            mode,
            transactionIds: mode === "selected" ? targetIds : [],
        })
            .then((result) => {
                emitDashboardRefresh("categorization-job-queued")
                success(`AI categorization added to queue. Job ${result.jobId}`)
            })
            .catch((err) => {
                error(err.message || "Failed to enqueue AI categorization")
                setPendingLlmEntryIds([])
            })
            .finally(() => {
                setIsCategorizingWithLlm(false)
            })
    }

    useEffect(() => {
        if (!clientId || !Array.isArray(jobs)) {
            setPendingLlmEntryIds([])
            return
        }

        const activeClientJobs = jobs.filter((job) => {
            const status = String(job?.status || "")
            const jobClientId = String(job?.clientId || "")
            return (
                jobClientId === String(clientId) &&
                (status === "queued" || status === "running")
            )
        })

        if (activeClientJobs.length === 0) {
            setPendingLlmEntryIds([])
            return
        }

        const nextIds = new Set()

        activeClientJobs.forEach((job) => {
            const mode = String(job?.mode || "all_client")
            const transactionIds = Array.isArray(job?.transactionIds) ? job.transactionIds : []

            if (mode === "selected" && transactionIds.length > 0) {
                transactionIds.forEach((id) => nextIds.add(String(id)))
                return
            }

            ledgerEntries
                .filter((entry) => isEligibleForAiProcessing(entry))
                .forEach((entry) => nextIds.add(String(entry.id)))
        })

        setPendingLlmEntryIds(Array.from(nextIds))
    }, [jobs, clientId, ledgerEntries])

    useEffect(() => {
        if (!clientId || !Array.isArray(jobs) || jobs.length === 0) return

        const completedForClient = jobs.filter((job) => {
            const jobId = String(job?._id || "")
            const status = String(job?.status || "")
            const jobClientId = String(job?.clientId || "")
            if (!jobId || jobClientId !== String(clientId)) return false
            if (status !== "done") return false
            if (handledCompletedJobIdsRef.current.has(jobId)) return false
            return true
        })

        if (completedForClient.length === 0) return

        completedForClient.forEach((job) => {
            handledCompletedJobIdsRef.current.add(String(job._id))
        })

        refreshLedgerAfterCategorization().catch(() => {})
    }, [jobs, clientId, refreshLedgerAfterCategorization])

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

    const handleCreateCategoryFromTransaction = async (input = {}) => {
        try {
            const created = await createCategory({
                clientId,
                name: input?.name,
                type: input?.type,
                description: input?.description,
            })
            const mappedCategory = mapCategory(created)
            setCategoryList((current) => [mappedCategory, ...current])
            success("Category created successfully")
            return mappedCategory
        } catch (err) {
            error(err.message || "Failed to create category")
            throw err
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

    const handleDeleteAccountsBulk = async () => {
        const targetIds = Array.isArray(accountIdsToDelete) ? accountIdsToDelete.filter(Boolean) : []
        if (targetIds.length === 0) return

        try {
            setIsSubmitting(true)
            await Promise.all(targetIds.map((id) => deleteAccountById(id)))
            const targetSet = new Set(targetIds)
            setAccounts((current) => current.filter((item) => !targetSet.has(item.id)))
            setAccountIdsToDelete([])
            success(
                targetIds.length === 1
                    ? "Account deleted successfully"
                    : `${targetIds.length} accounts deleted successfully`
            )
        } catch (err) {
            error(err.message || "Failed to delete selected accounts")
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

    const handleDeleteCategoriesBulk = async () => {
        const targetIds = Array.isArray(categoryIdsToDelete) ? categoryIdsToDelete.filter(Boolean) : []
        if (targetIds.length === 0) return

        try {
            setIsSubmitting(true)
            await Promise.all(targetIds.map((id) => deleteCategoryById(id)))
            const targetSet = new Set(targetIds)
            setCategoryList((current) => current.filter((item) => !targetSet.has(item.id)))
            setCategoryIdsToDelete([])
            success(
                targetIds.length === 1
                    ? "Category deleted successfully"
                    : `${targetIds.length} categories deleted successfully`
            )
        } catch (err) {
            error(err.message || "Failed to delete selected categories")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section
            ref={sharedScrollRef ? undefined : localPageScrollRef}
            className="relative w-full min-w-0 box-border p-4"
        >
            <div className="min-h-full min-w-0 flex flex-col gap-4 pb-4">
                <LedgerHeader
                    clientName={client?.name || ""}
                />

                <section className={`min-h-[460px] min-w-0 rounded-lg border border-gray-200 bg-white p-4 flex flex-col ${activeSection === "ledger" ? "overflow-visible" : "overflow-hidden"}`}>
                    {activeSection === "ledger" && (
                        <section className="min-h-0 min-w-0 h-full p-1 flex flex-col gap-3">
                            <div className="relative z-20 flex items-center justify-between bg-white">
                                <div>
                                    <h3 className="text-base font-bold">Transactions</h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {formatAccountSummaryLabel(accounts, transactionsFilters.accountIds)} · {formatCurrency(transactionsSummary.totalAmount)} · {transactionsSummary.totalCount.toLocaleString("en-US")} transaction(s)
                                    </p>
                                </div>
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
                                    <span>Upload Files</span>
                                </button>
                            </div>
                            <div className="min-h-0 min-w-0 flex-1">
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
                                    onUpdateEntries={handleUpdateTransactionsBulk}
                                    onDeleteEntry={handleDeleteTransaction}
                                    onDeleteEntries={handleDeleteTransactionsBulk}
                                    onImportTransactions={handleImportTransactions}
                                    onCreateCategory={handleCreateCategoryFromTransaction}
                                    overlayBoundaryRef={pageScrollRef}
                                    onCategorizeWithLlm={handleCategorizeWithLlmPreview}
                                    isCategorizingWithLlm={isCategorizingWithLlm}
                                    pendingLlmEntryIds={pendingLlmEntryIds}
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
                            onDeleteMany={setAccountIdsToDelete}
                        />
                    )}

                    {activeSection === "categories" && (
                        <CategoriesSection
                            categories={categoryList}
                            onCreate={() => setShowCategoryForm(true)}
                            onSaveEdit={handleSaveCategoryEdit}
                            onDelete={setCategoryToDelete}
                            onDeleteMany={setCategoryIdsToDelete}
                        />
                    )}
                </section>
            </div>

            <PopupModal
                isOpen={showAccountForm}
                title="Create Account"
                onClose={() => setShowAccountForm(false)}
            >
                <form className="flex flex-col gap-4" onSubmit={handleCreateAccount}>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Account name</span>
                        <input
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                            type="text"
                            placeholder="Chase Business Checking"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</span>
                        <input
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                            type="text"
                            placeholder="checking"
                            value={newAccountType}
                            onChange={(e) => setNewAccountType(e.target.value)}
                        />
                    </label>
                    <div className="mt-1 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setShowAccountForm(false)}
                        >
                            Cancel
                        </button>
                        <button className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Account"}
                        </button>
                    </div>
                </form>
            </PopupModal>

            <PopupModal
                isOpen={showCategoryForm}
                title="Create Category"
                onClose={() => setShowCategoryForm(false)}
            >
                <form className="flex flex-col gap-4" onSubmit={handleCreateCategory}>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category name</span>
                        <input
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                            type="text"
                            placeholder="Supplies"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                    </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</span>
                            <div className="relative w-full">
                                <select
                                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    value={newCategoryType}
                                    onChange={(e) => setNewCategoryType(e.target.value)}
                                >
                                    <option value="">Select type</option>
                                    {CATEGORY_TYPE_OPTIONS.map((option) => (
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
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</span>
                        <input
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                            type="text"
                            placeholder="Materials and supplies"
                            value={newCategoryDescription}
                            onChange={(e) => setNewCategoryDescription(e.target.value)}
                        />
                    </label>
                    <div className="mt-1 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setShowCategoryForm(false)}
                        >
                            Cancel
                        </button>
                        <button className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Category"}
                        </button>
                    </div>
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

            <ConfirmModal
                isOpen={accountIdsToDelete.length > 0}
                title="Delete Accounts"
                message={`This action will permanently delete ${accountIdsToDelete.length} selected account(s).`}
                confirmLabel={accountIdsToDelete.length > 1 ? "Delete Accounts" : "Delete Account"}
                onConfirm={handleDeleteAccountsBulk}
                onClose={() => setAccountIdsToDelete([])}
                isLoading={isSubmitting}
            />

            <ConfirmModal
                isOpen={categoryIdsToDelete.length > 0}
                title="Delete Categories"
                message={`This action will permanently delete ${categoryIdsToDelete.length} selected category(ies).`}
                confirmLabel={categoryIdsToDelete.length > 1 ? "Delete Categories" : "Delete Category"}
                onConfirm={handleDeleteCategoriesBulk}
                onClose={() => setCategoryIdsToDelete([])}
                isLoading={isSubmitting}
            />
        </section>
    )
}

export default LedgerPage
