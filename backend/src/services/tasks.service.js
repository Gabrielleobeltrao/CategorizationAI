import {
    createTask,
    listTasksByOfficeId,
    getTaskById,
    updateTaskById,
    deleteTaskById,
} from "../repositories/tasks.repository.js"

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

    return createTask({
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

    return updateTaskById(id, patch || {}, {
        actorProfileId: String(context?.actorProfileId || "").trim(),
    })
}

export async function deleteTaskByIdService(id, context = {}) {
    if (!id) throw new Error("id is required")
    const existing = await getTaskById(id)
    if (!existing) throw new Error("Task not found")
    ensureSameOffice(existing, context?.actorOfficeId)

    await deleteTaskById(id)
}
