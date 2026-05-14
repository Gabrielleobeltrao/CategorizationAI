import {
    createTaskService,
    listTasksService,
    getTaskByIdService,
    updateTaskByIdService,
    deleteTaskByIdService,
} from "../services/tasks.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

function buildContext(req) {
    return {
        actorOfficeId: req.userProfile?.officeId,
        actorProfileId: req.userProfile?._id ? String(req.userProfile._id) : "",
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
