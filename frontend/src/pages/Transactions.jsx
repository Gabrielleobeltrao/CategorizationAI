import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import TransactionsTable from "../components/transactions/TransactionsTable"
import PopupModal from "../components/ui/PopupModal"
import { getCategoriesByClientId } from "../mocks/categories.mock"
import { getTransactionsByClientId } from "../mocks/transactions.mock"
import { getAccountsByClientId } from "../mocks/accounts.mock"

function Transactions() {
    const [searchParams] = useSearchParams()
    const clientId = searchParams.get("clientId")
    const [viewMode, setViewMode] = useState("transactions")
    const [showAccountForm, setShowAccountForm] = useState(false)
    const [showCategoryForm, setShowCategoryForm] = useState(false)
    const [newAccountName, setNewAccountName] = useState("")
    const [newAccountType, setNewAccountType] = useState("")
    const [newCategoryName, setNewCategoryName] = useState("")
    const [newCategoryType, setNewCategoryType] = useState("")
    const [newCategoryDescription, setNewCategoryDescription] = useState("")
    const [accounts, setAccounts] = useState([])
    const [categoryList, setCategoryList] = useState([])

    const categoriesFromMocks = useMemo(() => {
        if (!clientId) return []
        return getCategoriesByClientId(clientId)
    }, [clientId])

    const transactions = useMemo(() => {
        if (!clientId) return []
        return getTransactionsByClientId(clientId)
    }, [clientId])

    const accountsFromMocks = useMemo(() => {
        if (!clientId) return []
        return getAccountsByClientId(clientId)
    }, [clientId])

    useEffect(() => {
        setAccounts(accountsFromMocks)
    }, [accountsFromMocks])

    useEffect(() => {
        setCategoryList(categoriesFromMocks)
    }, [categoriesFromMocks])

    const handleCreateAccount = (e) => {
        e.preventDefault()

        const payload = {
            clientId,
            name: newAccountName,
            type: newAccountType,
        }

        console.log(payload)

        setAccounts((current) => [
            ...current,
            {
                id: `${Date.now()}`,
                name: newAccountName,
                type: newAccountType,
            },
        ])

        setNewAccountName("")
        setNewAccountType("")
        setShowAccountForm(false)
    }

    const handleCreateCategory = (e) => {
        e.preventDefault()

        const payload = {
            clientId,
            name: newCategoryName,
            type: newCategoryType,
            description: newCategoryDescription,
        }

        console.log(payload)

        setCategoryList((current) => [
            ...current,
            {
                id: `${Date.now()}`,
                clientId,
                name: newCategoryName,
                type: newCategoryType,
                description: newCategoryDescription,
            },
        ])

        setNewCategoryName("")
        setNewCategoryType("")
        setNewCategoryDescription("")
        setShowCategoryForm(false)
    }

    const isTransactionsExpanded = viewMode === "transactions"
    const isDetailsExpanded = viewMode === "details"

    const transactionsSectionClass = isTransactionsExpanded ? "flex-1" : "h-12 flex-none"
    const detailsSectionClass = isDetailsExpanded ? "flex-1" : "h-12 flex-none"

    return (
        <section className="w-full h-full min-h-0 box-border p-4 overflow-hidden">
            <div className="h-full min-h-0 flex flex-col gap-3">
                <section className={`${transactionsSectionClass} min-h-0 rounded-lg border border-gray-200 bg-white ${isTransactionsExpanded ? "p-4" : "px-4 py-2"} flex flex-col overflow-hidden`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Transactions</h2>
                    </div>
                    {!isDetailsExpanded && (
                        <div className="pt-4 min-h-0 flex-1">
                            {transactions.length > 0 ? (
                                <TransactionsTable
                                    transactions={transactions}
                                    categories={categoryList}
                                />
                            ) : (
                                <h4 className="text-center text-gray-500">No transactions found. Please upload your transactions to get started.</h4>
                            )}
                        </div>
                    )}
                </section>

                <section className={`${detailsSectionClass} min-h-0 rounded-lg border border-gray-200 bg-white ${isDetailsExpanded ? "p-4" : "px-4 py-2"} flex flex-col overflow-hidden`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Accounts & Categories</h2>
                        <button
                            type="button"
                            className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                            onClick={() => setViewMode(isDetailsExpanded ? "transactions" : "details")}
                            title={isDetailsExpanded ? "Show transactions" : "Show accounts and categories"}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d={isDetailsExpanded ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
                            </svg>
                        </button>
                    </div>

                    {!isTransactionsExpanded && (
                        <div className="mt-4 grid h-full min-h-0 gap-4 md:grid-cols-2">
                            <section className="min-h-0 rounded-lg border border-gray-100 p-3 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-bold">Accounts</h3>
                                    <button
                                        className="text-xs font-bold text-white bg-gray-700 rounded-md px-3 py-2"
                                        onClick={() => setShowAccountForm(true)}
                                    >
                                        New Account
                                    </button>
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2">
                                    {accounts.map((account) => (
                                        <article key={account.id} className="border border-gray-100 rounded-md p-2">
                                            <h3 className="text-sm font-semibold truncate">{account.name}</h3>
                                            <p className="text-xs text-gray-500">{account.type}</p>
                                        </article>
                                    ))}
                                </div>
                            </section>

                            <section className="min-h-0 rounded-lg border border-gray-100 p-3 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-bold">Categories</h3>
                                    <button
                                        className="text-xs font-bold text-white bg-gray-700 rounded-md px-3 py-2"
                                        onClick={() => setShowCategoryForm(true)}
                                    >
                                        New Category
                                    </button>
                                </div>
                                {categoryList.length > 0 ? (
                                    <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3">
                                        {categoryList.map((category) => (
                                            <article key={category.id} className="border border-gray-100 rounded-md p-2">
                                                <h3 className="text-sm font-semibold truncate">{category.name}</h3>
                                                <p className="text-xs text-gray-500">{category.type}</p>
                                                <p className="text-xs text-gray-400 truncate">{category.description}</p>
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <h4 className="text-center text-gray-500">No categories found. Please add categories.</h4>
                                )}
                            </section>
                        </div>
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
                    <button className="bg-gray-100 rounded-md p-2" type="submit">
                        Save
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
                    <button className="bg-gray-100 rounded-md p-2" type="submit">
                        Save
                    </button>
                </form>
            </PopupModal>
        </section>
    )
}

export default Transactions
