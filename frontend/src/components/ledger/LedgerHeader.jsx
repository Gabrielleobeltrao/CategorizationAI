function LedgerHeader({ clientName, activeSection, onChangeSection }) {
    return (
        <header className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Ledger</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {clientName || "Unknown client"}
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
                                onClick={() => onChangeSection(item.value)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    )
}

export default LedgerHeader
