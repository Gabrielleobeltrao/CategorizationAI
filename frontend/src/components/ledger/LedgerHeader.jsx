function LedgerHeader({ clientName }) {
    return (
        <header>
            <h1 className="text-3xl font-bold">Ledger</h1>
            <p className="text-sm text-gray-500 mt-1">
                {clientName || "Unknown client"}
            </p>
        </header>
    )
}

export default LedgerHeader
