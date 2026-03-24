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
    updateTransactionById,
    deleteTransactionById,
} from "../services/transactions.service"
import { useNotification } from "../contexts/notification.context"

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
        date: item?.date || "",
        description: item?.description || "",
        account: item?.accountName || item?.account || "",
        category: item?.category || "",
        amount: Number(item?.amount || 0),
    }
}

function LedgerPage() {
    const { clientId: routeClientId } = useParams()
    const [searchParams] = useSearchParams()
    const clientId = routeClientId || searchParams.get("clientId")
    const { success, error } = useNotification()

    const [activeSection, setActiveSection] = useState("ledger")
    const [client, setClient] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [categoryList, setCategoryList] = useState([])
    const [ledgerEntries, setLedgerEntries] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [transactionsPage, setTransactionsPage] = useState(1)
    const [transactionsHasMore, setTransactionsHasMore] = useState(false)
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
    const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = useState(false)
    const [transactionsSearchTerm, setTransactionsSearchTerm] = useState("")

    const [showAccountForm, setShowAccountForm] = useState(false)
    const [showCategoryForm, setShowCategoryForm] = useState(false)
    const [showEditAccountForm, setShowEditAccountForm] = useState(false)
    const [showEditCategoryForm, setShowEditCategoryForm] = useState(false)

    const [newAccountName, setNewAccountName] = useState("")
    const [newAccountType, setNewAccountType] = useState("")

    const [newCategoryName, setNewCategoryName] = useState("")
    const [newCategoryType, setNewCategoryType] = useState("")
    const [newCategoryDescription, setNewCategoryDescription] = useState("")

    const [editingAccountId, setEditingAccountId] = useState("")
    const [editingAccountName, setEditingAccountName] = useState("")
    const [editingAccountType, setEditingAccountType] = useState("")

    const [editingCategoryId, setEditingCategoryId] = useState("")
    const [editingCategoryName, setEditingCategoryName] = useState("")
    const [editingCategoryType, setEditingCategoryType] = useState("")
    const [editingCategoryDescription, setEditingCategoryDescription] = useState("")

    const [accountToDelete, setAccountToDelete] = useState(null)
    const [categoryToDelete, setCategoryToDelete] = useState(null)
    const pageScrollRef = useRef(null)
    const loadingMoreRef = useRef(false)
    const pageRef = useRef(1)
    const lastScrollTopRef = useRef(0)

    useEffect(() => {
        let active = true

        if (!clientId) {
            setClient(null)
            setAccounts([])
            setCategoryList([])
            setLedgerEntries([])
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
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load ledger data")
                setClient(null)
                setAccounts([])
                setCategoryList([])
            })

        return () => {
            active = false
        }
    }, [clientId])

    useEffect(() => {
        let active = true

        if (!clientId) {
            setLedgerEntries([])
            setTransactionsPage(1)
            setTransactionsHasMore(false)
            pageRef.current = 1
            lastScrollTopRef.current = 0
            return () => {
                active = false
            }
        }

        setIsLoadingTransactions(true)

        listTransactionsByClientId(clientId, {
            page: 1,
            limit: 30,
            search: transactionsSearchTerm,
        })
            .then((payload) => {
                if (!active) return
                const items = Array.isArray(payload?.items) ? payload.items : []
                const mapped = items.map(mapTransaction)
                const page = Number(payload?.page || 1)
                const totalPages = Number(payload?.totalPages || 1)

                setLedgerEntries(mapped)
                setTransactionsPage(page)
                setTransactionsHasMore(page < totalPages)
                pageRef.current = page
                lastScrollTopRef.current = 0
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load transactions")
                setLedgerEntries([])
                setTransactionsPage(1)
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
    }, [clientId, transactionsSearchTerm])

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
            setTransactionsPage(page)
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

    const handleUpdateTransaction = async (id, patch) => {
        try {
            const updated = await updateTransactionById(id, patch)
            const normalized = mapTransaction(updated)
            setLedgerEntries((current) =>
                current.map((item) => (item.id === id ? normalized : item))
            )
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
            success("Transaction deleted successfully")
        } catch (err) {
            error(err.message || "Failed to delete transaction")
            throw err
        }
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

    const startEditAccount = (account) => {
        setEditingAccountId(account.id)
        setEditingAccountName(account.name || "")
        setEditingAccountType(account.type || "")
        setShowEditAccountForm(true)
    }

    const handleEditAccount = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            const updated = await updateAccountById(editingAccountId, {
                name: editingAccountName,
                type: editingAccountType,
            })

            setAccounts((current) =>
                current.map((item) => (item.id === editingAccountId ? mapAccount(updated) : item))
            )
            setShowEditAccountForm(false)
            setEditingAccountId("")
            success("Account updated successfully")
        } catch (err) {
            error(err.message || "Failed to update account")
        } finally {
            setIsSubmitting(false)
        }
    }

    const startEditCategory = (category) => {
        setEditingCategoryId(category.id)
        setEditingCategoryName(category.name || "")
        setEditingCategoryType(category.type || "")
        setEditingCategoryDescription(category.description || "")
        setShowEditCategoryForm(true)
    }

    const handleEditCategory = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            const updated = await updateCategoryById(editingCategoryId, {
                name: editingCategoryName,
                type: editingCategoryType,
                description: editingCategoryDescription,
            })

            setCategoryList((current) =>
                current.map((item) => (item.id === editingCategoryId ? mapCategory(updated) : item))
            )
            setShowEditCategoryForm(false)
            setEditingCategoryId("")
            success("Category updated successfully")
        } catch (err) {
            error(err.message || "Failed to update category")
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
                            </div>
                            <div className="min-h-0 flex-1">
                                <LedgerEntriesTable
                                    ledgerEntries={ledgerEntries}
                                    categories={categoryList}
                                    searchTerm={transactionsSearchTerm}
                                    onSearchTermChange={setTransactionsSearchTerm}
                                    onUpdateEntry={handleUpdateTransaction}
                                    onDeleteEntry={handleDeleteTransaction}
                                    isLoading={isLoadingTransactions}
                                    isLoadingMore={isLoadingMoreTransactions}
                                />
                            </div>
                        </section>
                    )}

                    {activeSection === "accounts" && (
                        <AccountsSection
                            accounts={accounts}
                            onCreate={() => setShowAccountForm(true)}
                            onEdit={startEditAccount}
                            onDelete={setAccountToDelete}
                        />
                    )}

                    {activeSection === "categories" && (
                        <CategoriesSection
                            categories={categoryList}
                            onCreate={() => setShowCategoryForm(true)}
                            onEdit={startEditCategory}
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
                isOpen={showEditAccountForm}
                title="Edit Account"
                onClose={() => setShowEditAccountForm(false)}
            >
                <form className="flex flex-col gap-2" onSubmit={handleEditAccount}>
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Account name"
                        value={editingAccountName}
                        onChange={(e) => setEditingAccountName(e.target.value)}
                    />
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Type"
                        value={editingAccountType}
                        onChange={(e) => setEditingAccountType(e.target.value)}
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

            <PopupModal
                isOpen={showEditCategoryForm}
                title="Edit Category"
                onClose={() => setShowEditCategoryForm(false)}
            >
                <form className="flex flex-col gap-2" onSubmit={handleEditCategory}>
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Category name"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                    />
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Type"
                        value={editingCategoryType}
                        onChange={(e) => setEditingCategoryType(e.target.value)}
                    />
                    <input
                        className="border-2 border-gray-100 rounded-md px-3 py-2 placeholder:text-black"
                        type="text"
                        placeholder="Description"
                        value={editingCategoryDescription}
                        onChange={(e) => setEditingCategoryDescription(e.target.value)}
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
