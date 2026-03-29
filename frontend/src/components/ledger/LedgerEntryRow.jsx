function LedgerEntryRow({
    index,
    accounts,
    categories,
    id,
    accountId,
    date,
    description,
    account,
    category,
    amount,
    llmProcessed = false,
    llmStatus = "not_processed",
    llmProcessedAt = null,
    isSplit = false,
    splitCount = 0,
    isEditing = false,
    editingDraft = null,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onChangeDraft,
    onDelete,
    onSplit,
    isSplitting = false,
    isSavingSplit = false,
    onSaveSplit,
    onCancelSplit,
    onCategoryChange,
    isSelected = false,
    onToggleSelect,
    isMultiSelectionMode = false,
    isBatchEditing = false,
    editingTouched = {},
    isApplyingCategoryBulk = false,
}) {
    const shouldUseDraftDate = isEditing && (!isBatchEditing || editingTouched?.date)
    const shouldUseDraftAccount = isEditing && (!isBatchEditing || editingTouched?.accountId)
    const shouldUseDraftCategory = isEditing && (!isBatchEditing || editingTouched?.category)

    const currentDate = shouldUseDraftDate ? editingDraft?.date ?? date : date
    const currentDescription = isEditing && !isBatchEditing ? editingDraft?.description ?? description : description
    const currentAccountId = shouldUseDraftAccount ? editingDraft?.accountId ?? accountId : accountId
    const fallbackAccount = accounts.find((item) => item.name === account)
    const selectedAccountId = currentAccountId || fallbackAccount?.id || ""
    const currentCategory = shouldUseDraftCategory ? editingDraft?.category ?? category : category
    const currentAmount = isEditing && !isBatchEditing ? editingDraft?.amount ?? String(amount) : amount
    const isLlmProcessed =
        Boolean(llmProcessed) ||
        Boolean(llmProcessedAt) ||
        ["suggested", "empty", "error"].includes(String(llmStatus || "").toLowerCase())

    return (
        <div className={`grid grid-cols-[24px_minmax(110px,0.7fr)_minmax(180px,2fr)_minmax(120px,1fr)_minmax(160px,1.3fr)_16px_78px_92px] items-center gap-4 px-2 py-3 text-sm ${index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}`}>
            <input
                className="h-4 w-4 self-center m-0"
                type="checkbox"
                checked={Boolean(isSelected)}
                onChange={(e) => onToggleSelect?.(e.target.checked)}
            />
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

            {isEditing && !isBatchEditing ? (
                <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={currentDescription}
                    onChange={(e) => onChangeDraft({ description: e.target.value })}
                />
            ) : (
                <div className="flex items-center gap-2 min-w-0">
                    <h4 className="line-clamp-2">{currentDescription}</h4>
                </div>
            )}

            {isEditing ? (
                <div className="relative w-full">
                    <select
                        className="w-full rounded-full border-3 border-gray-100 bg-white p-2 pl-3 appearance-none"
                        value={selectedAccountId}
                        onChange={(e) => onChangeDraft({ accountId: e.target.value })}
                    >
                        <option value="">Select account</option>
                        {accounts.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
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
                <h4>{account || "No account"}</h4>
            )}

            {isSplit ? (
                <h4 className="text-xs font-semibold">
                    Split ({splitCount})
                </h4>
            ) : (
                <div className="relative w-full">
                    <select
                        className="w-full rounded-full border-3 border-gray-100 bg-white p-2 pl-3 appearance-none"
                        value={currentCategory || ""}
                        disabled={isApplyingCategoryBulk}
                        onChange={(e) => {
                            const nextCategory = e.target.value
                            if (isEditing) {
                                onChangeDraft({ category: nextCategory })
                                return
                            }
                            onCategoryChange?.(id, nextCategory)
                        }}
                    >
                        <option value="">Uncategorized</option>
                        <option value="Uncategorized income">Uncategorized income</option>
                        <option value="Uncategorized expenses">Uncategorized expenses</option>
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
            )}
            <div className="flex justify-center">
                {isLlmProcessed && (
                    <span
                        className="inline-flex items-center justify-center rounded-full bg-sky-100 p-1 text-sky-700"
                        title="Processed by LLM"
                        aria-label="Processed by LLM"
                    >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                    </span>
                )}
            </div>
            {isEditing && !isBatchEditing ? (
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
                {!isSplitting && (
                    <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                        title={isMultiSelectionMode ? "Edit selected: date/account/category only" : "Edit transaction"}
                        aria-label="Edit transaction"
                        onClick={() => {
                            if (isEditing) {
                                onSaveEdit?.()
                                return
                            }
                            onStartEdit?.()
                        }}
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
                )}

                {!isEditing && (
                    <>
                        {isSplitting ? (
                            <>
                                <button
                                    type="button"
                                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-emerald-700 disabled:opacity-50"
                                    title="Save split"
                                    aria-label="Save split"
                                    disabled={isSavingSplit}
                                    onClick={() => onSaveSplit?.()}
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50"
                                    title="Cancel split"
                                    aria-label="Cancel split"
                                    disabled={isSavingSplit}
                                    onClick={() => onCancelSplit?.()}
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                    </svg>
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className={`rounded-md p-1 ${isMultiSelectionMode ? "cursor-not-allowed text-gray-300" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"}`}
                                title="Split transaction"
                                aria-label="Split transaction"
                                disabled={isMultiSelectionMode}
                                onClick={() => {
                                    if (isMultiSelectionMode) return
                                    onSplit?.()
                                }}
                            >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 7h9" />
                                    <path d="M13 7l-2-2m2 2-2 2" />
                                    <path d="M20 17h-9" />
                                    <path d="M11 17l2-2m-2 2 2 2" />
                                </svg>
                            </button>
                        )}
                    </>
                )}

                {!isEditing && !isSplitting && (
                    <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                        title="Delete transaction"
                        aria-label="Delete transaction"
                        onClick={() => onDelete?.(id)}
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                        </svg>
                    </button>
                )}

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
