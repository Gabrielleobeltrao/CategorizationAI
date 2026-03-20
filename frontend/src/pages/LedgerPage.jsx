import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import LedgerEntriesTable from "../components/ledger/LedgerEntriesTable"
import PopupModal from "../components/ui/PopupModal"
import { getCategoriesByClientId } from "../mocks/categories.mock"
import { getLedgerEntriesByClientId } from "../mocks/ledgerEntries.mock"
import { getAccountsByClientId } from "../mocks/accounts.mock"
import { getClientById } from "../mocks/clients.mock"

function LedgerPage() {
    const { clientId: routeClientId } = useParams()
    const [searchParams] = useSearchParams()
    const clientId = routeClientId || searchParams.get("clientId")
    const [activeSection, setActiveSection] = useState("ledger")
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

    const ledgerEntries = useMemo(() => {
        if (!clientId) return []
        return getLedgerEntriesByClientId(clientId)
    }, [clientId])

    const accountsFromMocks = useMemo(() => {
        if (!clientId) return []
        return getAccountsByClientId(clientId)
    }, [clientId])

    const client = useMemo(() => {
        if (!clientId) return null
        return getClientById(clientId)
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

    return (
        <section className="w-full h-full min-h-0 box-border p-4 overflow-y-auto">
            <div className="min-h-full flex flex-col gap-4 pb-4">
                <header className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">Ledger</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {client ? client.name : "Unknown client"}
                            </p>
                        </div>

                        <div className="w-full md:w-1/2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                View Filter
                            </label>
                            <div className="grid grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-white p-1">
                                {[
                                    { value: "ledger", label: "Transactions" },
                                    { value: "accounts", label: "Accounts" },
                                    { value: "categories", label: "Categories" },
                                ].map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
                                            activeSection === item.value
                                                ? "bg-gray-900 text-white"
                                                : "text-gray-600 hover:bg-gray-100"
                                        }`}
                                        onClick={() => setActiveSection(item.value)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

                <section className="min-h-[460px] rounded-lg border border-gray-200 bg-white p-4 flex flex-col overflow-hidden">
                    {activeSection === "ledger" && (
                        <>
                            <h2 className="text-lg font-bold">Transactions</h2>
                            <div className="pt-4 min-h-0 flex-1">
                                {ledgerEntries.length > 0 ? (
                                    <LedgerEntriesTable
                                        ledgerEntries={ledgerEntries}
                                        categories={categoryList}
                                    />
                                ) : (
                                    <h4 className="text-center text-gray-500">No transactions found.</h4>
                                )}
                            </div>
                        </>
                    )}

                    {activeSection === "accounts" && (
                        <section className="min-h-0 h-full p-1 flex flex-col gap-3">
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
                                {accounts.map((account, index) => (
                                    <article
                                        key={account.id}
                                        className={`border border-gray-100 rounded-md p-2 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                                    >
                                        <h3 className="text-sm font-semibold truncate">{account.name}</h3>
                                        <p className="text-xs text-gray-500">{account.type}</p>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeSection === "categories" && (
                        <section className="min-h-0 h-full p-1 flex flex-col gap-3">
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
                                    {categoryList.map((category, index) => (
                                        <article
                                            key={category.id}
                                            className={`border border-gray-100 rounded-md p-2 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                                        >
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

export default LedgerPage
