import { AppError } from "../utils/appError.js"
import {
  getOrCreateDmConversation,
  createGroupConversation,
  getConversationById,
  listConversationsForUser,
  userCanAccessConversation,
  listMessagesByConversation,
  createMessage,
  updateMessage,
  deleteMessage,
  getMessageById,
  deleteConversation,
  setGroupMembers,
  setConversationRead,
  listReadsForConversations,
  listAllConversationsByOffice,
  countMessagesByConversation,
  listFileAttachmentIdsByConversation,
} from "../repositories/chat.repository.js"
import { deleteChatFile, deleteChatFilesSilently, getChatFileMetadata } from "../repositories/chatFiles.repository.js"
import { getProfilesByIds, getUserProfileById } from "../repositories/userProfile.repository.js"

const MAX_MESSAGE_LENGTH = 2000

function ensureSameOffice(message, actorOfficeId) {
  const officeId = String(actorOfficeId || "").trim()
  if (!officeId) throw new AppError("Office context required", 400)
  if (String(message?.officeId || "") !== officeId) {
    throw new AppError("Message not found", 404)
  }
}

function ensureCanModifyMessage(message, actorId) {
  const me = String(actorId || "").trim()
  if (me && me === String(message?.authorId || "")) return
  throw new AppError("You can only modify your own messages", 403)
}

function ensureCanAccessConversation(conversation, userId) {
  if (!conversation) throw new AppError("Conversation not found", 404)
  if (!userCanAccessConversation(conversation, userId)) {
    throw new AppError("Forbidden conversation", 403)
  }
}

// Returns conversations with display metadata resolved for the UI:
// - DMs include the "other" participant's name (for the list and header)
// - groups carry their stored name
export async function listConversationsService({ officeId, actorId }) {
  if (!officeId) throw new AppError("officeId is required", 400)
  if (!actorId) throw new AppError("actorId is required", 400)

  const conversations = await listConversationsForUser(officeId, actorId)

  // Resolve names for DM partners + group members in one batch. We only need
  // names that are not the current actor; the UI builds member-count strings
  // from the resolved set.
  const otherIds = new Set()
  for (const conv of conversations) {
    if (conv.type === "team") continue
    for (const memberId of conv.memberIds || []) {
      if (String(memberId) !== String(actorId)) otherIds.add(String(memberId))
    }
  }
  const profiles = otherIds.size > 0 ? await getProfilesByIds([...otherIds]) : []
  const profileById = new Map(profiles.map((p) => [String(p._id), p]))

  // Pull read receipts for all visible conversations in a single roundtrip,
  // then bucket by conversation so we can attach a per-user map (used by the
  // UI to render "Seen" indicators on DMs).
  const readsAll = await listReadsForConversations(conversations.map((c) => c._id))
  const readsByConv = new Map()
  for (const row of readsAll) {
    const key = String(row.conversationId)
    if (!readsByConv.has(key)) readsByConv.set(key, {})
    readsByConv.get(key)[String(row.userId)] = row.lastReadAt
  }

  return conversations.map((conv) => {
    const readsByUser = readsByConv.get(String(conv._id)) || {}
    if (conv.type === "group") {
      // For groups we attach a small directory of member info so the UI can
      // show roles in the manage view + author chips without extra fetches.
      const members = (conv.memberIds || []).map((id) => {
        const profile = profileById.get(String(id))
        return {
          id: String(id),
          name: profile?.name || "",
          email: profile?.email || "",
          role: profile?.role || "",
        }
      })
      return {
        ...conv,
        displayName: String(conv.name || "Group"),
        otherUserId: null,
        members,
        readsByUser,
      }
    }
    const otherId = (conv.memberIds || []).find((m) => String(m) !== String(actorId))
    const other = otherId ? profileById.get(String(otherId)) : null
    return {
      ...conv,
      displayName: other?.name || other?.email || "Unknown user",
      otherUserId: otherId ? String(otherId) : null,
      otherUserRole: other?.role || "",
      readsByUser,
    }
  })
}

export async function createGroupConversationService({ officeId, actorId, name, memberIds }) {
  if (!officeId) throw new AppError("officeId is required", 400)
  if (!actorId) throw new AppError("Authentication required", 401)
  const safeName = String(name || "").trim()
  if (!safeName) throw new AppError("group name is required", 400)
  if (safeName.length > 80) throw new AppError("group name must be 80 characters or fewer", 400)
  const ids = Array.isArray(memberIds) ? memberIds.map((id) => String(id || "").trim()).filter(Boolean) : []
  if (ids.length === 0) throw new AppError("pick at least one other member", 400)

  // Make sure every picked member is in the same office. Cheap to verify
  // since users will rarely create groups with many strangers.
  const safeOfficeId = String(officeId).trim()
  const profiles = await getProfilesByIds(ids)
  for (const id of ids) {
    const profile = profiles.find((p) => String(p._id) === String(id))
    if (!profile || String(profile.officeId || "") !== safeOfficeId) {
      throw new AppError("All members must belong to your office", 400)
    }
  }
  // Sanity check: the creator must also be in this office.
  const creator = await getUserProfileById(actorId)
  if (!creator || String(creator.officeId || "") !== safeOfficeId) {
    throw new AppError("Office context required", 403)
  }

  return createGroupConversation(safeOfficeId, {
    name: safeName,
    memberIds: ids,
    createdBy: actorId,
  })
}

export async function openDmConversationService({ officeId, actorId, withUserId }) {
  if (!officeId) throw new AppError("officeId is required", 400)
  if (!actorId) throw new AppError("actorId is required", 400)
  if (!withUserId) throw new AppError("withUserId is required", 400)
  if (String(withUserId) === String(actorId)) {
    throw new AppError("You can't open a DM with yourself", 400)
  }
  return getOrCreateDmConversation(officeId, actorId, withUserId)
}

export async function listConversationMessagesService({ conversationId, actorId, actorOfficeId, limit, since }) {
  if (!conversationId) throw new AppError("conversationId is required", 400)
  const conv = await getConversationById(conversationId)
  ensureSameOffice(conv, actorOfficeId)
  ensureCanAccessConversation(conv, actorId)
  const messages = await listMessagesByConversation(conversationId, { limit, since })
  return messages.slice().reverse()
}

// Hard cap for the inline base64 audio payload to keep Mongo documents
// reasonably small. ~1.6MB of base64 ≈ 1.2MB raw audio, which fits ~2 min of
// opus voice notes at typical bitrates (paired with a 2MB JSON body limit).
const MAX_ATTACHMENT_BYTES = 1_600_000

async function validateAttachment(attachment) {
  if (!attachment) return null
  if (attachment.type === "audio") {
    const dataUrl = String(attachment.dataUrl || "")
    if (!dataUrl.startsWith("data:")) {
      throw new AppError("attachment.dataUrl must be a data URL", 400)
    }
    if (dataUrl.length > MAX_ATTACHMENT_BYTES) {
      throw new AppError("Voice note exceeds the 2 min / 1.5MB limit", 413)
    }
    return {
      type: "audio",
      dataUrl,
      duration: Number(attachment.duration) || 0,
      mimeType: String(attachment.mimeType || "audio/webm"),
    }
  }
  if (attachment.type === "file") {
    const fileId = String(attachment.fileId || "").trim()
    if (!fileId) throw new AppError("attachment.fileId is required", 400)
    // Confirm the GridFS file actually exists before we accept the message.
    const meta = await getChatFileMetadata(fileId)
    if (!meta) throw new AppError("Uploaded file not found", 404)
    return {
      type: "file",
      fileId,
      name: String(attachment.name || meta.filename || "file"),
      size: Number(meta.length || attachment.size) || 0,
      mimeType: String(attachment.mimeType || meta.contentType || "application/octet-stream"),
      expiresAt: meta?.metadata?.expiresAt || null,
    }
  }
  throw new AppError("Unsupported attachment type", 400)
}

export async function sendConversationMessageService({ conversationId, actorId, actorName, actorOfficeId, body, attachment }) {
  if (!conversationId) throw new AppError("conversationId is required", 400)
  if (!actorId) throw new AppError("Authentication required", 401)
  const safeBody = String(body || "").trim()
  const safeAttachment = await validateAttachment(attachment)
  if (!safeBody && !safeAttachment) {
    throw new AppError("body or attachment is required", 400)
  }
  if (safeBody.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`body must be ${MAX_MESSAGE_LENGTH} characters or fewer`, 400)
  }
  const conv = await getConversationById(conversationId)
  ensureSameOffice(conv, actorOfficeId)
  ensureCanAccessConversation(conv, actorId)
  const message = await createMessage({
    conversationId,
    officeId: conv.officeId,
    authorId: actorId,
    authorName: actorName,
    body: safeBody,
    attachment: safeAttachment,
  })
  // Sending implicitly marks the conversation read for the author.
  await setConversationRead(conversationId, actorId, message.createdAt)
  return message
}

// ── Admin (chat:manage) ────────────────────────────────────────────────────

export async function listAllConversationsService({ officeId }) {
  if (!officeId) throw new AppError("officeId is required", 400)
  const conversations = await listAllConversationsByOffice(officeId)

  // Resolve every participant in one batch so we can label members on the
  // admin page without N+1 queries.
  const memberIds = new Set()
  for (const conv of conversations) {
    for (const id of conv.memberIds || []) memberIds.add(String(id))
  }
  const profiles = memberIds.size > 0 ? await getProfilesByIds([...memberIds]) : []
  const profileById = new Map(profiles.map((p) => [String(p._id), p]))

  const counts = await countMessagesByConversation(conversations.map((c) => c._id))

  return conversations.map((conv) => {
    const members = (conv.memberIds || []).map((id) => {
      const profile = profileById.get(String(id))
      return {
        id: String(id),
        name: profile?.name || "",
        email: profile?.email || "",
        role: profile?.role || "",
      }
    })
    let displayName = conv.name || ""
    if (!displayName && conv.type === "dm") {
      displayName = members.map((m) => m.name || m.email || "Unknown").join(" ↔ ")
    }
    return {
      ...conv,
      members,
      displayName,
      messageCount: counts.get(String(conv._id)) || 0,
    }
  })
}

export async function adminListMessagesService({ conversationId, actorOfficeId, limit }) {
  if (!conversationId) throw new AppError("conversationId is required", 400)
  const conv = await getConversationById(conversationId)
  ensureSameOffice(conv, actorOfficeId)
  const messages = await listMessagesByConversation(conversationId, { limit })
  return { conversation: conv, messages: messages.slice().reverse() }
}

export async function adminDeleteConversationService({ conversationId, actorOfficeId }) {
  if (!conversationId) throw new AppError("conversationId is required", 400)
  const conv = await getConversationById(conversationId)
  ensureSameOffice(conv, actorOfficeId)
  const fileIds = await listFileAttachmentIdsByConversation(conversationId)
  await deleteConversation(conversationId)
  if (fileIds.length > 0) await deleteChatFilesSilently(fileIds)
  return { ok: true }
}

export async function markConversationReadService({ conversationId, actorId, actorOfficeId }) {
  if (!conversationId) throw new AppError("conversationId is required", 400)
  if (!actorId) throw new AppError("Authentication required", 401)
  const conv = await getConversationById(conversationId)
  ensureSameOffice(conv, actorOfficeId)
  ensureCanAccessConversation(conv, actorId)
  const now = new Date()
  await setConversationRead(conversationId, actorId, now)
  return { lastReadAt: now }
}

export async function updateConversationMessageService({ id, body, actorId, actorOfficeId }) {
  if (!id) throw new AppError("id is required", 400)
  const existing = await getMessageById(id)
  if (!existing) throw new AppError("Message not found", 404)
  ensureSameOffice(existing, actorOfficeId)
  ensureCanModifyMessage(existing, actorId)
  const conv = await getConversationById(existing.conversationId)
  ensureCanAccessConversation(conv, actorId)
  const safeBody = String(body || "").trim()
  if (!safeBody) throw new AppError("body is required", 400)
  if (safeBody.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`body must be ${MAX_MESSAGE_LENGTH} characters or fewer`, 400)
  }
  return updateMessage(id, { body: safeBody })
}

export async function deleteConversationService({ conversationId, actorId, actorOfficeId }) {
  if (!conversationId) throw new AppError("conversationId is required", 400)
  const conv = await getConversationById(conversationId)
  ensureSameOffice(conv, actorOfficeId)
  ensureCanAccessConversation(conv, actorId)
  if (conv.type === "team") {
    throw new AppError("Team channel cannot be deleted", 400)
  }
  const fileIds = await listFileAttachmentIdsByConversation(conversationId)
  await deleteConversation(conversationId)
  if (fileIds.length > 0) await deleteChatFilesSilently(fileIds)
  return { ok: true }
}

export async function updateGroupMembersService({ conversationId, actorId, actorOfficeId, memberIds }) {
  if (!conversationId) throw new AppError("conversationId is required", 400)
  const conv = await getConversationById(conversationId)
  ensureSameOffice(conv, actorOfficeId)
  ensureCanAccessConversation(conv, actorId)
  if (conv.type !== "group") {
    throw new AppError("Only groups support member management", 400)
  }

  const ids = Array.from(new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ))
  if (ids.length < 2) {
    throw new AppError("a group needs at least 2 members", 400)
  }

  // Validate every member belongs to the same office.
  const profiles = await getProfilesByIds(ids)
  const safeOfficeId = String(actorOfficeId).trim()
  for (const id of ids) {
    const profile = profiles.find((p) => String(p._id) === String(id))
    if (!profile || String(profile.officeId || "") !== safeOfficeId) {
      throw new AppError("All members must belong to your office", 400)
    }
  }

  return setGroupMembers(conversationId, ids)
}

export async function deleteConversationMessageService({ id, actorId, actorOfficeId }) {
  if (!id) throw new AppError("id is required", 400)
  const existing = await getMessageById(id)
  if (!existing) throw new AppError("Message not found", 404)
  ensureSameOffice(existing, actorOfficeId)
  ensureCanModifyMessage(existing, actorId)
  const result = await deleteMessage(id)
  // Drop the GridFS blob if the message had a file attachment.
  if (existing.attachment?.type === "file" && existing.attachment.fileId) {
    await deleteChatFile(existing.attachment.fileId).catch(() => {})
  }
  return result
}
