import {
  listConversationsService,
  openDmConversationService,
  createGroupConversationService,
  listConversationMessagesService,
  sendConversationMessageService,
  updateConversationMessageService,
  deleteConversationMessageService,
  deleteConversationService,
  updateGroupMembersService,
  markConversationReadService,
  listAllConversationsService,
  adminListMessagesService,
  adminDeleteConversationService,
} from "../services/chat.service.js"
import {
  uploadChatFileBuffer,
  getChatFileMetadata,
  openChatFileDownloadStream,
} from "../repositories/chatFiles.repository.js"
import { sendErrorResponse } from "../utils/httpError.js"

const MAX_CHAT_FILE_BYTES = 100 * 1024 * 1024 // 100MB per file — covers
// year-end consolidated bank statements + scanned bundles. Multer uses
// memoryStorage, so each concurrent upload holds the full file in RAM
// briefly. For a ~10-person office this is fine; if we ever need
// hundreds of simultaneous uploads, switch to disk storage.

function actorName(profile) {
  return (
    String(profile?.name || "").trim() ||
    String(profile?.email || "").trim()
  )
}

function serializeMessage(message) {
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    authorId: String(message.authorId),
    authorName: message.authorName || "",
    body: message.body || "",
    attachment: message.attachment || null,
    createdAt: message.createdAt,
    editedAt: message.editedAt || null,
  }
}

function serializeConversation(conversation) {
  return {
    id: String(conversation._id),
    officeId: String(conversation.officeId),
    type: conversation.type,
    memberIds: (conversation.memberIds || []).map((m) => String(m)),
    members: Array.isArray(conversation.members) ? conversation.members : undefined,
    displayName: conversation.displayName || conversation.name || "",
    otherUserId: conversation.otherUserId || null,
    otherUserRole: conversation.otherUserRole || "",
    readsByUser: conversation.readsByUser || {},
    lastMessageAt: conversation.lastMessageAt || null,
    createdAt: conversation.createdAt,
  }
}

export async function listConversationsController(req, res) {
  try {
    const conversations = await listConversationsService({
      officeId: req.params.officeId,
      actorId: String(req.userProfile?._id || ""),
    })
    return res.status(200).json({ items: conversations.map(serializeConversation) })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function openDmConversationController(req, res) {
  try {
    const conversation = await openDmConversationService({
      officeId: req.params.officeId,
      actorId: String(req.userProfile?._id || ""),
      withUserId: req.body?.withUserId,
    })
    return res.status(200).json(serializeConversation(conversation))
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteConversationController(req, res) {
  try {
    await deleteConversationService({
      conversationId: req.params.conversationId,
      actorId: String(req.userProfile?._id || ""),
      actorOfficeId: req.params.officeId,
    })
    return res.status(204).send()
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateGroupMembersController(req, res) {
  try {
    const conversation = await updateGroupMembersService({
      conversationId: req.params.conversationId,
      actorId: String(req.userProfile?._id || ""),
      actorOfficeId: req.params.officeId,
      memberIds: req.body?.memberIds,
    })
    return res.status(200).json(serializeConversation(conversation))
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function createGroupConversationController(req, res) {
  try {
    const conversation = await createGroupConversationService({
      officeId: req.params.officeId,
      actorId: String(req.userProfile?._id || ""),
      name: req.body?.name,
      memberIds: req.body?.memberIds,
    })
    return res.status(201).json(serializeConversation(conversation))
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listConversationMessagesController(req, res) {
  try {
    const messages = await listConversationMessagesService({
      conversationId: req.params.conversationId,
      actorId: String(req.userProfile?._id || ""),
      actorOfficeId: req.params.officeId,
      limit: Number(req.query?.limit) || 50,
      since: req.query?.since || undefined,
    })
    return res.status(200).json({ items: messages.map(serializeMessage) })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function sendConversationMessageController(req, res) {
  try {
    const message = await sendConversationMessageService({
      conversationId: req.params.conversationId,
      actorId: String(req.userProfile?._id || ""),
      actorName: actorName(req.userProfile),
      actorOfficeId: req.params.officeId,
      body: req.body?.body,
      attachment: req.body?.attachment,
    })
    return res.status(201).json(serializeMessage(message))
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function adminListConversationsController(req, res) {
  try {
    const conversations = await listAllConversationsService({ officeId: req.params.officeId })
    return res.status(200).json({
      items: conversations.map((conv) => ({
        ...serializeConversation(conv),
        members: conv.members || [],
        messageCount: conv.messageCount || 0,
      })),
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function adminListMessagesController(req, res) {
  try {
    const result = await adminListMessagesService({
      conversationId: req.params.conversationId,
      actorOfficeId: req.params.officeId,
      limit: Number(req.query?.limit) || 200,
    })
    return res.status(200).json({
      conversation: serializeConversation(result.conversation),
      items: result.messages.map(serializeMessage),
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function adminDeleteConversationController(req, res) {
  try {
    await adminDeleteConversationService({
      conversationId: req.params.conversationId,
      actorOfficeId: req.params.officeId,
    })
    return res.status(204).send()
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export { MAX_CHAT_FILE_BYTES }

export async function uploadChatFileController(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "file is required" })
    }
    const uploaded = await uploadChatFileBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      metadata: {
        officeId: String(req.params.officeId),
        uploadedBy: String(req.userProfile?._id || ""),
      },
    })
    return res.status(201).json({
      id: uploaded.id,
      name: uploaded.filename,
      size: uploaded.length,
      mimeType: uploaded.contentType,
      expiresAt: uploaded.expiresAt || null,
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function downloadChatFileController(req, res) {
  try {
    const meta = await getChatFileMetadata(req.params.fileId)
    if (!meta) {
      return res.status(404).json({ message: "File not found" })
    }
    // Lock files to the office that owns them.
    if (String(meta.metadata?.officeId || "") !== String(req.params.officeId)) {
      return res.status(404).json({ message: "File not found" })
    }
    const filename = meta.filename || "file"
    const disposition = req.query?.inline === "true" ? "inline" : "attachment"
    res.setHeader("Content-Type", meta.contentType || "application/octet-stream")
    res.setHeader("Content-Length", meta.length)
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(filename)}"`)
    res.setHeader("Cache-Control", "private, max-age=300")
    const stream = openChatFileDownloadStream(req.params.fileId)
    stream.on("error", (err) => {
      if (!res.headersSent) res.status(500).json({ message: err?.message || "Stream failed" })
      else res.end()
    })
    stream.pipe(res)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function markConversationReadController(req, res) {
  try {
    const result = await markConversationReadService({
      conversationId: req.params.conversationId,
      actorId: String(req.userProfile?._id || ""),
      actorOfficeId: req.params.officeId,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateConversationMessageController(req, res) {
  try {
    const updated = await updateConversationMessageService({
      id: req.params.messageId,
      body: req.body?.body,
      actorId: String(req.userProfile?._id || ""),
      actorOfficeId: req.params.officeId,
    })
    return res.status(200).json(serializeMessage(updated))
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteConversationMessageController(req, res) {
  try {
    await deleteConversationMessageService({
      id: req.params.messageId,
      actorId: String(req.userProfile?._id || ""),
      actorOfficeId: req.params.officeId,
    })
    return res.status(204).send()
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
