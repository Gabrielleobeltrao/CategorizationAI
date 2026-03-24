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
                                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                    onClick={() => onEdit(account)}
                                    title="Edit account"
                                    aria-label="Edit account"
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                                    onClick={() => onDelete(account)}
                                    title="Delete account"
                                    aria-label="Delete account"
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M8 6V4h8v2" />
                                        <path d="M19 6l-1 14H6L5 6" />
                                        <path d="M10 11v6M14 11v6" />
                                    </svg>
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
