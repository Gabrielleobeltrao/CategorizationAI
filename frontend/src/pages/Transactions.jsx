import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import AccordionCategory from "../components/categories/AccordionCategory"
import TransactionsTable from "../components/transactions/TransactionsTable"
import { getCategoriesByClientId } from "../mocks/categories.mock"
import { getTransactionsByClientId } from "../mocks/transactions.mock"

function Transactions() {
    const [searchParams] = useSearchParams()
    const clientId = searchParams.get("clientId")

    const categories = useMemo(() => {
        if (!clientId) return []
        return getCategoriesByClientId(clientId)
    }, [clientId])

    const transactions = useMemo(() => {
        if (!clientId) return []
        return getTransactionsByClientId(clientId)
    }, [clientId])

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
            <div className="h-full w-full col-span-2 p-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Categories</h2>
                    <button className="text-sm font-bold text-white bg-gray-400 rounded-md px-4 py-2">
                        New Category
                    </button>
                </div>
                {categories.length > 0 ? (
                <div className="flex flex-col gap-4">
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
            </div>
        </section>
    )
}

export default Transactions
