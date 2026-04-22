function LedgerHeader({ clientName }) {
    return (
        <header className="rounded-xl border border-gray-200 bg-white p-4">
            <div>
                <h1 className="text-3xl font-bold">Ledger</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {clientName || "Unknown client"}
                </p>
            </div>
        </header>
    )
}

export default LedgerHeader
