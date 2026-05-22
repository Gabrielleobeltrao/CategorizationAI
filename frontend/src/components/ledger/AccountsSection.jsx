import { useEffect, useMemo, useRef, useState } from "react"
import { ACCOUNT_TYPE_OPTIONS, ACCOUNT_TYPE_LABELS, BALANCE_SHEET_ACCOUNT_TYPES } from "../../constants/accountTypes"

const BALANCE_SHEET_TYPE_OPTIONS = ACCOUNT_TYPE_OPTIONS.filter((opt) =>
    BALANCE_SHEET_ACCOUNT_TYPES.includes(opt.value),
)

function formatTypeLabel(value = "") {
    return ACCOUNT_TYPE_LABELS[value] || value
}

function AccountsSection({ accounts, onCreate, onSaveEdit, onDelete, onDeleteMany }) {
    const [editingId, setEditingId] = useState("")
    const [draftName, setDraftName] = useState("")
    const [draftType, setDraftType] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [selectedIds, setSelectedIds] = useState([])
    const selectAllRef = useRef(null)

    useEffect(() => {
        const validIds = new Set((Array.isArray(accounts) ? accounts : []).map((account) => account.id))
        setSelectedIds((current) => current.filter((id) => validIds.has(id)))
    }, [accounts])

    const accountTypeOptions = BALANCE_SHEET_TYPE_OPTIONS

    const startEdit = (account) => {
        setEditingId(account.id)
        setDraftName(account.name || "")
        setDraftType(account.type || "")
    }

    const cancelEdit = () => {
        setEditingId("")
        setDraftName("")
        setDraftType("")
    }

    const saveEdit = async () => {
        if (!editingId) return
        try {
            setIsSaving(true)
            await onSaveEdit?.(editingId, {
                name: draftName,
                accountType: draftType,
            })
            cancelEdit()
        } finally {
            setIsSaving(false)
        }
    }

    const accountIds = useMemo(
        () => (Array.isArray(accounts) ? accounts.map((account) => account.id) : []),
        [accounts]
    )

    const allSelected = useMemo(
        () => accountIds.length > 0 && accountIds.every((id) => selectedIds.includes(id)),
        [accountIds, selectedIds]
    )

    const someSelected = useMemo(
        () => !allSelected && accountIds.some((id) => selectedIds.includes(id)),
        [accountIds, selectedIds, allSelected]
    )

    useEffect(() => {
        if (!selectAllRef.current) return
        selectAllRef.current.indeterminate = someSelected
    }, [someSelected])

    const toggleSelectAll = (isChecked) => {
        if (!isChecked) {
            setSelectedIds([])
            return
        }
        setSelectedIds(accountIds)
    }

    const toggleOne = (id, isChecked) => {
        setSelectedIds((current) => {
            if (isChecked) {
                if (current.includes(id)) return current
                return [...current, id]
            }
            return current.filter((item) => item !== id)
        })
    }

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
                <div className="flex items-center gap-2 px-1">
                    <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="h-4 w-4"
                        checked={allSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                    <span className="text-xs text-gray-600">
                        Select all {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ""}
                    </span>
                </div>
                {accounts.map((account, index) => (
                    <article
                        key={account.id}
                        className={`border border-gray-100 rounded-md p-2 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                    >
                        {editingId === account.id ? (
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 flex flex-col gap-2">
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-gray-500"
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        placeholder="Account name"
                                    />
                                    <div className="relative w-full">
                                        <select
                                            className="w-full rounded-full border-3 border-gray-100 bg-white p-2 pl-3 pr-8 text-sm text-gray-700 appearance-none outline-none"
                                            value={draftType}
                                            onChange={(e) => setDraftType(e.target.value)}
                                        >
                                            <option value="">Select type</option>
                                            {accountTypeOptions.map((typeOption) => (
                                                <option key={typeOption.value} value={typeOption.value}>
                                                    {typeOption.label}
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
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-emerald-700 disabled:opacity-50"
                                        onClick={saveEdit}
                                        disabled={isSaving}
                                        title="Save account"
                                        aria-label="Save account"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m20 6-11 11-5-5" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
                                        onClick={cancelEdit}
                                        disabled={isSaving}
                                        title="Cancel edit"
                                        aria-label="Cancel edit"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 6 6 18" />
                                            <path d="m6 6 12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ) : (
                        <div className="flex items-start justify-between gap-3">
                            <div className="pt-1">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={selectedIds.includes(account.id)}
                                    onChange={(e) => toggleOne(account.id, e.target.checked)}
                                    aria-label={`Select account ${account.name}`}
                                />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                                <h3 className="text-sm font-semibold truncate">{account.name}</h3>
                                <p className="text-xs text-gray-500">{formatTypeLabel(account.type)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                    onClick={() => startEdit(account)}
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
                                    onClick={() => {
                                        if (selectedIds.includes(account.id) && selectedIds.length > 0) {
                                            onDeleteMany?.(selectedIds)
                                            return
                                        }
                                        onDelete(account)
                                    }}
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
                        )}
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
