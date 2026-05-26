import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const CONVERSATIONS = "chat_conversations"
const MESSAGES = "chat_messages"
const READS = "chat_reads"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const RETENTION_DAYS = 90

export async function ensureChatIndexes() {
  const db = getDB()
  await Promise.all([
    db.collection(CONVERSATIONS).createIndex({ officeId: 1, type: 1 }),
    db.collection(CONVERSATIONS).createIndex({ officeId: 1, memberIds: 1, lastMessageAt: -1 }),
    db.collection(MESSAGES).createIndex({ conversationId: 1, createdAt: -1 }),
    db.collection(MESSAGES).createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 },
    ),
    db.collection(READS).createIndex({ conversationId: 1, userId: 1 }, { unique: true }),
  ])
}

export async function setConversationRead(conversationId, userId, at = new Date()) {
  const db = getDB()
  await db.collection(READS).updateOne(
    { conversationId: String(conversationId), userId: String(userId) },
    { $set: { lastReadAt: at }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
}

export async function listReadsForConversation(conversationId) {
  const db = getDB()
  return db.collection(READS).find({ conversationId: String(conversationId) }).toArray()
}

export async function listReadsForConversations(conversationIds = []) {
  const ids = conversationIds.map((id) => String(id))
  if (ids.length === 0) return []
  const db = getDB()
  return db.collection(READS).find({ conversationId: { $in: ids } }).toArray()
}

function pairKey(a, b) {
  return [String(a), String(b)].sort().join("|")
}

// ── Conversations ──────────────────────────────────────────────────────────

export async function getOrCreateTeamConversation(officeId) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) throw new Error("officeId is required")
  const db = getDB()
  const existing = await db.collection(CONVERSATIONS).findOne({
    officeId: safeOfficeId,
    type: "team",
  })
  if (existing) return existing
  const doc = {
    officeId: safeOfficeId,
    type: "team",
    memberIds: [],
    pairKey: null,
    createdAt: new Date(),
    lastMessageAt: null,
  }
  const result = await db.collection(CONVERSATIONS).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function createGroupConversation(officeId, { name, memberIds, createdBy }) {
  const safeOfficeId = String(officeId || "").trim()
  const safeName = String(name || "").trim()
  if (!safeOfficeId) throw new Error("officeId is required")
  if (!safeName) throw new Error("group name is required")
  const uniqueMembers = Array.from(new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ))
  if (createdBy) {
    const me = String(createdBy).trim()
    if (me && !uniqueMembers.includes(me)) uniqueMembers.push(me)
  }
  if (uniqueMembers.length < 2) {
    throw new Error("a group needs at least 2 members")
  }
  const db = getDB()
  const doc = {
    officeId: safeOfficeId,
    type: "group",
    name: safeName,
    memberIds: uniqueMembers,
    pairKey: null,
    createdBy: createdBy ? String(createdBy) : null,
    createdAt: new Date(),
    lastMessageAt: null,
  }
  const result = await db.collection(CONVERSATIONS).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function getOrCreateDmConversation(officeId, userIdA, userIdB) {
  const safeOfficeId = String(officeId || "").trim()
  const a = String(userIdA || "").trim()
  const b = String(userIdB || "").trim()
  if (!safeOfficeId || !a || !b) throw new Error("officeId and both userIds are required")
  if (a === b) throw new Error("cannot start a DM with yourself")
  const key = pairKey(a, b)
  const db = getDB()
  const existing = await db.collection(CONVERSATIONS).findOne({
    officeId: safeOfficeId,
    type: "dm",
    pairKey: key,
  })
  if (existing) return existing
  const doc = {
    officeId: safeOfficeId,
    type: "dm",
    memberIds: [a, b].sort(),
    pairKey: key,
    createdAt: new Date(),
    lastMessageAt: null,
  }
  const result = await db.collection(CONVERSATIONS).insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function getConversationById(id) {
  const db = getDB()
  return db.collection(CONVERSATIONS).findOne({ _id: new ObjectId(id) })
}

export async function deleteConversation(id) {
  const db = getDB()
  // Cascade: drop the messages so the TTL doesn't leave orphans hanging.
  await db.collection(MESSAGES).deleteMany({ conversationId: String(id) })
  return db.collection(CONVERSATIONS).deleteOne({ _id: new ObjectId(id) })
}

export async function setGroupMembers(id, memberIds) {
  const uniqueMembers = Array.from(new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .map((m) => String(m || "").trim())
      .filter(Boolean),
  ))
  const db = getDB()
  return db.collection(CONVERSATIONS).findOneAndUpdate(
    { _id: new ObjectId(id), type: "group" },
    { $set: { memberIds: uniqueMembers } },
    { returnDocument: "after" },
  )
}

// Lists EVERY conversation in the office. Intended for the chat-manage
// admin view; callers must enforce permission before invoking.
export async function listAllConversationsByOffice(officeId) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) return []
  const db = getDB()
  return db
    .collection(CONVERSATIONS)
    .find({ officeId: safeOfficeId, type: { $in: ["dm", "group"] } })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .toArray()
}

export async function countMessagesByConversation(conversationIds = []) {
  const ids = conversationIds.map((id) => String(id))
  if (ids.length === 0) return new Map()
  const db = getDB()
  const rows = await db.collection(MESSAGES).aggregate([
    { $match: { conversationId: { $in: ids } } },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]).toArray()
  return new Map(rows.map((r) => [String(r._id), r.count]))
}

// Lists conversations visible to the user: the team channel (always) +
// every DM/group they're a member of. Ordered by most recent activity.
export async function listConversationsForUser(officeId, userId) {
  const safeOfficeId = String(officeId || "").trim()
  const safeUserId = String(userId || "").trim()
  if (!safeOfficeId || !safeUserId) return []
  const db = getDB()
  return db
    .collection(CONVERSATIONS)
    .find({
      officeId: safeOfficeId,
      $or: [
        { type: "dm", memberIds: safeUserId },
        { type: "group", memberIds: safeUserId },
      ],
    })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .toArray()
}

export function userCanAccessConversation(conversation, userId) {
  if (!conversation) return false
  if (conversation.type === "dm" || conversation.type === "group") {
    const me = String(userId || "")
    return Array.isArray(conversation.memberIds) && conversation.memberIds.some((m) => String(m) === me)
  }
  return false
}

async function touchConversationLastMessageAt(conversationId, at) {
  const db = getDB()
  await db.collection(CONVERSATIONS).updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { lastMessageAt: at } },
  )
}

// ── Messages ──────────────────────────────────────────────────────────────

export async function listMessagesByConversation(conversationId, { limit = DEFAULT_LIMIT, since } = {}) {
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT))
  const query = { conversationId: String(conversationId) }
  if (since) {
    const sinceDate = new Date(since)
    if (!Number.isNaN(sinceDate.getTime())) query.createdAt = { $gt: sinceDate }
  }
  const db = getDB()
  return db
    .collection(MESSAGES)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .toArray()
}

function normalizeAttachmentForStorage(attachment) {
  if (!attachment) return null
  if (attachment.type === "audio" && attachment.dataUrl) {
    return {
      type: "audio",
      dataUrl: String(attachment.dataUrl),
      duration: Number(attachment.duration) || 0,
      mimeType: String(attachment.mimeType || "audio/webm"),
    }
  }
  if (attachment.type === "file" && attachment.fileId) {
    return {
      type: "file",
      fileId: String(attachment.fileId),
      name: String(attachment.name || "file"),
      size: Number(attachment.size) || 0,
      mimeType: String(attachment.mimeType || "application/octet-stream"),
      expiresAt: attachment.expiresAt || null,
    }
  }
  return null
}

export async function createMessage({ conversationId, officeId, authorId, authorName, body, attachment }) {
  const safeBody = String(body || "").trim()
  const safeAttachment = normalizeAttachmentForStorage(attachment)
  if (!conversationId || !officeId || !authorId) {
    throw new Error("conversationId, officeId, authorId are required")
  }
  if (!safeBody && !safeAttachment) {
    throw new Error("body or attachment is required")
  }
  const doc = {
    conversationId: String(conversationId),
    officeId: String(officeId),
    authorId: String(authorId).trim(),
    authorName: String(authorName || "").trim(),
    body: safeBody,
    attachment: safeAttachment,
    createdAt: new Date(),
    editedAt: null,
  }
  const db = getDB()
  const result = await db.collection(MESSAGES).insertOne(doc)
  await touchConversationLastMessageAt(conversationId, doc.createdAt)
  return { ...doc, _id: result.insertedId }
}

export async function updateMessage(id, { body }) {
  const safeBody = String(body || "").trim()
  if (!safeBody) throw new Error("body cannot be empty")
  const db = getDB()
  return db.collection(MESSAGES).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { body: safeBody, editedAt: new Date() } },
    { returnDocument: "after" },
  )
}

export async function deleteMessage(id) {
  const db = getDB()
  return db.collection(MESSAGES).deleteOne({ _id: new ObjectId(id) })
}

export async function getMessageById(id) {
  const db = getDB()
  return db.collection(MESSAGES).findOne({ _id: new ObjectId(id) })
}

// Used during cascading deletes — returns GridFS file ids attached to every
// message in the conversation so the service can purge them too.
export async function listFileAttachmentIdsByConversation(conversationId) {
  const db = getDB()
  const rows = await db.collection(MESSAGES).find(
    { conversationId: String(conversationId), "attachment.type": "file" },
    { projection: { "attachment.fileId": 1 } },
  ).toArray()
  return rows.map((row) => row.attachment?.fileId).filter(Boolean)
}
