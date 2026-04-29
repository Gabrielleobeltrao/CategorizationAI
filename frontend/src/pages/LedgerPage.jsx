import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useOutletContext, useParams, useSearchParams } from "react-router-dom"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import TagsInput from "../components/ui/TagsInput"
import TagRulesHelp from "../components/ui/TagRulesHelp"
import { getCachedClientLedgerBootstrap, getClientLedgerBootstrap } from "../services/clients.service"
import {
    createAccount,
    deleteAccountsByIds,
    deleteAccountById,
    listAccountsByClientId,
    updateAccountById,
} from "../services/accounts.service"
import {
    createCategory,
    clearUnusedCategoriesByClientId,
    deleteCategoriesByIds,
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
} from "../services/transactions.service"
import { useNotification } from "../contexts/notification.context"
import { useCategorizationJobs } from "../contexts/categorizationJobs.context"
import { useAuth } from "../contexts/auth.context"
import { useOfficeTags } from "../hooks/useOfficeTags"
import { trackClientOpened } from "../utils/recentClients"
import { emitDashboardRefresh } from "../utils/dashboardRefresh"
import { CATEGORY_TYPE_OPTIONS, getCategoryTypeLabel, normalizeCategoryType } from "../constants/categoryTypes"

const LedgerEntriesTable = lazy(() => import("../components/ledger/LedgerEntriesTable"))
const AccountsSection = lazy(() => import("../components/ledger/AccountsSection"))
const CategoriesSection = lazy(() => import("../components/ledger/CategoriesSection"))
const LedgerHeader = lazy(() => import("../components/ledger/LedgerHeader"))

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
const TRANSACTIONS_IMPORT_DONE_EVENT = "app:transactions-import-job-done"
const TRANSACTIONS_PAGE_SIZE = 50
const TRANSACTIONS_LOAD_MORE_THRESHOLD_PX = 600
const TRANSACTIONS_SUMMARY_REFRESH_DELAY_MS = 350

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

function buildAppliedTransactionsQuery(searchTerm = "", filters = {}) {
    return {
        searchTerm: String(searchTerm || ""),
        filters: normalizeTransactionsFilters(filters),
    }
}

function isDefaultLedgerQuery(searchTerm = "", filters = {}) {
    const normalized = normalizeTransactionsFilters(filters)
    return (
        !String(searchTerm || "").trim() &&
        normalized.accountIds.length === 0 &&
        normalized.categoryIds.length === 0 &&
        !normalized.includeUncategorizedIncome &&
        !normalized.includeUncategorizedExpenses &&
        normalized.splitMode === "all" &&
        normalized.amountSign === "all" &&
        normalized.llmProcessed === "all" &&
        normalized.iconType === "all" &&
        normalized.years.length === 0 &&
        normalized.months.length === 0 &&
        !normalized.fromDate &&
        !normalized.toDate &&
        !String(normalized.minAmount || "").trim() &&
        !String(normalized.maxAmount || "").trim()
    )
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
        tags: Array.isArray(item?.tags) ? item.tags : [],
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

function hydrateLedgerBootstrapPayload(payload = {}, setters = {}, options = {}) {
    const hydrateTransactions = options.hydrateTransactions !== false
    const hydratePeriodOptions = options.hydratePeriodOptions !== false
    const transactionsPayload = payload?.transactions || {}
    const items = Array.isArray(transactionsPayload?.items) ? transactionsPayload.items : []
    const nextCursor = String(transactionsPayload?.nextCursor || "").trim()

    setters.setClient?.(payload?.client || null)
    setters.setAccounts?.(Array.isArray(payload?.accounts) ? payload.accounts.map(mapAccount) : [])
    setters.setCategoryList?.(Array.isArray(payload?.categories) ? payload.categories.map(mapCategory) : [])
    if (hydrateTransactions) {
        setters.setLedgerEntries?.(items.map(mapTransaction))
        setters.setTransactionsHasMore?.(Boolean(transactionsPayload?.hasMore && nextCursor))
        setters.setTransactionsNextCursor?.(nextCursor || null)
    }

    if (hydratePeriodOptions && payload?.periodOptions) {
        setters.setTransactionsPeriodOptions?.({
            years: Array.isArray(payload?.periodOptions?.years) ? payload.periodOptions.years : [],
            months: Array.isArray(payload?.periodOptions?.months) ? payload.periodOptions.months : [],
        })
    }
}

function buildTransactionsSummaryOptions(searchTerm = "", filters = {}) {
    return {
        search: String(searchTerm || "").trim(),
        ...normalizeTransactionsFilters(filters),
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

function LedgerSectionFallback({ className = "" }) {
    return (
        <div className={`flex items-center justify-center rounded-lg bg-white px-4 py-8 text-sm text-gray-500 ${className}`}>
            Loading...
        </div>
    )
}

function mergeLedgerEntryWithPatch(entry = {}, patch = {}) {
    const nextAmount = patch.amount !== undefined ? Number(patch.amount || 0) : Number(entry.amount || 0)
    const nextCategoryId = patch.categoryId !== undefined ? (patch.categoryId || "") : entry.categoryId
    const hasCategoryPatch = Object.prototype.hasOwnProperty.call(patch, "category")
    const hasCategoryIdPatch = Object.prototype.hasOwnProperty.call(patch, "categoryId")
    const nextCategory = hasCategoryPatch
        ? (patch.category || (nextCategoryId ? "" : getDefaultUncategorizedLabelByAmount(nextAmount)))
        : hasCategoryIdPatch && !nextCategoryId
            ? getDefaultUncategorizedLabelByAmount(nextAmount)
            : entry.category

    return {
        ...entry,
        date: patch.date !== undefined ? (patch.date || "") : entry.date,
        description: patch.description !== undefined ? (patch.description || "") : entry.description,
        accountId: patch.accountId !== undefined ? (patch.accountId || "") : entry.accountId,
        account: patch.accountName !== undefined ? (patch.accountName || "") : entry.account,
        categoryId: nextCategoryId,
        category: nextCategory,
        amount: nextAmount,
        splits: patch.splits !== undefined ? patch.splits : entry.splits,
        isSplit: patch.isSplit !== undefined ? Boolean(patch.isSplit) : entry.isSplit,
        llmProcessed: patch.llmProcessed !== undefined ? Boolean(patch.llmProcessed) : entry.llmProcessed,
        llmStatus: patch.llmStatus !== undefined ? String(patch.llmStatus || "") : entry.llmStatus,
        llmProcessedAt: patch.llmProcessedAt !== undefined ? patch.llmProcessedAt : entry.llmProcessedAt,
        categorizedSource: patch.categorizedSource !== undefined
            ? String(patch.categorizedSource || "")
            : entry.categorizedSource,
        llmCategorySuggestionId: patch.llmCategorySuggestionId !== undefined
            ? patch.llmCategorySuggestionId
            : entry.llmCategorySuggestionId,
        llmCategorySuggestionName: patch.llmCategorySuggestionName !== undefined
            ? patch.llmCategorySuggestionName
            : entry.llmCategorySuggestionName,
    }
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
    const { jobs, startCategorizationJob, startTransactionsImportJob } = useCategorizationJobs()
    const { profile } = useAuth()
    const officeId = String(profile?.officeId || "").trim()
    const { tags: officeTags, reloadTags, deleteTag, deletingTag } = useOfficeTags(officeId, {
        onError: (err) => error(err.message || "Failed to delete tag"),
        onDeleteSuccess: (tag) => success(`Tag "${tag}" deleted successfully`),
    })

    const [client, setClient] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [categoryList, setCategoryList] = useState([])
    const [ledgerEntries, setLedgerEntries] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [transactionsHasMore, setTransactionsHasMore] = useState(false)
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
    const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = useState(false)
    const [transactionsNextCursor, setTransactionsNextCursor] = useState(null)
    const [isCategorizingWithLlm, setIsCategorizingWithLlm] = useState(false)
    const [pendingLlmEntryIds, setPendingLlmEntryIds] = useState([])
    const [transactionsQuery, setTransactionsQuery] = useState(() =>
        buildAppliedTransactionsQuery(persistedState.searchTerm, persistedState.filters)
    )
    const [transactionsPeriodOptions, setTransactionsPeriodOptions] = useState({
        years: [],
        months: [],
    })
    const [transactionsSummary, setTransactionsSummary] = useState({
        totalAmount: 0,
        totalCount: 0,
    })
    const [isLoadingTransactionsSummary, setIsLoadingTransactionsSummary] = useState(false)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [isBaseDataLoaded, setIsBaseDataLoaded] = useState(false)
    const skipNextTransactionsFetchKeyRef = useRef("")
    const skipNextPeriodOptionsFetchRef = useRef(false)
    const hasLoadedPeriodOptionsRef = useRef(false)
    const [hasAppliedPreselectedCategory, setHasAppliedPreselectedCategory] = useState(false)

    const [showAccountForm, setShowAccountForm] = useState(false)
    const [showCategoryForm, setShowCategoryForm] = useState(false)

    const [newAccountName, setNewAccountName] = useState("")
    const [newAccountType, setNewAccountType] = useState("")

    const [newCategoryName, setNewCategoryName] = useState("")
    const [newCategoryType, setNewCategoryType] = useState("")
    const [newCategoryDescription, setNewCategoryDescription] = useState("")
    const [newCategoryTags, setNewCategoryTags] = useState([])

    const [accountToDelete, setAccountToDelete] = useState(null)
    const [categoryToDelete, setCategoryToDelete] = useState(null)
    const [accountIdsToDelete, setAccountIdsToDelete] = useState([])
    const [categoryIdsToDelete, setCategoryIdsToDelete] = useState([])
    const [isClearUnusedCategoriesModalOpen, setIsClearUnusedCategoriesModalOpen] = useState(false)
    const localPageScrollRef = useRef(null)
    const pageScrollRef = sharedScrollRef || localPageScrollRef
    const loadingMoreRef = useRef(false)
    const transactionsQueryKeyRef = useRef("")
    const transactionsRequestIdRef = useRef(0)
    const transactionsRequestAbortRef = useRef(null)
    const summaryRequestIdRef = useRef(0)
    const summaryRequestAbortRef = useRef(null)
    const summaryRefreshTimeoutRef = useRef(null)
    const loadMoreRequestAbortRef = useRef(null)
    const lastScrollTopRef = useRef(0)
    const handledCompletedJobIdsRef = useRef(new Set())
    const activeSection = location.pathname.endsWith("/ledger/accounts")
        ? "accounts"
        : location.pathname.endsWith("/ledger/categories")
            ? "categories"
            : "ledger"
    const transactionsSearchTerm = transactionsQuery.searchTerm
    const transactionsFilters = transactionsQuery.filters
    const hasActiveTransactionsQuery = !isDefaultLedgerQuery(transactionsSearchTerm, transactionsFilters)

    const buildTransactionsQueryKey = useCallback((search, nextFilters) => JSON.stringify({
        clientId,
        search: String(search || ""),
        filters: normalizeTransactionsFilters(nextFilters),
    }), [clientId])

    const getTransactionsQueryOptions = useCallback((cursor = "") => ({
        paginationMode: "cursor",
        cursor,
        limit: TRANSACTIONS_PAGE_SIZE,
        search: transactionsSearchTerm,
        ...transactionsFilters,
    }), [transactionsFilters, transactionsSearchTerm])

    const refreshTransactionsSummary = useCallback(async (searchTerm = "", filters = {}) => {
        const requestId = ++summaryRequestIdRef.current
        summaryRequestAbortRef.current?.abort()

        if (!clientId) {
            setIsLoadingTransactionsSummary(false)
            setTransactionsSummary({
                totalAmount: 0,
                totalCount: 0,
            })
            return
        }

        const abortController = new AbortController()
        summaryRequestAbortRef.current = abortController
        setIsLoadingTransactionsSummary(true)

        try {
            const payload = await summarizeTransactionsByClientId(clientId, {
                ...buildTransactionsSummaryOptions(searchTerm, filters),
                silentLoading: true,
                signal: abortController.signal,
            })

            if (requestId !== summaryRequestIdRef.current) return
            setTransactionsSummary({
                totalAmount: Number(payload?.totalAmount || 0),
                totalCount: Number(payload?.totalCount || 0),
            })
        } catch (err) {
            if (err?.name === "AbortError") return
            if (requestId !== summaryRequestIdRef.current) return
            setTransactionsSummary({
                totalAmount: 0,
                totalCount: 0,
            })
        } finally {
            if (requestId === summaryRequestIdRef.current) {
                if (summaryRequestAbortRef.current === abortController) {
                    summaryRequestAbortRef.current = null
                }
                setIsLoadingTransactionsSummary(false)
            }
        }
    }, [clientId])

    const scheduleTransactionsSummaryRefresh = useCallback((searchTerm = "", filters = {}, delayMs = TRANSACTIONS_SUMMARY_REFRESH_DELAY_MS) => {
        if (summaryRefreshTimeoutRef.current) {
            clearTimeout(summaryRefreshTimeoutRef.current)
            summaryRefreshTimeoutRef.current = null
        }

        summaryRequestIdRef.current += 1
        summaryRequestAbortRef.current?.abort()
        summaryRequestAbortRef.current = null

        if (!clientId) {
            setIsLoadingTransactionsSummary(false)
            return
        }

        setIsLoadingTransactionsSummary(true)
        const scheduledRequestId = summaryRequestIdRef.current
        summaryRefreshTimeoutRef.current = setTimeout(() => {
            if (scheduledRequestId !== summaryRequestIdRef.current) return
            summaryRefreshTimeoutRef.current = null
            refreshTransactionsSummary(searchTerm, filters).catch(() => {})
        }, delayMs)
    }, [clientId, refreshTransactionsSummary])

    const cancelTransactionsSummaryRefresh = useCallback(() => {
        if (summaryRefreshTimeoutRef.current) {
            clearTimeout(summaryRefreshTimeoutRef.current)
            summaryRefreshTimeoutRef.current = null
        }
        summaryRequestIdRef.current += 1
        summaryRequestAbortRef.current?.abort()
        summaryRequestAbortRef.current = null
        setIsLoadingTransactionsSummary(false)
    }, [])

    useEffect(() => {
        return () => {
            if (summaryRefreshTimeoutRef.current) {
                clearTimeout(summaryRefreshTimeoutRef.current)
                summaryRefreshTimeoutRef.current = null
            }
            summaryRequestAbortRef.current?.abort()
        }
    }, [])

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

        const persisted = readPersistedLedgerState(clientId)
        const bootstrapQueryKey = buildTransactionsQueryKey(persisted.searchTerm, persisted.filters)
        const shouldUseDefaultLedgerCache = isDefaultLedgerQuery(persisted.searchTerm, persisted.filters)
        const cachedBootstrap = shouldUseDefaultLedgerCache ? getCachedClientLedgerBootstrap(clientId) : null

        if (cachedBootstrap) {
            hydrateLedgerBootstrapPayload(cachedBootstrap, {
                setClient,
                setAccounts,
                setCategoryList,
                setLedgerEntries,
                setTransactionsHasMore,
                setTransactionsNextCursor,
                setTransactionsPeriodOptions,
                setTransactionsSummary,
            })
            transactionsQueryKeyRef.current = bootstrapQueryKey
            setIsBaseDataLoaded(true)
        } else if (!transactionsQueryKeyRef.current) {
            transactionsQueryKeyRef.current = bootstrapQueryKey
        }

        getClientLedgerBootstrap(clientId, {
            ...persisted.filters,
            search: persisted.searchTerm,
            paginationMode: "cursor",
            limit: TRANSACTIONS_PAGE_SIZE,
            silentLoading: true,
            backgroundLoadingMessage: cachedBootstrap ? "Updating cached ledger data..." : "",
        })
            .then((payload) => {
                if (!active) return
                const canHydrateTransactions = transactionsQueryKeyRef.current === bootstrapQueryKey
                hydrateLedgerBootstrapPayload(payload, {
                    setClient,
                    setAccounts,
                    setCategoryList,
                    setLedgerEntries,
                    setTransactionsHasMore,
                    setTransactionsNextCursor,
                    setTransactionsPeriodOptions,
                    setTransactionsSummary,
                }, {
                    hydrateTransactions: canHydrateTransactions,
                    hydratePeriodOptions: canHydrateTransactions,
                })
                if (canHydrateTransactions) {
                    transactionsQueryKeyRef.current = bootstrapQueryKey
                    skipNextTransactionsFetchKeyRef.current = bootstrapQueryKey
                    skipNextPeriodOptionsFetchRef.current = Boolean(payload?.periodOptions)
                    hasLoadedPeriodOptionsRef.current = Boolean(payload?.periodOptions)
                }
                scheduleTransactionsSummaryRefresh(persisted.searchTerm, persisted.filters, 500)
                setIsBaseDataLoaded(true)
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load ledger data")
                setClient(null)
                setAccounts([])
                setCategoryList([])
                setLedgerEntries([])
                setTransactionsHasMore(false)
                setTransactionsNextCursor(null)
                setTransactionsPeriodOptions({ years: [], months: [] })
                setTransactionsSummary({
                    totalAmount: 0,
                    totalCount: 0,
                })
                setIsBaseDataLoaded(true)
            })

        return () => {
            active = false
        }
    }, [buildTransactionsQueryKey, clientId, error, scheduleTransactionsSummaryRefresh])

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
        setTransactionsQuery(buildAppliedTransactionsQuery(persisted.searchTerm, persisted.filters))
        setTransactionsNextCursor(null)
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

        setTransactionsQuery(buildAppliedTransactionsQuery(transactionsSearchTerm, {
            ...DEFAULT_TRANSACTIONS_FILTERS,
            categoryIds: matchedCategory?.id ? [matchedCategory.id] : [],
            includeUncategorizedIncome: lowerCategory === "uncategorized" || lowerCategory === "uncategorized income",
            includeUncategorizedExpenses: lowerCategory === "uncategorized" || lowerCategory === "uncategorized expenses",
        }))
        setHasAppliedPreselectedCategory(true)
    }, [
        transactionsSearchTerm,
        clientId,
        isBaseDataLoaded,
        hasAppliedPreselectedCategory,
        preselectedCategoryName,
        categoryList,
    ])

    useEffect(() => {
        let active = true

        if (!isBaseDataLoaded) {
            return () => {
                active = false
            }
        }

        if (!clientId) {
            setLedgerEntries([])
            setTransactionsHasMore(false)
            setTransactionsNextCursor(null)
            setTransactionsPeriodOptions({ years: [], months: [] })
            setTransactionsSummary({
                totalAmount: 0,
                totalCount: 0,
            })
            transactionsQueryKeyRef.current = ""
            setIsLoadingTransactions(false)
            return () => {
                active = false
            }
        }

        const requestId = ++transactionsRequestIdRef.current
        const currentQueryKey = buildTransactionsQueryKey(transactionsSearchTerm, transactionsFilters)
        transactionsQueryKeyRef.current = currentQueryKey

        if (skipNextTransactionsFetchKeyRef.current === currentQueryKey) {
            skipNextTransactionsFetchKeyRef.current = ""
            setIsLoadingTransactions(false)
            return () => {
                active = false
            }
        }
        skipNextTransactionsFetchKeyRef.current = ""

        transactionsRequestAbortRef.current?.abort()
        loadMoreRequestAbortRef.current?.abort()
        loadingMoreRef.current = false
        setIsLoadingMoreTransactions(false)
        const abortController = new AbortController()
        transactionsRequestAbortRef.current = abortController
        setIsLoadingTransactions(true)

        listTransactionsByClientId(clientId, {
            ...getTransactionsQueryOptions(),
            signal: abortController.signal,
        })
            .then((payload) => {
                if (!active || requestId !== transactionsRequestIdRef.current || transactionsQueryKeyRef.current !== currentQueryKey) return

                const items = Array.isArray(payload?.items) ? payload.items : []
                const mapped = items.map(mapTransaction)
                const nextCursor = String(payload?.nextCursor || "").trim()

                setLedgerEntries(mapped)
                setTransactionsHasMore(Boolean(payload?.hasMore && nextCursor))
                setTransactionsNextCursor(nextCursor || null)
                lastScrollTopRef.current = 0
                scheduleTransactionsSummaryRefresh(transactionsSearchTerm, transactionsFilters)
            })
            .catch((err) => {
                if (err?.name === "AbortError") return
                if (!active || requestId !== transactionsRequestIdRef.current || transactionsQueryKeyRef.current !== currentQueryKey) return
                error(err.message || "Failed to load transactions")
                setTransactionsHasMore(false)
                setTransactionsNextCursor(null)
            })
            .finally(() => {
                if (!active || requestId !== transactionsRequestIdRef.current || transactionsQueryKeyRef.current !== currentQueryKey) return
                if (transactionsRequestAbortRef.current === abortController) {
                    transactionsRequestAbortRef.current = null
                }
                setIsLoadingTransactions(false)
            })

        return () => {
            active = false
            abortController.abort()
            loadMoreRequestAbortRef.current?.abort()
            if (transactionsRequestAbortRef.current === abortController) {
                transactionsRequestAbortRef.current = null
            }
        }
    }, [
        buildTransactionsQueryKey,
        clientId,
        error,
        getTransactionsQueryOptions,
        isBaseDataLoaded,
        scheduleTransactionsSummaryRefresh,
        transactionsFilters,
        transactionsSearchTerm,
    ])

    const loadTransactionsPeriodOptions = useCallback(async () => {
        if (!clientId || hasLoadedPeriodOptionsRef.current) return
        if (skipNextPeriodOptionsFetchRef.current) {
            skipNextPeriodOptionsFetchRef.current = false
            hasLoadedPeriodOptionsRef.current = true
            return
        }

        try {
            const payload = await listTransactionPeriodOptions(clientId, { silentLoading: true })
            setTransactionsPeriodOptions({
                years: Array.isArray(payload?.years) ? payload.years : [],
                months: Array.isArray(payload?.months) ? payload.months : [],
            })
            hasLoadedPeriodOptionsRef.current = true
        } catch {
            setTransactionsPeriodOptions({ years: [], months: [] })
        }
    }, [clientId])

    const loadMoreTransactions = useCallback(async () => {
        if (!clientId || !transactionsHasMore || isLoadingTransactions) return
        if (loadingMoreRef.current) return

        try {
            loadingMoreRef.current = true
            setIsLoadingMoreTransactions(true)
            loadMoreRequestAbortRef.current?.abort()
            const abortController = new AbortController()
            loadMoreRequestAbortRef.current = abortController
            const currentQueryKey = transactionsQueryKeyRef.current
            const targetCursor = String(transactionsNextCursor || "").trim()
            if (!targetCursor) {
                setTransactionsHasMore(false)
                return
            }

            const payload = await listTransactionsByClientId(clientId, {
                ...getTransactionsQueryOptions(targetCursor),
                silentLoading: true,
                signal: abortController.signal,
            })

            if (transactionsQueryKeyRef.current !== currentQueryKey) {
                return
            }

            const items = Array.isArray(payload?.items) ? payload.items : []
            const mapped = items.map(mapTransaction)
            const nextCursor = String(payload?.nextCursor || "").trim()

            if (items.length === 0) {
                setTransactionsHasMore(false)
                setTransactionsNextCursor(null)
                return
            }

            setLedgerEntries((current) => [...current, ...mapped])
            setTransactionsHasMore(Boolean(payload?.hasMore && nextCursor))
            setTransactionsNextCursor(nextCursor || null)
        } catch (err) {
            if (err?.name === "AbortError") return
            error(err.message || "Failed to load more transactions")
        } finally {
            loadingMoreRef.current = false
            setIsLoadingMoreTransactions(false)
            loadMoreRequestAbortRef.current = null
        }
    }, [
        clientId,
        error,
        getTransactionsQueryOptions,
        isLoadingTransactions,
        transactionsHasMore,
        transactionsNextCursor,
    ])

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
        if (distanceToBottom <= TRANSACTIONS_LOAD_MORE_THRESHOLD_PX) {
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

    useEffect(() => {
        if (activeSection !== "ledger") return
        const container = pageScrollRef.current
        if (!container) return
        if (hasActiveTransactionsQuery) return
        if (!transactionsHasMore || isLoadingTransactions || isLoadingMoreTransactions) return
        if (loadingMoreRef.current) return

        const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
        if (distanceToBottom <= TRANSACTIONS_LOAD_MORE_THRESHOLD_PX) {
            loadMoreTransactions()
        }
    }, [
        activeSection,
        hasActiveTransactionsQuery,
        isLoadingMoreTransactions,
        isLoadingTransactions,
        ledgerEntries.length,
        loadMoreTransactions,
        pageScrollRef,
        transactionsHasMore,
    ])

    const handleApplyTransactionsFilters = (nextFilters = DEFAULT_TRANSACTIONS_FILTERS) => {
        const normalizedFilters = normalizeTransactionsFilters(nextFilters)
        const nextQuery = buildAppliedTransactionsQuery(transactionsSearchTerm, normalizedFilters)
        const nextQueryKey = buildTransactionsQueryKey(nextQuery.searchTerm, nextQuery.filters)
        const currentQueryKey = buildTransactionsQueryKey(transactionsSearchTerm, transactionsFilters)
        if (nextQueryKey === currentQueryKey) {
            return
        }

        transactionsRequestIdRef.current += 1
        transactionsQueryKeyRef.current = nextQueryKey
        loadingMoreRef.current = false
        transactionsRequestAbortRef.current?.abort()
        transactionsRequestAbortRef.current = null
        loadMoreRequestAbortRef.current?.abort()
        cancelTransactionsSummaryRefresh()
        if (isDefaultLedgerQuery(nextQuery.searchTerm, nextQuery.filters)) {
            const cachedBootstrap = getCachedClientLedgerBootstrap(clientId)
            if (cachedBootstrap) {
                hydrateLedgerBootstrapPayload(cachedBootstrap, {
                    setClient,
                    setAccounts,
                    setCategoryList,
                    setLedgerEntries,
                    setTransactionsHasMore,
                    setTransactionsNextCursor,
                    setTransactionsPeriodOptions,
                    setTransactionsSummary,
                })
            } else {
                setIsLoadingTransactions(true)
                setTransactionsHasMore(false)
                setTransactionsNextCursor(null)
            }
        } else {
            setIsLoadingTransactions(true)
            setTransactionsHasMore(false)
            setTransactionsNextCursor(null)
        }
        setIsLoadingMoreTransactions(false)
        lastScrollTopRef.current = 0
        pageScrollRef.current?.scrollTo({ top: 0 })
        setTransactionsQuery(nextQuery)
    }

    const handleTransactionsSearchTermChange = useCallback((nextSearchTerm = "") => {
        const nextQuery = buildAppliedTransactionsQuery(nextSearchTerm, transactionsFilters)
        const nextQueryKey = buildTransactionsQueryKey(nextQuery.searchTerm, nextQuery.filters)
        const currentQueryKey = buildTransactionsQueryKey(transactionsSearchTerm, transactionsFilters)
        if (nextQueryKey === currentQueryKey) {
            return
        }

        transactionsRequestIdRef.current += 1
        transactionsQueryKeyRef.current = nextQueryKey
        loadingMoreRef.current = false
        transactionsRequestAbortRef.current?.abort()
        transactionsRequestAbortRef.current = null
        loadMoreRequestAbortRef.current?.abort()
        cancelTransactionsSummaryRefresh()
        setIsLoadingTransactions(true)
        setTransactionsHasMore(false)
        setTransactionsNextCursor(null)
        setIsLoadingMoreTransactions(false)
        lastScrollTopRef.current = 0
        pageScrollRef.current?.scrollTo({ top: 0 })
        setTransactionsQuery(nextQuery)
    }, [buildTransactionsQueryKey, cancelTransactionsSummaryRefresh, pageScrollRef, transactionsFilters, transactionsSearchTerm])

    const handleUpdateTransaction = async (id, patch) => {
        let previousEntry = null

        try {
            setLedgerEntries((current) =>
                current.map((item) => {
                    if (item.id !== id) return item
                    previousEntry = item
                    return mergeLedgerEntryWithPatch(item, patch)
                })
            )

            const updated = await updateTransactionById(id, patch)
            const normalized = mapTransaction(updated)
            setLedgerEntries((current) =>
                current.map((item) => (item.id === id ? normalized : item))
            )
            if (patch?.date !== undefined) {
                listTransactionPeriodOptions(clientId, { silentLoading: true })
                    .then((periodOptions) => {
                        setTransactionsPeriodOptions({
                            years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                            months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
                        })
                    })
                    .catch(() => {})
            }
            emitDashboardRefresh("transaction-updated")
            success("Transaction updated successfully")
            return updated
        } catch (err) {
            if (previousEntry) {
                setLedgerEntries((current) =>
                    current.map((item) => (item.id === id ? previousEntry : item))
                )
            }
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

        const previousEntriesById = new Map()

        try {
            setLedgerEntries((current) =>
                current.map((entry) => {
                    const nextUpdate = safeUpdates.find((item) => item.id === entry.id)
                    if (!nextUpdate) return entry
                    previousEntriesById.set(entry.id, entry)
                    return mergeLedgerEntryWithPatch(entry, nextUpdate.patch)
                })
            )

            await updateTransactionsByIds(safeUpdates)

            const touchedDate = safeUpdates.some((item) => Object.prototype.hasOwnProperty.call(item.patch, "date"))
            if (touchedDate) {
                listTransactionPeriodOptions(clientId, { silentLoading: true })
                    .then((periodOptions) => {
                        setTransactionsPeriodOptions({
                            years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                            months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
                        })
                    })
                    .catch(() => {})
            }

            emitDashboardRefresh("transactions-batch-updated")
            success(
                safeUpdates.length === 1
                    ? "Transaction updated successfully"
                    : `${safeUpdates.length} transactions updated successfully`
            )
        } catch (err) {
            if (previousEntriesById.size > 0) {
                setLedgerEntries((current) =>
                    current.map((entry) => previousEntriesById.get(entry.id) || entry)
                )
            }
            error(err.message || "Failed to update transactions")
            throw err
        }
    }

    const handleDeleteTransaction = async (id) => {
        try {
            await deleteTransactionById(id)
            setLedgerEntries((current) => current.filter((item) => item.id !== id))
            listTransactionPeriodOptions(clientId, { silentLoading: true })
                .then((periodOptions) => {
                    setTransactionsPeriodOptions({
                        years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                        months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
                    })
                })
                .catch(() => {})
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
            listTransactionPeriodOptions(clientId, { silentLoading: true })
                .then((periodOptions) => {
                    setTransactionsPeriodOptions({
                        years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
                        months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
                    })
                })
                .catch(() => {})
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

    const handleImportTransactions = async (transactions, summary = null) => {
        const total = Array.isArray(transactions) ? transactions.length : 0
        if (total === 0) {
            throw new Error("No transactions to import")
        }
        const result = await startTransactionsImportJob({
            clientId,
            transactions,
            summary,
        })
        success(`Transactions import added to queue. Job ${result.jobId}`)
    }

    const refreshLedgerAfterCategorization = useCallback(async () => {
        if (!clientId) return

        const [categoriesData, payload] = await Promise.all([
            listCategoriesByClientId(clientId),
            listTransactionsByClientId(clientId, {
                ...getTransactionsQueryOptions(),
                silentLoading: true,
            }),
        ])

        const items = Array.isArray(payload?.items) ? payload.items : []
        const mapped = items.map(mapTransaction)
        const nextCursor = String(payload?.nextCursor || "").trim()

        setCategoryList(Array.isArray(categoriesData) ? categoriesData.map(mapCategory) : [])
        setLedgerEntries(mapped)
        setTransactionsHasMore(Boolean(payload?.hasMore && nextCursor))
        setTransactionsNextCursor(nextCursor || null)
        scheduleTransactionsSummaryRefresh(transactionsSearchTerm, transactionsFilters)
    }, [clientId, getTransactionsQueryOptions, scheduleTransactionsSummaryRefresh, transactionsFilters, transactionsSearchTerm])

    const refreshLedgerAfterImport = useCallback(async () => {
        if (!clientId) return

        const [payload, periodOptions] = await Promise.all([
            listTransactionsByClientId(clientId, {
                ...getTransactionsQueryOptions(),
                silentLoading: true,
            }),
            listTransactionPeriodOptions(clientId, { silentLoading: true }),
        ])

        const items = Array.isArray(payload?.items) ? payload.items : []
        const mapped = items.map(mapTransaction)
        const nextCursor = String(payload?.nextCursor || "").trim()

        setLedgerEntries(mapped)
        setTransactionsHasMore(Boolean(payload?.hasMore && nextCursor))
        setTransactionsNextCursor(nextCursor || null)
        setTransactionsPeriodOptions({
            years: Array.isArray(periodOptions?.years) ? periodOptions.years : [],
            months: Array.isArray(periodOptions?.months) ? periodOptions.months : [],
        })
        scheduleTransactionsSummaryRefresh(transactionsSearchTerm, transactionsFilters)
    }, [clientId, getTransactionsQueryOptions, scheduleTransactionsSummaryRefresh, transactionsFilters, transactionsSearchTerm])

    useEffect(() => {
        if (typeof window === "undefined") return undefined

        const handleTransactionsImportDone = (event) => {
            const eventClientId = String(event?.detail?.clientId || "").trim()
            if (!eventClientId || eventClientId !== String(clientId || "").trim()) return
            refreshLedgerAfterImport().catch(() => {})
        }

        window.addEventListener(TRANSACTIONS_IMPORT_DONE_EVENT, handleTransactionsImportDone)

        return () => {
            window.removeEventListener(TRANSACTIONS_IMPORT_DONE_EVENT, handleTransactionsImportDone)
        }
    }, [clientId, refreshLedgerAfterImport])

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
                tags: newCategoryTags,
            })

            setCategoryList((current) => [mapCategory(created), ...current])
            setNewCategoryName("")
            setNewCategoryType("")
            setNewCategoryDescription("")
            setNewCategoryTags([])
            setShowCategoryForm(false)
            success("Category created successfully")
            reloadTags()
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
                tags: input?.tags,
            })
            const mappedCategory = mapCategory(created)
            setCategoryList((current) => [mappedCategory, ...current])
            success("Category created successfully")
            reloadTags()
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
            reloadTags()
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
            await deleteAccountsByIds(targetIds)
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
            reloadTags()
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
            await deleteCategoriesByIds(targetIds)
            const targetSet = new Set(targetIds)
            setCategoryList((current) => current.filter((item) => !targetSet.has(item.id)))
            setCategoryIdsToDelete([])
            success(
                targetIds.length === 1
                    ? "Category deleted successfully"
                    : `${targetIds.length} categories deleted successfully`
            )
            reloadTags()
        } catch (err) {
            error(err.message || "Failed to delete selected categories")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClearUnusedCategories = async () => {
        if (!clientId) return

        try {
            setIsSubmitting(true)
            const result = await clearUnusedCategoriesByClientId(clientId)
            const deletedIds = Array.isArray(result?.deletedIds) ? result.deletedIds : []
            const deletedIdsSet = new Set(deletedIds)

            if (deletedIdsSet.size > 0) {
                setCategoryList((current) => current.filter((item) => !deletedIdsSet.has(item.id)))
            }

            setIsClearUnusedCategoriesModalOpen(false)

            if (Number(result?.deletedCount || 0) > 0) {
                success(
                    Number(result.deletedCount) === 1
                        ? "1 unused category deleted successfully"
                        : `${Number(result.deletedCount)} unused categories deleted successfully`
                )
            } else {
                success("No unused categories found")
            }
        } catch (err) {
            error(err.message || "Failed to clear unused categories")
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
                <Suspense fallback={<LedgerSectionFallback />}>
                    <LedgerHeader
                        clientName={client?.name || ""}
                    />
                </Suspense>

                <section className={`min-h-[460px] min-w-0 rounded-lg border border-gray-200 bg-white p-4 flex flex-col ${activeSection === "ledger" ? "overflow-visible" : "overflow-hidden"}`}>
                    {activeSection === "ledger" && (
                        <section className="min-h-0 min-w-0 h-full p-1 flex flex-col gap-3">
                            <div className="relative z-20 flex items-center justify-between bg-white">
                                <div>
                                    <h3 className="text-base font-bold">Transactions</h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {isLoadingTransactionsSummary ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" aria-hidden="true" />
                                                Loading summary...
                                            </span>
                                        ) : (
                                            <>
                                                {formatAccountSummaryLabel(accounts, transactionsFilters.accountIds)} · {formatCurrency(transactionsSummary.totalAmount)} · {transactionsSummary.totalCount.toLocaleString("en-US")} transaction(s)
                                            </>
                                        )}
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
                                <Suspense fallback={<LedgerSectionFallback className="h-full min-h-[320px]" />}>
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
                                        onOpenFilters={loadTransactionsPeriodOptions}
                                        onSearchTermChange={handleTransactionsSearchTermChange}
                                        onUpdateEntry={handleUpdateTransaction}
                                        onUpdateEntries={handleUpdateTransactionsBulk}
                                        onDeleteEntry={handleDeleteTransaction}
                                        onDeleteEntries={handleDeleteTransactionsBulk}
                                        onImportTransactions={handleImportTransactions}
                                        onCreateCategory={handleCreateCategoryFromTransaction}
                                        onOpenCreateAccount={() => setShowAccountForm(true)}
                                        overlayBoundaryRef={pageScrollRef}
                                        onCategorizeWithLlm={handleCategorizeWithLlmPreview}
                                        isCategorizingWithLlm={isCategorizingWithLlm}
                                        pendingLlmEntryIds={pendingLlmEntryIds}
                                        isLoading={isLoadingTransactions || !isBaseDataLoaded}
                                        isSearchDisabled={!isBaseDataLoaded}
                                        isLoadingMore={isLoadingMoreTransactions}
                                        showUploadModal={showUploadModal}
                                        onCloseUploadModal={() => setShowUploadModal(false)}
                                    />
                                </Suspense>
                            </div>
                        </section>
                    )}

                    {activeSection === "accounts" && (
                        <Suspense fallback={<LedgerSectionFallback className="h-full min-h-[320px]" />}>
                            <AccountsSection
                                accounts={accounts}
                                onCreate={() => setShowAccountForm(true)}
                                onSaveEdit={handleSaveAccountEdit}
                                onDelete={setAccountToDelete}
                                onDeleteMany={setAccountIdsToDelete}
                            />
                        </Suspense>
                    )}

                    {activeSection === "categories" && (
                        <Suspense fallback={<LedgerSectionFallback className="h-full min-h-[320px]" />}>
                            <CategoriesSection
                                categories={categoryList}
                                onCreate={() => setShowCategoryForm(true)}
                                onClearUnused={() => setIsClearUnusedCategoriesModalOpen(true)}
                                onSaveEdit={handleSaveCategoryEdit}
                                onDelete={setCategoryToDelete}
                                onDeleteMany={setCategoryIdsToDelete}
                                tagOptions={officeTags}
                                onDeleteTag={deleteTag}
                                deletingTag={deletingTag}
                            />
                        </Suspense>
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
                    <label className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <span>Tags</span>
                            <TagRulesHelp />
                        </span>
                        <TagsInput
                            value={newCategoryTags}
                            onChange={setNewCategoryTags}
                            options={officeTags}
                            placeholder="Add tags for this category"
                            onDeleteOption={deleteTag}
                            deletingOption={deletingTag}
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

            <ConfirmModal
                isOpen={isClearUnusedCategoriesModalOpen}
                title="Clear Unused Categories"
                message="This will delete all categories in this client that are not linked to any transaction or split."
                confirmLabel="Clear Unused"
                onConfirm={handleClearUnusedCategories}
                onClose={() => setIsClearUnusedCategoriesModalOpen(false)}
                isLoading={isSubmitting}
            />
        </section>
    )
}

export default LedgerPage
