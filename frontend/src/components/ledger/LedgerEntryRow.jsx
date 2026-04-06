import { getTransactionAmountPresentation } from "../../utils/amountPresentation"
import { getCategoryDisplayName } from "../../utils/categoryPresentation"

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
    categorizedSource = "",
    isLlmProcessing = false,
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
    onOpenCategoryPicker,
    isSelected = false,
    onToggleSelect,
    isMultiSelectionMode = false,
    isBatchEditing = false,
    editingTouched = {},
    isApplyingCategoryBulk = false,
    isCategoryPickerOpen = false,
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
    const amountPresentation = getTransactionAmountPresentation({
        amount: currentAmount,
        category: currentCategory,
    })
    const isLlmProcessed =
        Boolean(llmProcessed) ||
        Boolean(llmProcessedAt) ||
        ["suggested", "empty", "error"].includes(String(llmStatus || "").toLowerCase())
    const normalizedCategorizedSource = String(categorizedSource || "").trim().toLowerCase()
    const iconMode = normalizedCategorizedSource === "memory"
        ? "memory"
        : isLlmProcessed
            ? "ai"
            : ""
    const matchedCategory = categories.find((item) => item.name === currentCategory)
    const rawDisplayedCategory = currentCategory || (Number(currentAmount || 0) >= 0 ? "Uncategorized income" : "Uncategorized expenses")
    const displayedCategory = getCategoryDisplayName({
        categoryName: rawDisplayedCategory,
        categoryType: matchedCategory?.type || "",
        amount: Number(currentAmount || 0),
    })

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
                    <button
                        type="button"
                        className={`w-full rounded-full border-3 bg-white p-2 pl-3 pr-8 text-left ${isCategoryPickerOpen ? "border-gray-300" : "border-gray-100"} ${isApplyingCategoryBulk ? "cursor-not-allowed opacity-60" : ""}`}
                        disabled={isApplyingCategoryBulk}
                        onClick={(event) => onOpenCategoryPicker?.({
                            entryId: id,
                            anchorElement: event.currentTarget,
                            isEditing,
                            currentCategory: displayedCategory,
                            amount: Number(currentAmount || 0),
                        })}
                    >
                        <span className="block truncate">{displayedCategory}</span>
                    </button>
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
                {isLlmProcessing ? (
                    <span
                        className="inline-flex items-center justify-center rounded-full bg-amber-100 p-1 text-amber-700"
                        title="Processing by LLM"
                        aria-label="Processing by LLM"
                    >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-9-9" />
                        </svg>
                    </span>
                ) : iconMode === "memory" ? (
                    <span
                        className="inline-flex items-center justify-center rounded-full bg-violet-100 p-1 text-violet-700"
                        title="Categorized by memory"
                        aria-label="Categorized by memory"
                    >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 8a3 3 0 0 1 3-3h7v14h-7a3 3 0 0 0-3 3z" />
                            <path d="M17 5a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3" />
                            <path d="M10 9h4" />
                            <path d="M10 13h4" />
                        </svg>
                    </span>
                ) : iconMode === "ai" ? (
                    <span
                        className="inline-flex items-center justify-center rounded-full bg-sky-100 p-1 text-sky-700"
                        title="Categorized by AI"
                        aria-label="Categorized by AI"
                    >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3l1.9 4.3L18 9.2l-4.1 1.9L12 15.5l-1.9-4.4L6 9.2l4.1-1.9z" />
                            <path d="M19 16l.8 1.7L21.5 18l-1.7.8L19 20.5l-.8-1.7-1.7-.8 1.7-.3z" />
                        </svg>
                    </span>
                ) : null}
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
                <h4 className={`text-right ${amountPresentation.className}`}>{amountPresentation.text}</h4>
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
