function LedgerHeader({ clientName }) {
    return (
        <header className="rounded-xl border border-gray-200 bg-white p-4">
            <div>
                <h1 className="text-xl font-semibold">{clientName || "Unknown client"}</h1>
            </div>
        </header>
    )
}

export default LedgerHeader
