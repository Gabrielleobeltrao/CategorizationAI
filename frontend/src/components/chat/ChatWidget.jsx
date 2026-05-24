import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../../contexts/auth.context"
import { useNotification } from "../../contexts/notification.context"
import { useFeature } from "../../hooks/useFeature"
import { hasPermission } from "../../utils/permissions"
import { listEmployeesByOfficeId } from "../../services/employees.service"
import ConfirmModal from "../ui/ConfirmModal"
import {
    listConversations,
    openDmConversation,
    createGroupConversation,
    listConversationMessages,
    sendConversationMessage,
    updateChatMessage,
    deleteChatMessage,
    deleteConversation,
    updateGroupMembers,
    markConversationRead,
    uploadChatFile,
    getChatFileDownloadUrl,
} from "../../services/chat.service"
import useAudioRecorder from "../../hooks/useAudioRecorder"
import { fireChatNotification, isInAppPopupsEnabled } from "../../utils/chatNotifications"

const POLL_OPEN_MS = 4000
const POLL_CLOSED_MS = 30000
const LAST_SEEN_STORAGE_KEY = "chat:last-seen-by-conversation"

function readLastSeenMap() {
    if (typeof window === "undefined") return {}
    try {
        const raw = window.localStorage?.getItem(LAST_SEEN_STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
        return {}
    }
}

function writeLastSeenMap(map) {
    if (typeof window === "undefined") return
    try {
        window.localStorage?.setItem(LAST_SEEN_STORAGE_KEY, JSON.stringify(map || {}))
    } catch {
        /* ignore */
    }
}

function formatRole(value) {
    const safe = String(value || "").trim()
    if (!safe) return ""
    return safe
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
}

function formatTime(value) {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    return new Intl.DateTimeFormat("en-US", {
        ...(isToday ? {} : { month: "short", day: "2-digit" }),
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

function ChatWidget() {
    const isCrmEnabled = useFeature("crm")
    const isChatEnabled = useFeature("crmChat")
    const { profile } = useAuth()
    const { error } = useNotification()
    const officeId = String(profile?.officeId || "").trim()
    const currentProfileId = String(profile?._id || profile?.id || "").trim()
    const canRead = hasPermission(profile?.permissions, "chat:read")
    const canSend = hasPermission(profile?.permissions, "chat:send")
    const enabled = Boolean(officeId && isCrmEnabled && isChatEnabled && canRead)

    // "list" | "conversation" | "newDm" | "newGroup" | "manageMembers"
    const [view, setView] = useState("list")
    const [isOpen, setIsOpen] = useState(false)
    const [conversations, setConversations] = useState([])
    const [activeConversationId, setActiveConversationId] = useState(null)
    const [messages, setMessages] = useState([])
    const [employees, setEmployees] = useState([])
    const [draft, setDraft] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editBody, setEditBody] = useState("")
    // Confirmation state for destructive actions (conversation/message delete).
    // We use a single shape with a `kind` so we can reuse one modal.
    const [confirm, setConfirm] = useState(null)
    const [isConfirming, setIsConfirming] = useState(false)
    // Pending file selected for upload before sending.
    const [pendingFile, setPendingFile] = useState(null)
    const fileInputRef = useRef(null)
    const [lastSeenMap, setLastSeenMap] = useState(() => readLastSeenMap())
    const listRef = useRef(null)
    const containerRef = useRef(null)

    const activeConversation = useMemo(
        () => conversations.find((c) => c.id === activeConversationId) || null,
        [conversations, activeConversationId],
    )

    const loadConversations = useCallback(async () => {
        if (!enabled) return []
        try {
            const payload = await listConversations(officeId)
            const items = Array.isArray(payload?.items) ? payload.items : []
            setConversations(items)
            return items
        } catch (err) {
            console.warn("[chat] conversations failed", err?.message || err)
            return []
        }
    }, [enabled, officeId])

    const loadMessages = useCallback(async (conversationId) => {
        if (!enabled || !conversationId) return
        try {
            const payload = await listConversationMessages(officeId, conversationId, { limit: 100 })
            setMessages(Array.isArray(payload?.items) ? payload.items : [])
        } catch (err) {
            console.warn("[chat] messages failed", err?.message || err)
        }
    }, [enabled, officeId])

    // Initial / interval loaders.
    useEffect(() => {
        if (!enabled) return undefined
        loadConversations()
        const interval = setInterval(loadConversations, isOpen ? POLL_OPEN_MS : POLL_CLOSED_MS)
        return () => clearInterval(interval)
    }, [enabled, isOpen, loadConversations])

    useEffect(() => {
        if (!enabled || !activeConversationId || view !== "conversation") return undefined
        loadMessages(activeConversationId)
        const interval = setInterval(() => loadMessages(activeConversationId), POLL_OPEN_MS)
        return () => clearInterval(interval)
    }, [enabled, activeConversationId, view, loadMessages])

    // Employee directory for "New DM" / "New group" / "Manage members"
    // pickers. Loaded once one of those views opens — same data shape,
    // same source.
    useEffect(() => {
        if (!enabled || (view !== "newDm" && view !== "newGroup" && view !== "manageMembers")) return undefined
        let active = true
        listEmployeesByOfficeId(officeId)
            .then((payload) => {
                if (!active) return
                const list = Array.isArray(payload?.items)
                    ? payload.items
                    : Array.isArray(payload)
                        ? payload
                        : []
                // Manage Members needs to show the current user too (so they
                // can leave the group); the create flows don't.
                const filtered = view === "manageMembers"
                    ? list
                    : list.filter((emp) => String(emp._id || emp.id) !== currentProfileId)
                setEmployees(filtered)
            })
            .catch(() => {})
        return () => { active = false }
    }, [enabled, view, officeId, currentProfileId])

    // Auto-scroll to bottom when messages change in the active view.
    useEffect(() => {
        if (view !== "conversation") return
        const el = listRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [view, messages.length])

    // Mark active conversation seen — both locally (badge) and on the server
    // (so the other side can render a "seen" tick on their messages).
    useEffect(() => {
        if (!isOpen || view !== "conversation" || !activeConversationId || messages.length === 0) return
        const latest = messages[messages.length - 1]
        const latestTs = latest?.createdAt ? new Date(latest.createdAt).getTime() : Date.now()
        const prev = Number(lastSeenMap[activeConversationId] || 0)
        if (latestTs > prev) {
            const next = { ...lastSeenMap, [activeConversationId]: latestTs }
            setLastSeenMap(next)
            writeLastSeenMap(next)
        }
        // Fire the server-side read receipt; tolerate failures (not critical).
        markConversationRead(officeId, activeConversationId).catch(() => {})
    }, [isOpen, view, activeConversationId, messages, lastSeenMap, officeId])

    // Click-outside to close. Listen to both mouse and touch so it works on
    // phones; suspended while a confirm modal is open (otherwise clicking
    // the modal would close the chat behind it).
    useEffect(() => {
        if (!isOpen || confirm) return undefined
        const handler = (event) => {
            const root = containerRef.current
            if (!root) return
            if (root.contains(event.target)) return
            setIsOpen(false)
        }
        document.addEventListener("mousedown", handler)
        document.addEventListener("touchstart", handler, { passive: true })
        return () => {
            document.removeEventListener("mousedown", handler)
            document.removeEventListener("touchstart", handler)
        }
    }, [isOpen, confirm])

    const recorder = useAudioRecorder({ maxDurationSec: 120 })

    // Stable ref so the notification effect (declared above the handler) can
    // call the open-conversation logic without TDZ + without re-firing on
    // every render.
    const openConversationRef = useRef(null)

    // In-app chat toasts — render-side popups so the user gets feedback even
    // when the browser's native Notification is blocked or the tab is focused.
    const [chatToasts, setChatToasts] = useState([])
    const dismissChatToast = useCallback((id) => {
        setChatToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])
    const showChatToast = useCallback((toast) => {
        setChatToasts((prev) => [...prev.slice(-2), toast]) // keep at most 3
        // Auto-dismiss after 6s.
        setTimeout(() => dismissChatToast(toast.id), 6000)
    }, [dismissChatToast])

    // Notifications — track per-conversation `lastMessageAt` we've already
    // alerted on. Seeded on first poll to avoid notifying about every
    // historical unread on app load.
    const notifiedRef = useRef(null)
    useEffect(() => {
        if (!enabled || !conversations.length) return
        if (!notifiedRef.current) {
            // First load — record current state without firing.
            notifiedRef.current = new Map(
                conversations.map((c) => [c.id, c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0]),
            )
            return
        }
        const prev = notifiedRef.current
        for (const conv of conversations) {
            const lastTs = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0
            const prevTs = Number(prev.get(conv.id) || 0)
            if (lastTs > prevTs) {
                const isViewing = isOpen && view === "conversation" && conv.id === activeConversationId
                if (!isViewing) {
                    fireChatNotification({
                        title: conv.displayName || "New message",
                        body: conv.type === "group" ? "New message in group" : "New message",
                        tag: `chat:${conv.id}`,
                        onClick: () => openConversationRef.current?.(conv.id),
                    })
                    if (isInAppPopupsEnabled()) {
                        showChatToast({
                            id: `${conv.id}-${lastTs}`,
                            convId: conv.id,
                            title: conv.displayName || "New message",
                            body: conv.type === "group" ? "New message in group" : "New message",
                            type: conv.type,
                        })
                    }
                }
                prev.set(conv.id, lastTs)
            }
        }
    }, [conversations, isOpen, view, activeConversationId, enabled, showChatToast])

    if (!enabled) return null

    // Compute unread per conversation; the badge sums them.
    const unreadByConversation = new Map()
    for (const conv of conversations) {
        const since = Number(lastSeenMap[conv.id] || 0)
        const lastMsg = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0
        if (lastMsg > since) unreadByConversation.set(conv.id, true)
    }
    const totalUnread = unreadByConversation.size

    const openConversation = async (conversationId) => {
        setIsOpen(true)
        setActiveConversationId(conversationId)
        setView("conversation")
        setMessages([])
        await loadMessages(conversationId)
    }
    openConversationRef.current = openConversation

    const backToList = () => {
        setView("list")
        setActiveConversationId(null)
        setMessages([])
        setEditingId(null)
    }

    const handleSend = async (event) => {
        event?.preventDefault?.()
        const body = draft.trim()
        if (!body || isSending || !canSend || !activeConversationId) return
        setIsSending(true)
        try {
            const created = await sendConversationMessage(officeId, activeConversationId, body)
            setMessages((prev) => [...prev, created])
            setDraft("")
            // Refresh conversations so lastMessageAt is fresh (sorting).
            loadConversations()
        } catch (err) {
            error(err?.message || "Failed to send")
        } finally {
            setIsSending(false)
        }
    }

    const handleStartRecording = async () => {
        if (!canSend || !activeConversationId || isSending) return
        try {
            await recorder.start()
        } catch (err) {
            error(err?.message || "Microphone access denied")
        }
    }

    const handleSendRecording = async () => {
        if (!activeConversationId) return
        const result = await recorder.stopAndCapture()
        if (!result) return
        setIsSending(true)
        try {
            const created = await sendConversationMessage(officeId, activeConversationId, "", {
                attachment: {
                    type: "audio",
                    dataUrl: result.dataUrl,
                    duration: result.duration,
                    mimeType: result.mimeType,
                },
            })
            setMessages((prev) => [...prev, created])
            loadConversations()
        } catch (err) {
            error(err?.message || "Failed to send voice message")
        } finally {
            setIsSending(false)
        }
    }

    const handleCancelRecording = () => {
        recorder.cancel()
    }

    const handlePickFile = () => {
        if (!canSend || !activeConversationId || isSending) return
        fileInputRef.current?.click()
    }

    const handleFileSelected = (event) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file) return
        setPendingFile(file)
    }

    const handleCancelPendingFile = () => {
        setPendingFile(null)
    }

    const handleSendPendingFile = async () => {
        if (!pendingFile || !activeConversationId || isSending) return
        setIsSending(true)
        try {
            const uploaded = await uploadChatFile(officeId, pendingFile)
            const created = await sendConversationMessage(officeId, activeConversationId, draft.trim(), {
                attachment: {
                    type: "file",
                    fileId: uploaded.id,
                    name: uploaded.name,
                    size: uploaded.size,
                    mimeType: uploaded.mimeType,
                    expiresAt: uploaded.expiresAt,
                },
            })
            setMessages((prev) => [...prev, created])
            setDraft("")
            setPendingFile(null)
            loadConversations()
        } catch (err) {
            error(err?.message || "Failed to upload file")
        } finally {
            setIsSending(false)
        }
    }

    const startEdit = (msg) => {
        setEditingId(String(msg.id))
        setEditBody(String(msg.body || ""))
    }
    const cancelEdit = () => {
        setEditingId(null)
        setEditBody("")
    }
    const handleSaveEdit = async (msg) => {
        const body = editBody.trim()
        if (!body) return
        try {
            const updated = await updateChatMessage(officeId, msg.id, body)
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)))
            cancelEdit()
        } catch (err) {
            error(err?.message || "Failed to update message")
        }
    }
    const handleDelete = (msg) => {
        setConfirm({
            kind: "message",
            messageId: String(msg.id),
            title: "Delete message",
            message: "This message will be removed for everyone in the conversation.",
            confirmLabel: "Delete message",
        })
    }

    const handleOpenDm = async (employeeId) => {
        try {
            const conv = await openDmConversation(officeId, employeeId)
            await loadConversations()
            await openConversation(conv.id)
        } catch (err) {
            error(err?.message || "Failed to open DM")
        }
    }

    const handleCreateGroup = async ({ name, memberIds }) => {
        try {
            const conv = await createGroupConversation(officeId, { name, memberIds })
            await loadConversations()
            await openConversation(conv.id)
        } catch (err) {
            error(err?.message || "Failed to create group")
        }
    }

    const handleDeleteConversation = () => {
        if (!activeConversationId) return
        const isGroup = activeConversation?.type === "group"
        setConfirm({
            kind: "conversation",
            conversationId: activeConversationId,
            title: isGroup ? "Delete this group?" : "Delete this conversation?",
            message: isGroup
                ? "All messages and members will be lost for everyone in the group."
                : "All messages will be lost for both participants.",
            confirmLabel: isGroup ? "Delete group" : "Delete conversation",
        })
    }

    const handleConfirm = async () => {
        if (!confirm) return
        setIsConfirming(true)
        try {
            if (confirm.kind === "conversation") {
                await deleteConversation(officeId, confirm.conversationId)
                setConfirm(null)
                backToList()
                await loadConversations()
            } else if (confirm.kind === "message") {
                await deleteChatMessage(officeId, confirm.messageId)
                setMessages((prev) => prev.filter((m) => String(m.id) !== confirm.messageId))
                setConfirm(null)
            }
        } catch (err) {
            error(err?.message || "Action failed")
        } finally {
            setIsConfirming(false)
        }
    }

    const handleSaveMembers = async (nextMemberIds) => {
        if (!activeConversationId) return
        try {
            const updated = await updateGroupMembers(officeId, activeConversationId, nextMemberIds)
            await loadConversations()
            // If the current user removed themselves, drop them back to the list
            // (they no longer have access).
            const stillMember = Array.isArray(updated?.memberIds)
                ? updated.memberIds.map((m) => String(m)).includes(currentProfileId)
                : false
            if (!stillMember) {
                backToList()
            } else {
                setView("conversation")
            }
        } catch (err) {
            error(err?.message || "Failed to update members")
        }
    }

    const headerTitle = view === "newDm"
        ? "New direct message"
        : view === "newGroup"
            ? "New group"
            : view === "manageMembers"
                ? "Group members"
                : view === "conversation"
                    ? (activeConversation?.displayName || "Conversation")
                    : "Chats"

    const otherRoleLabel = view === "conversation" && activeConversation?.type === "dm"
        ? formatRole(activeConversation?.otherUserRole)
        : ""
    const headerSubtitle = view === "conversation" && activeConversation?.type === "dm"
        ? (otherRoleLabel ? `Direct message · ${otherRoleLabel}` : "Direct message")
        : view === "conversation" && activeConversation?.type === "group"
            ? `Group · ${(activeConversation?.memberIds || []).length} members`
            : view === "manageMembers"
                ? "Tick to include · uncheck yourself to leave"
                : view === "list"
                    ? `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`
                    : view === "newGroup"
                        ? "Name it and pick members"
                        : "Pick a coworker"

    return (
        <div className="pointer-events-none fixed inset-0 z-40">
            <div
                ref={containerRef}
                className="pointer-events-auto absolute bottom-4 right-4 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                {isOpen && (
                    <div className="flex h-[calc(100dvh-7rem)] w-[calc(100vw-2rem)] max-w-96 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-96">
                        <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-900 px-4 py-3 text-white">
                            {view !== "list" && (
                                <button
                                    type="button"
                                    onClick={backToList}
                                    className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                                    aria-label="Back"
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m15 18-6-6 6-6" />
                                    </svg>
                                </button>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{headerTitle}</p>
                                <p className="truncate text-[11px] text-gray-300">{headerSubtitle}</p>
                            </div>
                            {view === "conversation" && activeConversation?.type === "group" && canSend && (
                                <button
                                    type="button"
                                    onClick={() => setView("manageMembers")}
                                    className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                                    title="Manage members"
                                    aria-label="Manage members"
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    </svg>
                                </button>
                            )}
                            {view === "conversation" && canSend && (
                                <button
                                    type="button"
                                    onClick={handleDeleteConversation}
                                    className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-rose-300"
                                    title="Delete conversation"
                                    aria-label="Delete conversation"
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                    </svg>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                                aria-label="Close chat"
                            >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        </header>

                        {view === "list" && (
                            <ConversationList
                                conversations={conversations}
                                unreadByConversation={unreadByConversation}
                                onSelect={openConversation}
                                onNewDm={() => setView("newDm")}
                                onNewGroup={() => setView("newGroup")}
                            />
                        )}

                        {view === "newDm" && (
                            <NewDmList
                                employees={employees}
                                onPick={handleOpenDm}
                            />
                        )}

                        {view === "newGroup" && (
                            <NewGroupForm
                                employees={employees}
                                onCreate={handleCreateGroup}
                            />
                        )}

                        {view === "manageMembers" && activeConversation?.type === "group" && (
                            <ManageMembersForm
                                employees={employees}
                                currentMemberIds={activeConversation?.memberIds || []}
                                currentProfileId={currentProfileId}
                                onSave={handleSaveMembers}
                                onCancel={() => setView("conversation")}
                            />
                        )}

                        {view === "conversation" && (
                            <>
                                <div ref={listRef} className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3">
                                    {messages.length === 0 ? (
                                        <p className="mt-10 text-center text-sm text-gray-500">
                                            Be the first to say something.
                                        </p>
                                    ) : (
                                        <ul className="flex flex-col gap-2">
                                            {messages.map((msg) => {
                                                const isMine = String(msg.authorId) === currentProfileId
                                                const editing = editingId === String(msg.id)
                                                const showAuthor = !isMine && activeConversation?.type !== "dm"
                                                return (
                                                    <li key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                                        <div className={`group max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                                            isMine ? "bg-gray-900 text-white" : "bg-white text-gray-900 border border-gray-100"
                                                        }`}>
                                                            {showAuthor && (
                                                                <p className="mb-0.5 text-[11px] font-medium text-gray-500">
                                                                    {msg.authorName || "Unknown"}
                                                                    {(() => {
                                                                        if (activeConversation?.type !== "group") return null
                                                                        const member = (activeConversation?.members || []).find((m) => String(m.id) === String(msg.authorId))
                                                                        const roleLabel = formatRole(member?.role)
                                                                        if (!roleLabel) return null
                                                                        return <span className="ml-1 text-gray-400">· {roleLabel}</span>
                                                                    })()}
                                                                </p>
                                                            )}
                                                            {editing ? (
                                                                <div className="flex w-60 flex-col gap-2 sm:w-72">
                                                                    <textarea
                                                                        value={editBody}
                                                                        onChange={(e) => setEditBody(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Escape") cancelEdit()
                                                                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveEdit(msg)
                                                                        }}
                                                                        rows={3}
                                                                        autoFocus
                                                                        className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                                                                    />
                                                                    <div className="flex justify-end gap-1.5">
                                                                        <button
                                                                            type="button"
                                                                            onClick={cancelEdit}
                                                                            className={`rounded-md px-2 py-1 text-[12px] font-medium transition ${
                                                                                isMine
                                                                                    ? "text-gray-300 hover:bg-white/10 hover:text-white"
                                                                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                                                            }`}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSaveEdit(msg)}
                                                                            disabled={!editBody.trim()}
                                                                            className={`rounded-md px-2 py-1 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                                                                isMine
                                                                                    ? "bg-white text-gray-900 hover:bg-gray-100"
                                                                                    : "bg-gray-900 text-white hover:bg-black"
                                                                            }`}
                                                                        >
                                                                            Save
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {msg.body && (
                                                                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                                                    )}
                                                                    {msg.attachment?.type === "audio" && (
                                                                        <AudioBubble attachment={msg.attachment} isMine={isMine} />
                                                                    )}
                                                                    {msg.attachment?.type === "file" && (
                                                                        <FileBubble
                                                                            attachment={msg.attachment}
                                                                            isMine={isMine}
                                                                            officeId={officeId}
                                                                        />
                                                                    )}
                                                                    <div className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${isMine ? "text-gray-300" : "text-gray-400"}`}>
                                                                        {isMine && canSend && (
                                                                            <span className="mr-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                                                {!msg.attachment && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => startEdit(msg)}
                                                                                        className="grid h-5 w-5 place-items-center rounded text-gray-300 transition hover:bg-white/10 hover:text-white"
                                                                                        aria-label="Edit message"
                                                                                        title="Edit"
                                                                                    >
                                                                                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                            <path d="M12 20h9" />
                                                                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                                                        </svg>
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDelete(msg)}
                                                                                    className="grid h-5 w-5 place-items-center rounded text-rose-200 transition hover:bg-white/10 hover:text-rose-100"
                                                                                    aria-label="Delete message"
                                                                                    title="Delete"
                                                                                >
                                                                                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                        <path d="M3 6h18" />
                                                                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                                                    </svg>
                                                                                </button>
                                                                            </span>
                                                                        )}
                                                                        <span>
                                                                            {formatTime(msg.createdAt)}
                                                                            {msg.editedAt && " · edited"}
                                                                        </span>
                                                                        {isMine && activeConversation?.type === "dm" && (() => {
                                                                            const otherId = activeConversation?.otherUserId
                                                                            const otherReadAt = otherId
                                                                                ? activeConversation?.readsByUser?.[otherId]
                                                                                : null
                                                                            const seen = otherReadAt
                                                                                && new Date(otherReadAt).getTime() >= new Date(msg.createdAt).getTime()
                                                                            return (
                                                                                <span
                                                                                    className={seen ? "text-sky-300" : "text-gray-400"}
                                                                                    title={seen ? "Seen" : "Sent"}
                                                                                    aria-label={seen ? "Seen" : "Sent"}
                                                                                >
                                                                                    {seen ? (
                                                                                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                                            <path d="M2 13l4 4 8-8" />
                                                                                            <path d="M9 13l4 4 8-8" />
                                                                                        </svg>
                                                                                    ) : (
                                                                                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                                            <path d="M5 13l4 4 10-10" />
                                                                                        </svg>
                                                                                    )}
                                                                                </span>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}
                                </div>

                                {canSend ? (
                                    pendingFile ? (
                                        <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
                                            <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gray-900 text-white">
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                        <path d="M14 2v6h6" />
                                                    </svg>
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-gray-900">{pendingFile.name}</p>
                                                    <p className="text-[11px] text-gray-500">{formatBytes(pendingFile.size)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelPendingFile}
                                                    disabled={isSending}
                                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                                                    aria-label="Remove file"
                                                    title="Remove"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M18 6 6 18" />
                                                        <path d="m6 6 12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendPendingFile}
                                                disabled={isSending}
                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-900 text-white transition hover:bg-black disabled:opacity-50"
                                                aria-label="Send file"
                                                title="Send"
                                            >
                                                {isSending ? (
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 12a9 9 0 1 1-6.2-8.5" />
                                                    </svg>
                                                ) : (
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M5 12h14" />
                                                        <path d="m13 6 6 6-6 6" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    ) : recorder.isRecording ? (
                                        <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
                                            <button
                                                type="button"
                                                onClick={handleCancelRecording}
                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gray-200 text-rose-600 transition hover:bg-rose-50"
                                                aria-label="Cancel recording"
                                                title="Cancel"
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M18 6 6 18" />
                                                    <path d="m6 6 12 12" />
                                                </svg>
                                            </button>
                                            <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                                                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
                                                <span className="font-medium tabular-nums text-gray-900">
                                                    {String(Math.floor(recorder.elapsedSec / 60)).padStart(2, "0")}:
                                                    {String(recorder.elapsedSec % 60).padStart(2, "0")}
                                                </span>
                                                <span className="text-[11px] text-gray-500">
                                                    / {recorder.maxDurationSec}s max
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendRecording}
                                                disabled={isSending}
                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-900 text-white transition hover:bg-black disabled:opacity-50"
                                                aria-label="Send voice message"
                                                title="Send"
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M5 12h14" />
                                                    <path d="m13 6 6 6-6 6" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-gray-100 bg-white p-3">
                                            <textarea
                                                value={draft}
                                                onChange={(e) => setDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !e.shiftKey) {
                                                        e.preventDefault()
                                                        handleSend(e)
                                                    }
                                                }}
                                                rows={1}
                                                placeholder="Write a message…"
                                                className="max-h-24 min-h-[36px] flex-1 resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={handlePickFile}
                                                disabled={isSending}
                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                                                aria-label="Attach file"
                                                title="Attach file"
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                </svg>
                                            </button>
                                            {draft.trim() ? (
                                                <button
                                                    type="submit"
                                                    disabled={isSending}
                                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-900 text-white transition hover:bg-black disabled:opacity-50"
                                                    aria-label="Send"
                                                    title="Send"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M5 12h14" />
                                                        <path d="m13 6 6 6-6 6" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleStartRecording}
                                                    disabled={isSending}
                                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                                                    aria-label="Record voice message"
                                                    title="Hold to record"
                                                >
                                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="9" y="3" width="6" height="12" rx="3" />
                                                        <path d="M5 11a7 7 0 0 0 14 0" />
                                                        <path d="M12 18v3" />
                                                    </svg>
                                                </button>
                                            )}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                hidden
                                                onChange={handleFileSelected}
                                            />
                                        </form>
                                    )
                                ) : (
                                    <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                                        You can read but not send messages.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!isOpen && chatToasts.length > 0 && (
                    <ul className="flex w-72 max-w-full flex-col gap-2">
                        {chatToasts.map((toast) => (
                            <li
                                key={toast.id}
                                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        openConversationRef.current?.(toast.convId)
                                        dismissChatToast(toast.id)
                                    }}
                                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                    aria-label={`Open conversation with ${toast.title}`}
                                >
                                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                                        toast.type === "group" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                                    }`}>
                                        {toast.type === "group" ? (
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="9" cy="7" r="4" />
                                                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                            </svg>
                                        ) : (
                                            (toast.title?.slice(0, 1) || "?").toUpperCase()
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-gray-900">{toast.title}</span>
                                        <span className="block truncate text-[12px] text-gray-500">{toast.body}</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => dismissChatToast(toast.id)}
                                    className="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                    aria-label="Dismiss"
                                >
                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <button
                    type="button"
                    onClick={() => setIsOpen((v) => !v)}
                    className="relative grid h-14 w-14 place-items-center rounded-full bg-gray-900 text-white shadow-xl transition hover:scale-105 hover:bg-black"
                    aria-label={isOpen ? "Close chat" : "Open chat"}
                >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    {!isOpen && totalUnread > 0 && (
                        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
                            {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                    )}
                </button>
            </div>

            <ConfirmModal
                isOpen={Boolean(confirm)}
                title={confirm?.title || "Confirm"}
                message={confirm?.message}
                confirmLabel={confirm?.confirmLabel || "Delete"}
                cancelLabel="Cancel"
                onConfirm={handleConfirm}
                onClose={() => !isConfirming && setConfirm(null)}
                isLoading={isConfirming}
                maxWidthClass="max-w-md"
            />
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

const DOWNLOADED_FILES_KEY = "chat:downloaded-files"

function readDownloadedFiles() {
    if (typeof window === "undefined") return new Set()
    try {
        const raw = window.localStorage?.getItem(DOWNLOADED_FILES_KEY)
        if (!raw) return new Set()
        const parsed = JSON.parse(raw)
        return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
    } catch {
        return new Set()
    }
}

function markFileDownloaded(fileId) {
    if (typeof window === "undefined") return
    try {
        const current = readDownloadedFiles()
        current.add(String(fileId))
        // Cap the set so it doesn't grow indefinitely — keep the most recent 500.
        const trimmed = [...current].slice(-500)
        window.localStorage?.setItem(DOWNLOADED_FILES_KEY, JSON.stringify(trimmed))
        window.dispatchEvent(new CustomEvent("chat:downloaded-file", { detail: { fileId } }))
    } catch {
        /* ignore */
    }
}

function useIsDownloaded(fileId) {
    const [downloaded, setDownloaded] = useState(() => readDownloadedFiles().has(String(fileId)))
    useEffect(() => {
        const handler = (event) => {
            if (event?.detail?.fileId === String(fileId)) setDownloaded(true)
        }
        window.addEventListener("chat:downloaded-file", handler)
        return () => window.removeEventListener("chat:downloaded-file", handler)
    }, [fileId])
    return downloaded
}

function formatExpiry(expiresAt) {
    if (!expiresAt) return null
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (Number.isNaN(ms)) return null
    if (ms <= 0) return { label: "Expired", expired: true }
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    const hours = Math.floor(ms / (60 * 60 * 1000))
    if (days >= 1) return { label: `Expires in ${days}d`, expired: false }
    if (hours >= 1) return { label: `Expires in ${hours}h`, expired: false }
    const mins = Math.max(1, Math.floor(ms / (60 * 1000)))
    return { label: `Expires in ${mins}m`, expired: false }
}

function FileBubble({ attachment, isMine, officeId }) {
    const url = getChatFileDownloadUrl(officeId, attachment.fileId)
    const isImage = String(attachment.mimeType || "").startsWith("image/")
    const inlineUrl = isImage ? getChatFileDownloadUrl(officeId, attachment.fileId, { inline: true }) : null
    const expiry = formatExpiry(attachment.expiresAt)
    const isExpired = Boolean(expiry?.expired)
    const isDownloaded = useIsDownloaded(attachment.fileId)

    const containerBase = "flex items-center gap-2 rounded-lg px-2.5 py-2 transition"
    const containerLight = isExpired
        ? "border border-gray-200 bg-gray-100 opacity-70"
        : "border border-gray-200 bg-white hover:bg-gray-50"
    const containerDark = isExpired
        ? "border border-white/10 bg-white/5 opacity-70"
        : "border border-white/15 bg-white/10 hover:bg-white/20"

    return (
        <div className="mt-1 flex w-72 max-w-full flex-col gap-1.5">
            {isImage && inlineUrl && !isExpired && (
                <a href={inlineUrl} target="_blank" rel="noreferrer">
                    <img
                        src={inlineUrl}
                        alt={attachment.name || "image"}
                        className="max-h-64 w-full rounded-lg object-cover"
                    />
                </a>
            )}
            {isExpired ? (
                <div className={`${containerBase} ${isMine ? containerDark : containerLight}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                        isMine ? "bg-white/30 text-gray-200" : "bg-gray-300 text-gray-600"
                    }`}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 7v5l3 2" />
                        </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[12px] font-medium ${isMine ? "text-gray-200" : "text-gray-600"}`}>
                            {attachment.name || "file"}
                        </span>
                        <span className={`block text-[10px] ${isMine ? "text-gray-400" : "text-gray-500"}`}>
                            File expired
                        </span>
                    </span>
                </div>
            ) : (
                <a
                    href={url}
                    download={attachment.name || "file"}
                    onClick={() => markFileDownloaded(attachment.fileId)}
                    className={`${containerBase} ${isMine ? containerDark : containerLight}`}
                >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                        isMine ? "bg-white text-gray-900" : "bg-gray-900 text-white"
                    }`}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                        </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[12px] font-medium ${isMine ? "text-white" : "text-gray-900"}`}>
                            {attachment.name || "file"}
                        </span>
                        <span className={`flex items-center gap-1.5 text-[10px] ${isMine ? "text-gray-300" : "text-gray-500"}`}>
                            <span>{formatBytes(attachment.size)}</span>
                            {expiry && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span>{expiry.label}</span>
                                </>
                            )}
                        </span>
                    </span>
                    {isDownloaded ? (
                        <svg
                            viewBox="0 0 24 24"
                            className={`h-4 w-4 shrink-0 ${isMine ? "text-white" : "text-gray-900"}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-label="Downloaded"
                        >
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${isMine ? "text-gray-300" : "text-gray-500"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <path d="M7 10l5 5 5-5" />
                            <path d="M12 15V3" />
                        </svg>
                    )}
                </a>
            )}
        </div>
    )
}

function AudioBubble({ attachment, isMine }) {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [audioDuration, setAudioDuration] = useState(0)
    const durationFromMeta = Number(attachment?.duration) || 0

    useEffect(() => {
        const el = audioRef.current
        if (!el) return undefined
        const onTime = () => setCurrentTime(el.currentTime || 0)
        const onEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }
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

    return (
        <div className="mt-1 flex w-72 max-w-full items-center gap-2">
            <button
                type="button"
                onClick={toggle}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
                    isMine ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black"
                }`}
                aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
                title={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                        <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                )}
            </button>
            <div className="flex flex-1 flex-col gap-1">
                <div className={`h-1 w-full overflow-hidden rounded-full ${isMine ? "bg-white/20" : "bg-gray-200"}`}>
                    <div
                        className={`h-full ${isMine ? "bg-white" : "bg-gray-900"}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className={`text-[10px] tabular-nums ${isMine ? "text-gray-300" : "text-gray-500"}`}>
                    {String(Math.floor(display / 60)).padStart(2, "0")}:
                    {String(display % 60).padStart(2, "0")}
                </span>
            </div>
            <audio ref={audioRef} src={attachment?.dataUrl} preload="metadata" />
        </div>
    )
}

function ConversationList({ conversations, unreadByConversation, onSelect, onNewDm, onNewGroup }) {
    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="grid grid-cols-2 gap-2 border-b border-gray-100 p-3">
                <button
                    type="button"
                    onClick={onNewDm}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    New DM
                </button>
                <button
                    type="button"
                    onClick={onNewGroup}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="7" r="4" />
                        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    </svg>
                    New group
                </button>
            </div>
            <ul className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-gray-500">No conversations yet.</li>
                ) : (
                    conversations.map((conv) => {
                        const unread = unreadByConversation.has(conv.id)
                        return (
                            <li key={conv.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(conv.id)}
                                    className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                                >
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
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-gray-900">
                                            <span className="truncate">{conv.displayName}</span>
                                            {conv.type === "dm" && conv.otherUserRole && (
                                                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                                    {formatRole(conv.otherUserRole)}
                                                </span>
                                            )}
                                        </span>
                                        <span className="block truncate text-[11px] text-gray-500">
                                            {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : "No messages yet"}
                                        </span>
                                    </span>
                                    {unread && (
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="Unread" />
                                    )}
                                </button>
                            </li>
                        )
                    })
                )}
            </ul>
        </div>
    )
}

function NewDmList({ employees, onPick }) {
    const [query, setQuery] = useState("")
    const filtered = employees.filter((emp) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        const name = String(emp.name || "").toLowerCase()
        const email = String(emp.email || "").toLowerCase()
        return name.includes(q) || email.includes(q)
    })

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-gray-100 p-3">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search coworkers…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
            </div>
            <ul className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-gray-500">No coworkers found.</li>
                ) : (
                    filtered.map((emp) => {
                        const id = String(emp._id || emp.id)
                        const display = emp.name || emp.email || "Unnamed"
                        const roleLabel = formatRole(emp.role)
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(id)}
                                    className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                                >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                                        {display.slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="truncate text-sm font-medium text-gray-900">{display}</span>
                                            {roleLabel && (
                                                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                                    {roleLabel}
                                                </span>
                                            )}
                                        </span>
                                        {emp.email && emp.name && (
                                            <span className="block truncate text-[11px] text-gray-500">{emp.email}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        )
                    })
                )}
            </ul>
        </div>
    )
}

function NewGroupForm({ employees, onCreate }) {
    const [name, setName] = useState("")
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState(() => new Set())
    const [isSubmitting, setIsSubmitting] = useState(false)

    const filtered = employees.filter((emp) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        const n = String(emp.name || "").toLowerCase()
        const e = String(emp.email || "").toLowerCase()
        return n.includes(q) || e.includes(q)
    })

    const toggle = (id) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const canSubmit = name.trim().length > 0 && selected.size > 0 && !isSubmitting

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!canSubmit) return
        setIsSubmitting(true)
        try {
            await onCreate({ name: name.trim(), memberIds: [...selected] })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-gray-100 p-3">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Group name"
                    maxLength={80}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search coworkers…"
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                {selected.size > 0 && (
                    <p className="mt-2 text-[11px] text-gray-500">
                        {selected.size} selected
                    </p>
                )}
            </div>
            <ul className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-gray-500">No coworkers found.</li>
                ) : (
                    filtered.map((emp) => {
                        const id = String(emp._id || emp.id)
                        const display = emp.name || emp.email || "Unnamed"
                        const roleLabel = formatRole(emp.role)
                        const isChecked = selected.has(id)
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => toggle(id)}
                                    className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition ${
                                        isChecked ? "bg-gray-100" : "hover:bg-gray-50"
                                    }`}
                                >
                                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                                        isChecked ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white"
                                    }`}>
                                        {isChecked && (
                                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M5 12l5 5L20 7" />
                                            </svg>
                                        )}
                                    </span>
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                                        {display.slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="truncate text-sm font-medium text-gray-900">{display}</span>
                                            {roleLabel && (
                                                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                                    {roleLabel}
                                                </span>
                                            )}
                                        </span>
                                        {emp.email && emp.name && (
                                            <span className="block truncate text-[11px] text-gray-500">{emp.email}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        )
                    })
                )}
            </ul>
            <div className="border-t border-gray-100 bg-white p-3">
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? "Creating…" : "Create group"}
                </button>
            </div>
        </form>
    )
}

function ManageMembersForm({ employees, currentMemberIds, currentProfileId, onSave, onCancel }) {
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState(() => new Set((currentMemberIds || []).map(String)))
    const [isSaving, setIsSaving] = useState(false)

    const filtered = employees.filter((emp) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        const n = String(emp.name || "").toLowerCase()
        const e = String(emp.email || "").toLowerCase()
        return n.includes(q) || e.includes(q)
    })

    const toggle = (id) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const isLeaving = !selected.has(currentProfileId) && (currentMemberIds || []).map(String).includes(currentProfileId)
    const canSubmit = selected.size >= 2 && !isSaving
    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!canSubmit) return
        if (isLeaving && typeof window !== "undefined") {
            if (!window.confirm("Remove yourself from the group? You'll lose access immediately.")) return
        }
        setIsSaving(true)
        try {
            await onSave([...selected])
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-gray-100 p-3">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search coworkers…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                <p className="mt-2 text-[11px] text-gray-500">
                    {selected.size} selected {selected.size < 2 && "· need at least 2"}
                </p>
            </div>
            <ul className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-gray-500">No coworkers found.</li>
                ) : (
                    filtered.map((emp) => {
                        const id = String(emp._id || emp.id)
                        const display = emp.name || emp.email || "Unnamed"
                        const roleLabel = formatRole(emp.role)
                        const isChecked = selected.has(id)
                        const isSelf = id === currentProfileId
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => toggle(id)}
                                    className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition ${
                                        isChecked ? "bg-gray-100" : "hover:bg-gray-50"
                                    }`}
                                >
                                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                                        isChecked ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white"
                                    }`}>
                                        {isChecked && (
                                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M5 12l5 5L20 7" />
                                            </svg>
                                        )}
                                    </span>
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                                        {display.slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="truncate text-sm font-medium text-gray-900">
                                                {display}{isSelf && <span className="ml-1 text-gray-500">(you)</span>}
                                            </span>
                                            {roleLabel && (
                                                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                                    {roleLabel}
                                                </span>
                                            )}
                                        </span>
                                        {emp.email && emp.name && (
                                            <span className="block truncate text-[11px] text-gray-500">{emp.email}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        )
                    })
                )}
            </ul>
            <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSaving ? "Saving…" : isLeaving ? "Save & leave" : "Save"}
                </button>
            </div>
        </form>
    )
}

export default ChatWidget
