import {
    createTask,
    listTasksByOfficeId,
    getTaskById,
    updateTaskById,
    deleteTaskById,
    addTaskComment,
    updateTaskComment,
    deleteTaskComment,
} from "../repositories/tasks.repository.js"
import { hasPermissionFromListService } from "./roles.service.js"
import { AppError } from "../utils/appError.js"
import { recordActivity } from "../repositories/activityLog.repository.js"

function ensureSameOffice(task, actorOfficeId) {
    const safeOfficeId = String(actorOfficeId || "").trim()
    if (!safeOfficeId) throw new Error("Office context required")
    if (String(task?.officeId || "") !== safeOfficeId) {
        throw new Error("Forbidden for this office")
    }
}

export async function createTaskService(input, context = {}) {
    const officeId = String(context?.actorOfficeId || "").trim()
    if (!officeId) throw new Error("Office context required")

    const task = await createTask({
        officeId,
        clientIds: input?.clientIds,
        clientId: input?.clientId,
        assigneeIds: input?.assigneeIds,
        assigneeId: input?.assigneeId,
        dueDate: input?.dueDate,
        title: input?.title,
        description: input?.description,
        status: input?.status,
        priority: input?.priority,
        createdBy: String(context?.actorProfileId || "").trim(),
    })

    const taskClientIds = Array.isArray(task?.clientIds) && task.clientIds.length > 0
        ? task.clientIds
        : (task?.clientId ? [String(task.clientId)] : [])

    recordActivity({
        officeId,
        actorId: context?.actorProfileId,
        actorName: context?.actorName,
        action: "task.created",
        targetType: "task",
        targetId: task?._id || task?.id,
        clientId: taskClientIds[0] || null,
        label: String(input?.title || "").trim() || "Task",
    })

    return task
}

export async function listTasksService(query = {}, context = {}) {
    const officeId = String(context?.actorOfficeId || "").trim()
    if (!officeId) throw new Error("Office context required")

    return listTasksByOfficeId(officeId, {
        clientId: query?.clientId,
        assigneeId: query?.assigneeId,
        status: query?.status,
        priority: query?.priority,
        from: query?.from,
        to: query?.to,
    })
}

export async function getTaskByIdService(id, context = {}) {
    if (!id) throw new Error("id is required")
    const task = await getTaskById(id)
    if (!task) throw new Error("Task not found")
    ensureSameOffice(task, context?.actorOfficeId)
    return task
}

export async function updateTaskByIdService(id, patch, context = {}) {
    if (!id) throw new Error("id is required")
    const existing = await getTaskById(id)
    if (!existing) throw new Error("Task not found")
    ensureSameOffice(existing, context?.actorOfficeId)

    const updated = await updateTaskById(id, patch || {}, {
        actorProfileId: String(context?.actorProfileId || "").trim(),
    })

    const prevStatus = String(existing?.status || "").trim()
    const nextStatus = String(updated?.status || "").trim()
    if (nextStatus && prevStatus && prevStatus !== nextStatus) {
        const taskClientIds = Array.isArray(existing?.clientIds) && existing.clientIds.length > 0
            ? existing.clientIds
            : (existing?.clientId ? [String(existing.clientId)] : [])
        recordActivity({
            officeId: existing.officeId,
            actorId: context?.actorProfileId,
            actorName: context?.actorName,
            action: `task.status.${nextStatus}`,
            targetType: "task",
            targetId: id,
            clientId: taskClientIds[0] || null,
            label: String(updated?.title || existing?.title || "Task"),
            meta: { from: prevStatus, to: nextStatus },
        })
    }

    return updated
}

export async function deleteTaskByIdService(id, context = {}) {
    if (!id) throw new Error("id is required")
    const existing = await getTaskById(id)
    if (!existing) throw new Error("Task not found")
    ensureSameOffice(existing, context?.actorOfficeId)

    await deleteTaskById(id)

    const deletedClientIds = Array.isArray(existing?.clientIds) && existing.clientIds.length > 0
        ? existing.clientIds
        : (existing?.clientId ? [String(existing.clientId)] : [])
    recordActivity({
        officeId: existing.officeId,
        actorId: context?.actorProfileId,
        actorName: context?.actorName,
        action: "task.deleted",
        targetType: "task",
        targetId: id,
        clientId: deletedClientIds[0] || null,
        label: String(existing.title || "Task"),
    })
}

export async function addTaskCommentService(taskId, input, context = {}) {
    if (!taskId) throw new Error("taskId is required")
    const body = String(input?.body || "").trim()
    if (!body) throw new Error("comment body is required")

    const existing = await getTaskById(taskId)
    if (!existing) throw new Error("Task not found")
    ensureSameOffice(existing, context?.actorOfficeId)

    const result = await addTaskComment(taskId, {
        body,
        authorId: String(context?.actorProfileId || "").trim(),
        authorName: String(context?.actorName || "").trim(),
    })

    const commentClientIds = Array.isArray(existing?.clientIds) && existing.clientIds.length > 0
        ? existing.clientIds
        : (existing?.clientId ? [String(existing.clientId)] : [])
    recordActivity({
        officeId: existing.officeId,
        actorId: context?.actorProfileId,
        actorName: context?.actorName,
        action: "task.comment.added",
        targetType: "task",
        targetId: taskId,
        clientId: commentClientIds[0] || null,
        label: String(existing.title || "Task"),
    })

    return result
}

// Rule: a user can always update/delete *their own* comment. The
// tasks:commentUpdate / tasks:commentDelete permissions only matter when the
// actor is touching someone else's comment. Routes therefore drop the strict
// requirePermission upfront and we authorize here based on ownership first.
function ensureCommentActionAllowed({ comment, context, permissionKey }) {
    const actorId = String(context?.actorProfileId || "").trim()
    const authorId = String(comment?.authorId || "").trim()
    const isOwner = actorId && authorId && actorId === authorId
    if (isOwner) return
    const permissions = Array.isArray(context?.actorPermissions) ? context.actorPermissions : []
    if (hasPermissionFromListService(permissions, permissionKey)) return
    throw new AppError("Forbidden", 403)
}

export async function updateTaskCommentService(taskId, commentId, input, context = {}) {
    if (!taskId) throw new Error("taskId is required")
    if (!commentId) throw new Error("commentId is required")
    const body = String(input?.body || "").trim()
    if (!body) throw new Error("comment body is required")

    const existing = await getTaskById(taskId)
    if (!existing) throw new Error("Task not found")
    ensureSameOffice(existing, context?.actorOfficeId)

    const comments = Array.isArray(existing?.comments) ? existing.comments : []
    const comment = comments.find((c) => String(c?.id || "") === String(commentId))
    if (!comment) throw new Error("Comment not found")
    ensureCommentActionAllowed({ comment, context, permissionKey: "tasks:commentUpdate" })

    return updateTaskComment(taskId, commentId, { body })
}

export async function deleteTaskCommentService(taskId, commentId, context = {}) {
    if (!taskId) throw new Error("taskId is required")
    if (!commentId) throw new Error("commentId is required")

    const existing = await getTaskById(taskId)
    if (!existing) throw new Error("Task not found")
    ensureSameOffice(existing, context?.actorOfficeId)

    const comments = Array.isArray(existing?.comments) ? existing.comments : []
    const comment = comments.find((c) => String(c?.id || "") === String(commentId))
    if (!comment) throw new Error("Comment not found")
    ensureCommentActionAllowed({ comment, context, permissionKey: "tasks:commentDelete" })

    return deleteTaskComment(taskId, commentId)
}
