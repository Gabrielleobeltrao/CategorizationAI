import TransactionRow from "./TransactionRow"

function TransactionsTable({ transactions }) {
    return (
        <div className="flex flex-col h-full min-h-0">
            {/* <div className="pb-6">
                <div className="relative w-full">
                    <select className="w-full p-2 pl-3 rounded-full border-3 border-gray-100 appearance-none">
                        <option value="all accounts" >All Accounts</option>
                        <option value="account1">Account 1</option>
                        <option value="account2">Account 2</option>
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
            </div> */}
            <div className="grid grid-cols-[0.5fr_1fr] bg-gray-200 p-3 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <input type="checkbox" />
                    <h4>Select All</h4>
                </div>
                <div className="grid grid-cols-[1fr_min-content_min-content] gap-4">
                    <div className="relative w-full">
                        <input type="text"
                            placeholder="Search"
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
                    <div className="flex items-center gap-2">
                        <input type="checkbox" />
                        <h4>uncategorized</h4>
                    </div>
                    <button className="w-full flex items-center gap-0.5">
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M4 7H20M7 12H17M11 17H13"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <h4>Filter</h4>
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-[min-content_0.5fr_2fr_0.75fr_1.5fr_0.5fr]  gap-4 px-2 py-3 font-semibold">
                <input
                    className="opacity-0 pointer-events-none"
                    type="checkbox"
                    aria-hidden="true"
                    tabIndex={-1}
                />
                <h4>Date</h4>
                <h4>Description</h4>
                <h4>Account</h4>
                <h4>Category</h4>
                <h4>Amount</h4>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-b-lg border-b-4 border-gray-100">
                {transactions.map((transaction, index) => (
                    <TransactionRow
                        key={transaction.id}
                        index={index}
                        id={transaction.id}
                        date={transaction.date}
                        description={transaction.description}
                        account={transaction.account}
                        category={transaction.category}
                        amount={transaction.amount}
                    />
                ))}
            </div>
        </div>
    )
}

export default TransactionsTable