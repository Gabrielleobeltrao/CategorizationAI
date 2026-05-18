import { useEffect, useState } from "react"

function formatRelative(value) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const diffMs = Date.now() - date.getTime()
    const seconds = Math.max(0, Math.floor(diffMs / 1000))
    if (seconds < 45) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(date)
}

function initialsFromName(name = "", email = "") {
    const safeName = String(name || "").trim()
    if (safeName) {
        const parts = safeName.split(/\s+/)
        return (parts[0]?.[0] || "") + (parts[1]?.[0] || "")
    }
    return String(email || "").trim().slice(0, 2).toUpperCase()
}

/**
 * Inline comments section for the task details modal.
 *
 * Props:
 *  - comments: array of { id, body, authorId, authorName, createdAt, updatedAt? }
 *  - currentProfileId: id of the logged-in user — owners always see edit/delete
 *    affordances on their own comments regardless of role permissions.
 *  - canCreate / canUpdate / canDelete: gating for *other* users' comments;
 *    `canUpdate` and `canDelete` only matter for non-owned comments since
 *    ownership always unlocks the action.
 *  - onCreate(body) / onUpdate(commentId, body) / onDelete(commentId): async
 *    handlers that return when the network call settles
 */
function TaskCommentsSection({
    comments = [],
    currentProfileId = "",
    canCreate = false,
    canUpdate = false,
    canDelete = false,
    onCreate,
    onUpdate,
    onDelete,
}) {
    const [draft, setDraft] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [editingId, setEditingId] = useState("")
    const [editingDraft, setEditingDraft] = useState("")
    const [busyAction, setBusyAction] = useState("") // commentId currently mutating

    useEffect(() => {
        // If the parent reloads the task and the comment we were editing is
        // gone (deleted by someone else), reset the editor.
        if (editingId && !comments.some((c) => c.id === editingId)) {
            setEditingId("")
            setEditingDraft("")
        }
    }, [comments, editingId])

    const sortedComments = [...comments].sort(
        (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime(),
    )

    const startEdit = (comment) => {
        setEditingId(comment.id)
        setEditingDraft(comment.body || "")
    }

    const cancelEdit = () => {
        setEditingId("")
        setEditingDraft("")
    }

    const submitNew = async () => {
        const safe = draft.trim()
        if (!safe || isSaving) return
        try {
            setIsSaving(true)
            await onCreate?.(safe)
            setDraft("")
        } finally {
            setIsSaving(false)
        }
    }

    const submitEdit = async (commentId) => {
        const safe = editingDraft.trim()
        if (!safe) return
        try {
            setBusyAction(commentId)
            await onUpdate?.(commentId, safe)
            cancelEdit()
        } finally {
            setBusyAction("")
        }
    }

    const runDelete = async (commentId) => {
        try {
            setBusyAction(commentId)
            await onDelete?.(commentId)
        } finally {
            setBusyAction("")
        }
    }

    return (
        <section className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <header className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Comments
                </h3>
                <span className="text-[11px] text-gray-400">{sortedComments.length}</span>
            </header>

            {sortedComments.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center text-sm text-gray-500">
                    No comments yet.
                </p>
            ) : (
                <ul className="mt-3 flex flex-col gap-3">
                    {sortedComments.map((comment) => {
                        const isEditing = editingId === comment.id
                        const isBusy = busyAction === comment.id
                        const isOwner = Boolean(currentProfileId) && String(comment.authorId || "") === String(currentProfileId)
                        const allowEdit = isOwner || canUpdate
                        const allowDelete = isOwner || canDelete
                        return (
                            <li key={comment.id} className="rounded-lg border border-gray-200 bg-white p-3">
                                <header className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold uppercase text-gray-700">
                                            {initialsFromName(comment.authorName) || "?"}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-gray-900">
                                                {comment.authorName || "Unknown"}
                                                {isOwner && (
                                                    <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-gray-400">
                                                        you
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[11px] text-gray-500">
                                                {formatRelative(comment.createdAt)}
                                                {comment.updatedAt ? " · edited" : ""}
                                            </p>
                                        </div>
                                    </div>
                                    {(allowEdit || allowDelete) && !isEditing && (
                                        <div className="flex items-center gap-1">
                                            {allowEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(comment)}
                                                    disabled={isBusy}
                                                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60"
                                                    title="Edit comment"
                                                    aria-label="Edit comment"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                    </svg>
                                                </button>
                                            )}
                                            {allowDelete && (
                                                <button
                                                    type="button"
                                                    onClick={() => runDelete(comment.id)}
                                                    disabled={isBusy}
                                                    className="rounded-md p-1.5 text-gray-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                                                    title="Delete comment"
                                                    aria-label="Delete comment"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" />
                                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </header>
                                {isEditing ? (
                                    <div className="mt-2 flex flex-col gap-2">
                                        <textarea
                                            value={editingDraft}
                                            onChange={(e) => setEditingDraft(e.target.value)}
                                            rows={3}
                                            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                            disabled={isBusy}
                                        />
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                disabled={isBusy}
                                                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => submitEdit(comment.id)}
                                                disabled={isBusy || !editingDraft.trim()}
                                                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                                            >
                                                {isBusy ? "Saving…" : "Save"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-gray-800">
                                        {comment.body}
                                    </p>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            {canCreate && (
                <div className="mt-3 flex flex-col gap-2">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        placeholder="Write a comment…"
                        className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                        disabled={isSaving}
                    />
                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            onClick={submitNew}
                            disabled={isSaving || !draft.trim()}
                            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {isSaving ? "Posting…" : "Post comment"}
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}

export default TaskCommentsSection
