function LedgerEntryRow({
    index,
    categories,
    id,
    date,
    description,
    account,
    category,
    amount,
    isEditing = false,
    editingDraft = null,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onChangeDraft,
}) {
    const currentDate = isEditing ? editingDraft?.date ?? date : date
    const currentDescription = isEditing ? editingDraft?.description ?? description : description
    const currentAccount = isEditing ? editingDraft?.account ?? account : account
    const currentCategory = isEditing ? editingDraft?.category ?? category : category
    const currentAmount = isEditing ? editingDraft?.amount ?? String(amount) : amount

    return (
        <div className={`grid grid-cols-[24px_minmax(110px,0.7fr)_minmax(180px,2fr)_minmax(120px,1fr)_minmax(160px,1.3fr)_100px_96px] items-center gap-4 px-2 py-3 text-sm ${index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}`}>
            <input className="h-4 w-4 self-center m-0" type="checkbox" />
            {isEditing ? (
                <input
                    type="date"
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={currentDate}
                    onChange={(e) => onChangeDraft({ date: e.target.value })}
                />
            ) : (
                <h4 className="whitespace-nowrap">{String(currentDate).split("-").reverse().join("/")}</h4>
            )}

            {isEditing ? (
                <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={currentDescription}
                    onChange={(e) => onChangeDraft({ description: e.target.value })}
                />
            ) : (
                <h4 className="line-clamp-2">{currentDescription}</h4>
            )}

            {isEditing ? (
                <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={currentAccount}
                    onChange={(e) => onChangeDraft({ account: e.target.value })}
                />
            ) : (
                <h4>{currentAccount}</h4>
            )}
            {isEditing ? (
                <div className="relative w-full">
                    <select
                        className="w-full rounded-full border-3 border-gray-100 bg-white p-2 pl-3 appearance-none"
                        value={currentCategory}
                        onChange={(e) => onChangeDraft({ category: e.target.value })}
                    >
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                                {c.name}
                            </option>
                        ))}
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
            ) : (
                <h4>{currentCategory || "Uncategorized"}</h4>
            )}
            {isEditing ? (
                <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-right text-sm"
                    value={currentAmount}
                    onChange={(e) => onChangeDraft({ amount: e.target.value })}
                />
            ) : (
                <h4 className="text-right">${Number(currentAmount).toFixed(2)}</h4>
            )}
            <div className="flex items-center justify-end gap-1">
                {!isEditing && (
                    <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                        title="Delete transaction"
                        aria-label="Delete transaction"
                        onClick={() => console.log("Delete transaction", id)}
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                        </svg>
                    </button>
                )}

                {!isEditing && (
                    <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                        title="Split transaction"
                        aria-label="Split transaction"
                        onClick={() => console.log("Split transaction", id)}
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 7h9" />
                            <path d="M13 7l-2-2m2 2-2 2" />
                            <path d="M20 17h-9" />
                            <path d="M11 17l2-2m-2 2 2 2" />
                        </svg>
                    </button>
                )}

                <button
                    type="button"
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                    title="Edit transaction"
                    aria-label="Edit transaction"
                    onClick={isEditing ? onSaveEdit : onStartEdit}
                >
                    {isEditing ? (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                        </svg>
                    )}
                </button>

                {isEditing && (
                    <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                        title="Cancel edit"
                        aria-label="Cancel edit"
                        onClick={onCancelEdit}
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}

export default LedgerEntryRow
