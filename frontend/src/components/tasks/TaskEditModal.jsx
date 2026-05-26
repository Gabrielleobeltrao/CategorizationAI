import { useEffect, useState } from "react"
import MultiSelect from "../ui/MultiSelect"
import TaskPrioritySelect from "./TaskPrioritySelect"

const EMPTY_DRAFT = {
    title: "",
    description: "",
    clientIds: [],
    assigneeIds: [],
    dueDate: "",
    priority: "low",
}

function buildDraftFromTask(task) {
    if (!task) return { ...EMPTY_DRAFT }
    const clientIds = Array.isArray(task.clientIds) && task.clientIds.length > 0
        ? task.clientIds.map(String)
        : (task.clientId ? [String(task.clientId)] : [])
    const assigneeIds = Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0
        ? task.assigneeIds.map(String)
        : (task.assigneeId ? [String(task.assigneeId)] : [])
    return {
        title: String(task.title || ""),
        description: String(task.description || ""),
        clientIds,
        assigneeIds,
        dueDate: String(task.dueDate || ""),
        priority: String(task.priority || "low"),
    }
}

function TaskEditModal({
    isOpen,
    task,
    clients = [],
    employees = [],
    isSaving = false,
    onCancel,
    onSubmit,
}) {
    const [draft, setDraft] = useState(() => buildDraftFromTask(task))

    useEffect(() => {
        if (isOpen) setDraft(buildDraftFromTask(task))
    }, [isOpen, task])

    if (!isOpen) return null

    const isEditing = Boolean(task)

    const handleSubmit = (event) => {
        event.preventDefault()
        onSubmit?.(draft)
    }

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Close"
                onClick={onCancel}
            />
            <form
                onSubmit={handleSubmit}
                className="relative flex w-full max-w-3xl flex-col gap-4 rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
            >
                <header className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                        {isEditing ? "Edit task" : "New task"}
                    </h2>
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

                <label className="flex flex-col gap-1 text-xs text-gray-600">
                    Title
                    <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="Optional"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                    />
                </label>

                <label className="flex flex-col gap-1 text-xs text-gray-600">
                    Description
                    <textarea
                        rows={3}
                        value={draft.description}
                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                        placeholder="Optional"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                    />
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MultiSelect
                        label="Clients"
                        value={draft.clientIds}
                        onChange={(values) => setDraft((d) => ({ ...d, clientIds: values }))}
                        placeholder="Select clients"
                        searchPlaceholder="Search clients"
                        options={clients.map((c) => ({
                            value: String(c._id || c.id),
                            label: c.name || "Unnamed",
                        }))}
                    />

                    <MultiSelect
                        label="Assignees"
                        value={draft.assigneeIds}
                        onChange={(values) => setDraft((d) => ({ ...d, assigneeIds: values }))}
                        placeholder="Select assignees"
                        searchPlaceholder="Search assignees"
                        options={employees.map((emp) => ({
                            value: String(emp._id || emp.id),
                            label: emp.name || emp.email || "—",
                        }))}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Due date
                        <input
                            type="date"
                            value={draft.dueDate}
                            onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Priority
                        <TaskPrioritySelect
                            value={draft.priority}
                            onChange={(next) => setDraft((d) => ({ ...d, priority: next }))}
                            disabled={isSaving}
                        />
                    </label>
                </div>

                <footer className="mt-2 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                    >
                        {isSaving ? "Saving…" : isEditing ? "Save" : "Create task"}
                    </button>
                </footer>
            </form>
        </div>
    )
}

export default TaskEditModal
