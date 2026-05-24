import { Router } from "express"
import multer from "multer"
import {
  listConversationsController,
  openDmConversationController,
  createGroupConversationController,
  listConversationMessagesController,
  sendConversationMessageController,
  updateConversationMessageController,
  deleteConversationMessageController,
  deleteConversationController,
  updateGroupMembersController,
  markConversationReadController,
  adminListConversationsController,
  adminListMessagesController,
  adminDeleteConversationController,
  uploadChatFileController,
  downloadChatFileController,
  MAX_CHAT_FILE_BYTES,
} from "../controllers/chat.controller.js"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHAT_FILE_BYTES },
})
import { requireAuth } from "../middlewares/requireAuth.js"
import { requirePermission } from "../middlewares/requirePermission.js"
import { requireFeature } from "../middlewares/requireFeature.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

const chatGuards = [
  requireAuth,
  requireFeature("crmChat"),
]

router.get(
  "/offices/:officeId/chat/conversations",
  ...chatGuards,
  requirePermission("chat:read"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  listConversationsController,
)

router.post(
  "/offices/:officeId/chat/conversations/dm",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  openDmConversationController,
)

router.post(
  "/offices/:officeId/chat/conversations/group",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  createGroupConversationController,
)

router.get(
  "/offices/:officeId/chat/conversations/:conversationId/messages",
  ...chatGuards,
  requirePermission("chat:read"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("conversationId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  listConversationMessagesController,
)

router.post(
  "/offices/:officeId/chat/conversations/:conversationId/read",
  ...chatGuards,
  requirePermission("chat:read"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("conversationId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  markConversationReadController,
)

router.post(
  "/offices/:officeId/chat/conversations/:conversationId/messages",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("conversationId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  sendConversationMessageController,
)

router.patch(
  "/offices/:officeId/chat/messages/:messageId",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("messageId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  updateConversationMessageController,
)

router.delete(
  "/offices/:officeId/chat/conversations/:conversationId",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("conversationId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  deleteConversationController,
)

router.patch(
  "/offices/:officeId/chat/conversations/:conversationId/members",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("conversationId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  updateGroupMembersController,
)

router.delete(
  "/offices/:officeId/chat/messages/:messageId",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("messageId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  deleteConversationMessageController,
)

// File upload / download — backed by GridFS. Upload is multipart and uses
// memory storage; the controller hands the buffer to GridFS. Download
// streams the bytes from GridFS straight back to the client.
router.post(
  "/offices/:officeId/chat/files",
  ...chatGuards,
  requirePermission("chat:send"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  upload.single("file"),
  uploadChatFileController,
)

router.get(
  "/offices/:officeId/chat/files/:fileId",
  ...chatGuards,
  requirePermission("chat:read"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  downloadChatFileController,
)

// Admin (chat:manage) routes — used by the Team Chat Manager page.
router.get(
  "/offices/:officeId/chat/admin/conversations",
  ...chatGuards,
  requirePermission("chat:manage"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  adminListConversationsController,
)

router.get(
  "/offices/:officeId/chat/admin/conversations/:conversationId/messages",
  ...chatGuards,
  requirePermission("chat:manage"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("conversationId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  adminListMessagesController,
)

router.delete(
  "/offices/:officeId/chat/admin/conversations/:conversationId",
  ...chatGuards,
  requirePermission("chat:manage"),
  validateObjectIdParam("officeId"),
  validateObjectIdParam("conversationId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  adminDeleteConversationController,
)

export default router
