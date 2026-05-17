import { Router } from "express"
import {
    createTaskController,
    listTasksController,
    getTaskByIdController,
    updateTaskByIdController,
    deleteTaskByIdController,
} from "../controllers/tasks.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { requirePermission } from "../middlewares/requirePermission.js"
import { requireFeature } from "../middlewares/requireFeature.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"

const router = Router()

router.get(
    "/tasks",
    requireAuth,
    requirePermission("tasks:read"),
    requireFeature("crmTasks"),
    listTasksController
)

router.post(
    "/tasks",
    requireAuth,
    requirePermission("tasks:create"),
    requireFeature("crmTasks"),
    createTaskController
)

router.get(
    "/tasks/:id",
    requireAuth,
    requirePermission("tasks:read"),
    requireFeature("crmTasks"),
    validateObjectIdParam("id"),
    getTaskByIdController
)

router.patch(
    "/tasks/:id",
    requireAuth,
    requirePermission("tasks:update"),
    requireFeature("crmTasks"),
    validateObjectIdParam("id"),
    updateTaskByIdController
)

router.delete(
    "/tasks/:id",
    requireAuth,
    requirePermission("tasks:delete"),
    requireFeature("crmTasks"),
    validateObjectIdParam("id"),
    deleteTaskByIdController
)

export default router
