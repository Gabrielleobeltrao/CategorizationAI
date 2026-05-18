import { useEffect, useState } from "react"
import Combobox from "../ui/Combobox"
import DateRangePicker from "../ui/DateRangePicker"

const PRIORITY_OPTIONS = [
    { value: "all", label: "All priorities" },
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
]

const DATE_MODE_OPTIONS = [
    { value: "all", label: "Any" },
    { value: "range", label: "In a date range" },
    { value: "none", label: "Without a due date" },
]

export const EMPTY_BOARD_FILTERS = {
    clientId: "",
    priority: "all",
    dateMode: "all",
    from: "",
    to: "",
}

export function countActiveBoardFilters(filters) {
    if (!filters) return 0
    let count = 0
    if (filters.clientId) count += 1
    if (filters.priority && filters.priority !== "all") count += 1
    if (filters.dateMode && filters.dateMode !== "all") count += 1
    return count
}

function BoardFiltersModal({ isOpen, filters, clients = [], onCancel, onApply, onClear }) {
    const [draft, setDraft] = useState(filters || EMPTY_BOARD_FILTERS)

    useEffect(() => {
        if (isOpen) setDraft(filters || EMPTY_BOARD_FILTERS)
    }, [isOpen, filters])

    if (!isOpen) return null

    const handleApply = () => onApply?.(draft)
    // Clear should drop every filter AND close the modal so the user sees the
    // column board right away — onClear handles both in the parent.
    const handleClear = () => {
        setDraft(EMPTY_BOARD_FILTERS)
        onClear?.()
    }

    const range = draft.from && draft.to ? { from: draft.from, to: draft.to } : null

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Close"
                onClick={onCancel}
            />
            <div className="relative flex w-full max-w-xl flex-col gap-4 rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
                <header className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Board filters</h2>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </header>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Combobox
                        label="Client"
                        value={draft.clientId}
                        onChange={(value) => setDraft((d) => ({ ...d, clientId: value }))}
                        searchable
                        searchPlaceholder="Search clients"
                        options={[
                            { value: "", label: "All clients" },
                            ...clients.map((c) => ({
                                value: String(c._id || c.id),
                                label: c.name || "Unnamed",
                            })),
                        ]}
                    />
                    <Combobox
                        label="Priority"
                        value={draft.priority}
                        onChange={(value) => setDraft((d) => ({ ...d, priority: value }))}
                        options={PRIORITY_OPTIONS}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-gray-600">Due date</span>
                    <div className="flex flex-wrap gap-1.5">
                        {DATE_MODE_OPTIONS.map((option) => {
                            const isActive = draft.dateMode === option.value
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setDraft((d) => ({
                                        ...d,
                                        dateMode: option.value,
                                        from: option.value === "range" ? d.from : "",
                                        to: option.value === "range" ? d.to : "",
                                    }))}
                                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                                        isActive
                                            ? "border-gray-900 bg-gray-900 text-white"
                                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            )
                        })}
                    </div>
                    {draft.dateMode === "range" && (
                        <div className="pt-1">
                            <DateRangePicker
                                value={range}
                                onChange={(next) => setDraft((d) => ({ ...d, from: next.from, to: next.to }))}
                            />
                        </div>
                    )}
                </div>

                <footer className="mt-2 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={handleClear}
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Clear all
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                        >
                            Apply filters
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    )
}

export default BoardFiltersModal
