import {
    createTaskService,
    listTasksService,
    getTaskByIdService,
    updateTaskByIdService,
    deleteTaskByIdService,
    addTaskCommentService,
    updateTaskCommentService,
    deleteTaskCommentService,
} from "../services/tasks.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

function buildContext(req) {
    return {
        actorOfficeId: req.userProfile?.officeId,
        actorProfileId: req.userProfile?._id ? String(req.userProfile._id) : "",
        actorName: String(req.userProfile?.name || req.userProfile?.email || ""),
        actorPermissions: Array.isArray(req.userProfile?.permissions) ? req.userProfile.permissions : [],
        actorProfile: req.userProfile,
    }
}

export async function createTaskController(req, res) {
    try {
        const task = await createTaskService(req.body || {}, buildContext(req))
        return res.status(201).json(task)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function listTasksController(req, res) {
    try {
        const tasks = await listTasksService(req.query || {}, buildContext(req))
        return res.status(200).json({ items: tasks })
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function getTaskByIdController(req, res) {
    try {
        const task = await getTaskByIdService(req.params.id, buildContext(req))
        return res.status(200).json(task)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function updateTaskByIdController(req, res) {
    try {
        const task = await updateTaskByIdService(req.params.id, req.body || {}, buildContext(req))
        return res.status(200).json(task)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function deleteTaskByIdController(req, res) {
    try {
        await deleteTaskByIdService(req.params.id, buildContext(req))
        return res.status(204).send()
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function addTaskCommentController(req, res) {
    try {
        const task = await addTaskCommentService(req.params.id, req.body || {}, buildContext(req))
        return res.status(201).json(task)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function updateTaskCommentController(req, res) {
    try {
        const task = await updateTaskCommentService(
            req.params.id,
            req.params.commentId,
            req.body || {},
            buildContext(req),
        )
        return res.status(200).json(task)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function deleteTaskCommentController(req, res) {
    try {
        const task = await deleteTaskCommentService(
            req.params.id,
            req.params.commentId,
            buildContext(req),
        )
        return res.status(200).json(task)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}
