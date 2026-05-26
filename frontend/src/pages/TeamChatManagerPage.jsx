import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import ConfirmModal from "../components/ui/ConfirmModal"
import PopupModal from "../components/ui/PopupModal"
import {
    adminListConversations,
    adminListConversationMessages,
    adminDeleteConversation,
    getChatFileDownloadUrl,
} from "../services/chat.service"

function formatRole(value) {
    const safe = String(value || "").trim()
    if (!safe) return ""
    return safe.split("_").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
}

function formatTimestamp(value) {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

function formatTimeOnly(value) {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(d)
}

function formatDateSeparator(value) {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const same = (a, b) => a.toDateString() === b.toDateString()
    if (same(d, today)) return "Today"
    if (same(d, yesterday)) return "Yesterday"
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(d)
}

const AVATAR_PALETTE = [
    { bg: "bg-rose-100", text: "text-rose-700" },
    { bg: "bg-sky-100", text: "text-sky-700" },
    { bg: "bg-emerald-100", text: "text-emerald-700" },
    { bg: "bg-amber-100", text: "text-amber-700" },
    { bg: "bg-violet-100", text: "text-violet-700" },
    { bg: "bg-teal-100", text: "text-teal-700" },
    { bg: "bg-pink-100", text: "text-pink-700" },
    { bg: "bg-indigo-100", text: "text-indigo-700" },
]

function avatarColorFor(id) {
    const safe = String(id || "")
    let hash = 0
    for (let i = 0; i < safe.length; i += 1) {
        hash = (hash * 31 + safe.charCodeAt(i)) >>> 0
    }
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

// Groups messages into "buckets" so consecutive messages from the same author
// share the avatar and the timestamp only appears on the last bubble. Buckets
// are split by author change OR > 5min gap.
function groupConsecutive(messages) {
    const groups = []
    for (const msg of messages) {
        const last = groups[groups.length - 1]
        const ts = new Date(msg.createdAt).getTime()
        if (
            last &&
            String(last.authorId) === String(msg.authorId) &&
            ts - new Date(last.messages[last.messages.length - 1].createdAt).getTime() < 5 * 60 * 1000
        ) {
            last.messages.push(msg)
            continue
        }
        groups.push({ authorId: msg.authorId, messages: [msg] })
    }
    return groups
}

function FilterSelect({ label, value, onChange, children, className = "" }) {
    return (
        <label className={`flex flex-col gap-1.5 ${className}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm text-gray-900 shadow-sm outline-none transition hover:border-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                >
                    {children}
                </select>
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </div>
        </label>
    )
}

function TeamChatManagerPage() {
    const { profile } = useAuth()
    const { error, success } = useNotification()
    const officeId = String(profile?.officeId || "").trim()

    const [items, setItems] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [typeFilter, setTypeFilter] = useState("all")
    const [search, setSearch] = useState("")
    const [viewingConvId, setViewingConvId] = useState(null)
    const [viewingMessages, setViewingMessages] = useState([])
    const [viewingMeta, setViewingMeta] = useState(null)
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const load = useCallback(async () => {
        if (!officeId) return
        setIsLoading(true)
        try {
            const payload = await adminListConversations(officeId)
            setItems(Array.isArray(payload?.items) ? payload.items : [])
        } catch (err) {
            error(err?.message || "Failed to load conversations")
        } finally {
            setIsLoading(false)
        }
    }, [officeId, error])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return items.filter((conv) => {
            if (typeFilter !== "all" && conv.type !== typeFilter) return false
            if (!q) return true
            const inName = String(conv.displayName || "").toLowerCase().includes(q)
            const inMember = (conv.members || []).some((m) => {
                return String(m.name || "").toLowerCase().includes(q) || String(m.email || "").toLowerCase().includes(q)
            })
            return inName || inMember
        })
    }, [items, typeFilter, search])

    const totalDms = items.filter((c) => c.type === "dm").length
    const totalGroups = items.filter((c) => c.type === "group").length
    const totalMessages = items.reduce((acc, c) => acc + (c.messageCount || 0), 0)

    const handleOpenView = async (conv) => {
        setViewingConvId(conv.id)
        setViewingMeta(conv)
        setViewingMessages([])
        setIsLoadingMessages(true)
        try {
            const payload = await adminListConversationMessages(officeId, conv.id, { limit: 200 })
            setViewingMessages(Array.isArray(payload?.items) ? payload.items : [])
        } catch (err) {
            error(err?.message || "Failed to load messages")
        } finally {
            setIsLoadingMessages(false)
        }
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            await adminDeleteConversation(officeId, deleteTarget.id)
            success("Conversation deleted")
            setDeleteTarget(null)
            await load()
        } catch (err) {
            error(err?.message || "Failed to delete conversation")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <section className="h-full w-full px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
            <div className="mx-auto flex max-w-7xl flex-col gap-4">
                <header>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Operations CRM</p>
                    <h1 className="text-2xl font-bold sm:text-3xl">Team Chat Manager</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Audit every DM and group in the office. Read transcripts and remove conversations that shouldn't exist.
                    </p>
                </header>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat label="Conversations" value={items.length} />
                    <Stat label="Direct messages" value={totalDms} />
                    <Stat label="Groups" value={totalGroups} />
                    <Stat label="Messages" value={totalMessages} />
                </div>

                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Type</span>
                        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                            <TypePill active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All</TypePill>
                            <TypePill active={typeFilter === "dm"} onClick={() => setTypeFilter("dm")}>DMs</TypePill>
                            <TypePill active={typeFilter === "group"} onClick={() => setTypeFilter("group")}>Groups</TypePill>
                        </div>
                    </div>
                    <label className="flex flex-1 flex-col gap-1.5 min-w-50">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Search</span>
                        <div className="relative">
                            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </svg>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Group name, member name, email…"
                                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition hover:border-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                            />
                        </div>
                    </label>
                    <div className="self-end text-xs text-gray-500">
                        {isLoading ? "Loading…" : `${filtered.length} of ${items.length} shown`}
                    </div>
                </div>

                <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {filtered.length === 0 && !isLoading ? (
                        <p className="px-4 py-12 text-center text-sm text-gray-500">
                            No conversations match the current filters.
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {filtered.map((conv) => (
                                <li key={conv.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                                            conv.type === "group" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                                        }`}>
                                            {conv.type === "group"
                                                ? (
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="9" cy="7" r="4" />
                                                        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                                    </svg>
                                                )
                                                : (conv.displayName?.slice(0, 1) || "?").toUpperCase()}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-900">
                                                <span className="truncate">{conv.displayName || "Conversation"}</span>
                                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                                    conv.type === "group" ? "bg-gray-100 text-gray-700" : "bg-sky-100 text-sky-800"
                                                }`}>
                                                    {conv.type}
                                                </span>
                                            </p>
                                            <p className="truncate text-[12px] text-gray-500">
                                                {(conv.members || []).map((m) => {
                                                    const roleLabel = formatRole(m.role)
                                                    return `${m.name || m.email || "?"}${roleLabel ? ` (${roleLabel})` : ""}`
                                                }).join(", ")}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-gray-400 sm:hidden">
                                                {conv.messageCount} message{conv.messageCount === 1 ? "" : "s"} · {formatTimestamp(conv.lastMessageAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="hidden text-right text-xs text-gray-500 sm:block">
                                        <p>{conv.messageCount} messages</p>
                                        <p className="text-[11px] text-gray-400">{formatTimestamp(conv.lastMessageAt)}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 sm:ml-2">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenView(conv)}
                                            className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 sm:flex-none"
                                        >
                                            View
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteTarget(conv)}
                                            className="flex-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-[12px] font-medium text-rose-700 transition hover:bg-rose-50 sm:flex-none"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </article>
            </div>

            <PopupModal
                isOpen={Boolean(viewingConvId)}
                onClose={() => { setViewingConvId(null); setViewingMessages([]); setViewingMeta(null) }}
                title={viewingMeta?.displayName || "Conversation"}
                maxWidthClass="max-w-2xl"
            >
                <ConversationTranscript
                    meta={viewingMeta}
                    messages={viewingMessages}
                    isLoading={isLoadingMessages}
                    officeId={officeId}
                />
            </PopupModal>

            <ConfirmModal
                isOpen={Boolean(deleteTarget)}
                title={deleteTarget?.type === "group" ? "Delete this group?" : "Delete this conversation?"}
                message={deleteTarget?.type === "group"
                    ? `"${deleteTarget?.displayName}" and all its messages will be removed for everyone.`
                    : `All messages between these participants will be removed.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={handleConfirmDelete}
                onClose={() => !isDeleting && setDeleteTarget(null)}
                isLoading={isDeleting}
                maxWidthClass="max-w-md"
            />
        </section>
    )
}

function ConversationTranscript({ meta, messages, isLoading, officeId }) {
    const groups = groupConsecutive(messages || [])
    const membersById = new Map((meta?.members || []).map((m) => [String(m.id), m]))

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[12px] text-gray-600">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    meta?.type === "group" ? "bg-gray-900 text-white" : "bg-sky-100 text-sky-800"
                }`}>
                    {meta?.type || "—"}
                </span>
                {(meta?.members || []).map((m) => {
                    const color = avatarColorFor(m.id)
                    const display = m.name || m.email || "?"
                    const roleLabel = formatRole(m.role)
                    return (
                        <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-0.5">
                            <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${color.bg} ${color.text}`}>
                                {display.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="text-[12px] text-gray-700">{display}</span>
                            {roleLabel && (
                                <span className="text-[10px] text-gray-500">· {roleLabel}</span>
                            )}
                        </span>
                    )
                })}
                <span className="ml-auto text-[11px] text-gray-500">
                    {messages?.length || 0} message{(messages?.length || 0) === 1 ? "" : "s"}
                </span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-100 bg-white p-4">
                {isLoading ? (
                    <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
                ) : groups.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No messages.</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {groups.map((group, gIdx) => {
                            const prev = gIdx > 0 ? groups[gIdx - 1] : null
                            const groupDate = group.messages[0]?.createdAt
                            const prevDate = prev?.messages?.[prev.messages.length - 1]?.createdAt
                            const dayChanged = !prevDate || new Date(groupDate).toDateString() !== new Date(prevDate).toDateString()
                            return (
                                <div key={group.messages[0]?.id || gIdx} className="flex flex-col gap-3">
                                    {dayChanged && (
                                        <div className="flex items-center gap-2">
                                            <div className="h-px flex-1 bg-gray-200" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                {formatDateSeparator(groupDate)}
                                            </span>
                                            <div className="h-px flex-1 bg-gray-200" />
                                        </div>
                                    )}
                                    <MessageGroup group={group} member={membersById.get(String(group.authorId))} officeId={officeId} />
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function MessageGroup({ group, member, officeId }) {
    const display = member?.name || group.messages[0]?.authorName || "Unknown"
    const roleLabel = formatRole(member?.role)
    const color = avatarColorFor(group.authorId)
    const lastTs = group.messages[group.messages.length - 1]?.createdAt

    return (
        <div className="flex gap-3">
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}>
                {display.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{display}</span>
                    {roleLabel && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                            {roleLabel}
                        </span>
                    )}
                    <span className="text-[11px] text-gray-400">{formatTimeOnly(group.messages[0]?.createdAt)}</span>
                </p>
                <div className="flex flex-col gap-1.5">
                    {group.messages.map((msg) => (
                        <div key={msg.id} className="text-sm text-gray-800">
                            {msg.body && (
                                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                            )}
                            {msg.attachment?.type === "audio" && (
                                <AudioPlayer attachment={msg.attachment} />
                            )}
                            {msg.attachment?.type === "file" && (
                                <FileLink attachment={msg.attachment} officeId={officeId} />
                            )}
                            {msg.editedAt && (
                                <span className="text-[10px] text-gray-400"> · edited</span>
                            )}
                        </div>
                    ))}
                </div>
                {group.messages.length > 1 && (
                    <p className="text-[10px] text-gray-400">last at {formatTimeOnly(lastTs)}</p>
                )}
            </div>
        </div>
    )
}

function formatBytes(bytes) {
    const n = Number(bytes) || 0
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
    return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function FileLink({ attachment, officeId }) {
    const url = getChatFileDownloadUrl(officeId, attachment.fileId)
    const isImage = String(attachment.mimeType || "").startsWith("image/")
    const inlineUrl = isImage ? getChatFileDownloadUrl(officeId, attachment.fileId, { inline: true }) : null
    return (
        <div className="mt-1 flex w-full max-w-xs flex-col gap-1.5">
            {isImage && inlineUrl && (
                <a href={inlineUrl} target="_blank" rel="noreferrer">
                    <img src={inlineUrl} alt={attachment.name || "image"} className="max-h-56 w-full rounded-lg object-cover" />
                </a>
            )}
            <a
                href={url}
                download={attachment.name || "file"}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 transition hover:bg-gray-50"
            >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gray-900 text-white">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                    </svg>
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-gray-900">{attachment.name || "file"}</span>
                    <span className="block text-[10px] text-gray-500">{formatBytes(attachment.size)}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M12 15V3" />
                </svg>
            </a>
        </div>
    )
}

function TypePill({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
        >
            {children}
        </button>
    )
}

function AudioPlayer({ attachment }) {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [audioDuration, setAudioDuration] = useState(0)
    const durationFromMeta = Number(attachment?.duration) || 0

    useEffect(() => {
        const el = audioRef.current
        if (!el) return undefined
        const onTime = () => setCurrentTime(el.currentTime || 0)
        const onEnded = () => { setIsPlaying(false); setCurrentTime(0) }
        const onLoaded = () => {
            if (Number.isFinite(el.duration)) setAudioDuration(el.duration)
        }
        el.addEventListener("timeupdate", onTime)
        el.addEventListener("ended", onEnded)
        el.addEventListener("loadedmetadata", onLoaded)
        return () => {
            el.removeEventListener("timeupdate", onTime)
            el.removeEventListener("ended", onEnded)
            el.removeEventListener("loadedmetadata", onLoaded)
        }
    }, [])

    const toggle = () => {
        const el = audioRef.current
        if (!el) return
        if (el.paused) {
            el.play().catch(() => {})
            setIsPlaying(true)
        } else {
            el.pause()
            setIsPlaying(false)
        }
    }

    const total = durationFromMeta > 0 ? durationFromMeta : audioDuration
    const percent = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0
    const display = isPlaying || currentTime > 0
        ? Math.max(0, Math.round(currentTime))
        : Math.round(total)

    const handleSeek = (event) => {
        const el = audioRef.current
        if (!el || !total) return
        const rect = event.currentTarget.getBoundingClientRect()
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
        el.currentTime = ratio * total
        setCurrentTime(el.currentTime)
    }

    return (
        <div className="mt-1 inline-flex max-w-md items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
            <button
                type="button"
                onClick={toggle}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-900 text-white transition hover:bg-black"
                aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
                title={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                )}
            </button>
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <button
                    type="button"
                    onClick={handleSeek}
                    className="group h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
                    aria-label="Seek"
                >
                    <span
                        className="block h-full rounded-full bg-gray-900 transition-[width] duration-150"
                        style={{ width: `${percent}%` }}
                    />
                </button>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1v22" />
                            <path d="M8 5v14" />
                            <path d="M16 5v14" />
                            <path d="M4 9v6" />
                            <path d="M20 9v6" />
                        </svg>
                        Voice
                    </span>
                    <span className="tabular-nums">
                        {String(Math.floor(display / 60)).padStart(2, "0")}:
                        {String(display % 60).padStart(2, "0")}
                    </span>
                </div>
            </div>
            <audio ref={audioRef} src={attachment?.dataUrl} preload="metadata" />
        </div>
    )
}

function Stat({ label, value }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
        </div>
    )
}

export default TeamChatManagerPage
