import { useMemo, useState } from "react"
import PopupModal from "../ui/PopupModal"
import { BALANCE_SHEET_TYPE_OPTIONS } from "../../constants/balanceSheetTypes"

function formatOptionLabel(value = "") {
    return String(value || "")
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
}

function AccountsSection({ accounts, onCreate, onSaveEdit, onDelete }) {
    const [editingId, setEditingId] = useState("")
    const [draftName, setDraftName] = useState("")
    const [draftType, setDraftType] = useState("")
    const [draftBalanceSheetType, setDraftBalanceSheetType] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const accountTypeOptions = useMemo(() => {
        const defaults = ["checking", "savings", "credit_card", "cash", "loan", "other"]
        const existing = (Array.isArray(accounts) ? accounts : [])
            .map((account) => String(account?.type || "").trim())
            .filter(Boolean)
        return Array.from(new Set([...existing, ...defaults]))
    }, [accounts])

    const startEdit = (account) => {
        setEditingId(account.id)
        setDraftName(account.name || "")
        setDraftType(account.type || "")
        setDraftBalanceSheetType(account.balanceSheetType || "")
    }

    const cancelEdit = () => {
        setEditingId("")
        setDraftName("")
        setDraftType("")
        setDraftBalanceSheetType("")
    }

    const saveEdit = async () => {
        if (!editingId) return
        try {
            setIsSaving(true)
            await onSaveEdit?.(editingId, {
                name: draftName,
                type: draftType,
                balanceSheetType: draftBalanceSheetType,
            })
            cancelEdit()
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <section className="min-h-0 h-full p-1 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold">Bank Accounts</h3>
                <button
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                    onClick={onCreate}
                >
                    <span className="hidden sm:inline">+ New Account</span>
                    <span className="sm:hidden">+ Account</span>
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2">
                {accounts.map((account, index) => (
                    <article
                        key={account.id}
                        className={`border border-gray-100 rounded-md p-2 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 text-left">
                                <h3 className="text-sm font-semibold truncate">{account.name}</h3>
                                <p className="text-xs text-gray-500">{account.type}</p>
                            </div>
                            <button
                                type="button"
                                className="rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                onClick={() => startEdit(account)}
                                title="Edit account"
                                aria-label="Edit account"
                            >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                </svg>
                            </button>
                        </div>
                    </article>
                ))}
                {accounts.length === 0 && (
                    <h4 className="text-center text-gray-500">No accounts found. Please add accounts.</h4>
                )}
            </div>

            <PopupModal
                isOpen={Boolean(editingId)}
                title="Edit account"
                onClose={cancelEdit}
                maxWidthClass="max-w-md"
            >
                <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</span>
                        <input
                            type="text"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Account name"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</span>
                        <div className="relative">
                            <select
                                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 outline-none focus:border-gray-500"
                                value={draftType}
                                onChange={(e) => setDraftType(e.target.value)}
                            >
                                <option value="">Select type</option>
                                {accountTypeOptions.map((typeOption) => (
                                    <option key={typeOption} value={typeOption}>
                                        {formatOptionLabel(typeOption)}
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
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Balance Sheet category</span>
                        <div className="relative">
                            <select
                                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 outline-none focus:border-gray-500"
                                value={draftBalanceSheetType}
                                onChange={(e) => setDraftBalanceSheetType(e.target.value)}
                            >
                                <option value="">Auto-detect from type</option>
                                {BALANCE_SHEET_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
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
                        <span className="text-[11px] text-gray-500">
                            Drives the Balance Sheet grouping. Auto-detect uses the account type when blank.
                        </span>
                    </label>
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const editingAccount = accounts.find((acc) => acc.id === editingId)
                                if (editingAccount) {
                                    cancelEdit()
                                    onDelete?.(editingAccount)
                                }
                            }}
                            disabled={isSaving}
                            className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveEdit}
                                disabled={isSaving}
                                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                                {isSaving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            </PopupModal>
        </section>
    )
}

export default AccountsSection
