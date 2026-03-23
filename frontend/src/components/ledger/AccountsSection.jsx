function AccountsSection({ accounts, onCreate, onEdit, onDelete }) {
    return (
        <section className="min-h-0 h-full p-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Accounts</h3>
                <button
                    className="text-xs font-bold text-white bg-gray-700 rounded-md px-3 py-2"
                    onClick={onCreate}
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
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold truncate">{account.name}</h3>
                                <p className="text-xs text-gray-500">{account.type}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                    onClick={() => onEdit(account)}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                    onClick={() => onDelete(account)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
                {accounts.length === 0 && (
                    <h4 className="text-center text-gray-500">No accounts found. Please add accounts.</h4>
                )}
            </div>
        </section>
    )
}

export default AccountsSection
