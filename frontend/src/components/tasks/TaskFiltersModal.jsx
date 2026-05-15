import { useEffect, useState } from "react"
import Combobox from "../ui/Combobox"
import DateRangePicker from "../ui/DateRangePicker"

const STATUS_OPTIONS = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In progress" },
    { value: "done", label: "Done" },
]

const PRIORITY_OPTIONS = [
    { value: "all", label: "All" },
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
]

export const EMPTY_TASK_FILTERS = {
    status: "all",
    priority: "all",
    clientId: "",
    assigneeId: "",
    from: "",
    to: "",
}

function TaskFiltersModal({
    isOpen,
    filters,
    clients = [],
    employees = [],
    onCancel,
    onApply,
}) {
    const [draft, setDraft] = useState(filters || EMPTY_TASK_FILTERS)

    useEffect(() => {
        if (isOpen) setDraft(filters || EMPTY_TASK_FILTERS)
    }, [isOpen, filters])

    if (!isOpen) return null

    const handleApply = () => onApply?.(draft)
    const handleClear = () => setDraft(EMPTY_TASK_FILTERS)

    const range = draft.from && draft.to ? { from: draft.from, to: draft.to } : null

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Close"
                onClick={onCancel}
            />
            <div className="relative flex w-full max-w-xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl">
                <header className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Filters</h2>
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
                        label="Status"
                        value={draft.status}
                        onChange={(value) => setDraft((d) => ({ ...d, status: value }))}
                        options={STATUS_OPTIONS}
                    />
                    <Combobox
                        label="Priority"
                        value={draft.priority}
                        onChange={(value) => setDraft((d) => ({ ...d, priority: value }))}
                        options={PRIORITY_OPTIONS}
                    />
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
                        label="Assignee"
                        value={draft.assigneeId}
                        onChange={(value) => setDraft((d) => ({ ...d, assigneeId: value }))}
                        searchable
                        searchPlaceholder="Search assignees"
                        options={[
                            { value: "", label: "Everyone" },
                            ...employees.map((emp) => ({
                                value: String(emp._id || emp.id),
                                label: emp.name || emp.email || "—",
                            })),
                        ]}
                    />
                </div>

                <div className="flex flex-col gap-1 text-xs text-gray-600">
                    <span>Created between</span>
                    <DateRangePicker
                        value={range}
                        onChange={(next) => setDraft((d) => ({ ...d, from: next.from, to: next.to }))}
                        align="start"
                    />
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

export function countActiveFilters(filters) {
    if (!filters) return 0
    let count = 0
    if (filters.status && filters.status !== "all") count += 1
    if (filters.priority && filters.priority !== "all") count += 1
    if (filters.clientId) count += 1
    if (filters.assigneeId) count += 1
    if (filters.from || filters.to) count += 1
    return count
}

export default TaskFiltersModal
