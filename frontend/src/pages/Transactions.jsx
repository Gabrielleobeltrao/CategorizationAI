import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import AccordionCategory from "../components/categories/AccordionCategory"
import TransactionsTable from "../components/transactions/TransactionsTable"
import { getCategoriesByClientId } from "../mocks/categories.mock"
import { getTransactionsByClientId } from "../mocks/transactions.mock"
import { getAccountsByClientId } from "../mocks/accounts.mock"

function Transactions() {
    const [searchParams] = useSearchParams()
    const clientId = searchParams.get("clientId")
    const [showAccountForm, setShowAccountForm] = useState(false)
    const [newAccountName, setNewAccountName] = useState("")
    const [newAccountType, setNewAccountType] = useState("")
    const [accounts, setAccounts] = useState([])

    const categories = useMemo(() => {
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

    return (
        <section className="h-screen box-border grid grid-cols-8 p-4 overflow-hidden">
            <div className="h-full min-h-0 w-full col-span-6 p-4 border-r-4 border-gray-200 flex flex-col">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Transactions</h2>
                    <button className="text-sm font-bold text-white bg-gray-400 rounded-md px-4 py-2">
                        Upload Transactions
                    </button>
                </div>
                <div className="pt-8 min-h-0 flex-1">
                    {transactions.length > 0 ? (
                        <TransactionsTable
                            transactions={transactions}
                            categories={categories}
                        />
                    ) : (
                        <h4 className="text-center text-gray-500">No transactions found. Please upload your transactions to get started.</h4>
                    )}
                </div>
            </div>
            <div className="h-full w-full col-span-2 p-4 flex flex-col min-h-0">
                <section className="flex-1 min-h-0 p-3 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Accounts</h2>
                        <button
                            className="text-sm font-bold text-white bg-gray-400 rounded-md px-4 py-2"
                            onClick={() => setShowAccountForm((value) => !value)}
                        >
                            New Account
                        </button>
                    </div>

                    {showAccountForm && (
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
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2">
                        {accounts.map((account) => (
                            <article key={account.id} className="border border-gray-100 rounded-md p-2">
                                <h3 className="text-sm font-semibold">{account.name}</h3>
                                <p className="text-xs text-gray-500">{account.type}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="flex-1 min-h-0 p-3 flex flex-col gap-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Categories</h2>
                        <button className="text-sm font-bold text-white bg-gray-400 rounded-md px-4 py-2">
                            New Category
                        </button>
                    </div>
                    {categories.length > 0 ? (
                    <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4">
                        {categories.map((category) => (
                            <AccordionCategory
                                key={category.id}
                                id={category.id}
                                name={category.name}
                                type={category.type}
                                description={category.description}
                            />
                        ))}
                    </div>
                    ) : (
                        <h4 className="text-center text-gray-500">No categories found. Please add categories.</h4>
                    )}
                </section>
            </div>
        </section>
    )
}

export default Transactions
