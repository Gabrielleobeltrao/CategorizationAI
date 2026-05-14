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
    requireFeature("crm"),
    listTasksController
)

router.post(
    "/tasks",
    requireAuth,
    requirePermission("tasks:create"),
    requireFeature("crm"),
    createTaskController
)

router.get(
    "/tasks/:id",
    requireAuth,
    requirePermission("tasks:read"),
    requireFeature("crm"),
    validateObjectIdParam("id"),
    getTaskByIdController
)

router.patch(
    "/tasks/:id",
    requireAuth,
    requirePermission("tasks:update"),
    requireFeature("crm"),
    validateObjectIdParam("id"),
    updateTaskByIdController
)

router.delete(
    "/tasks/:id",
    requireAuth,
    requirePermission("tasks:delete"),
    requireFeature("crm"),
    validateObjectIdParam("id"),
    deleteTaskByIdController
)

export default router
