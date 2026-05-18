import { Router } from "express"
import {
    listBoardCollectionsController,
    createBoardCollectionController,
    updateBoardCollectionController,
    deleteBoardCollectionController,
} from "../controllers/boardCollections.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { requirePermission } from "../middlewares/requirePermission.js"
import { requireFeature } from "../middlewares/requireFeature.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"

const router = Router()

router.get(
    "/board/collections",
    requireAuth,
    requireFeature("crm"),
    requireFeature("crmTasks"),
    requirePermission("board:read"),
    listBoardCollectionsController
)

router.post(
    "/board/collections",
    requireAuth,
    requireFeature("crm"),
    requireFeature("crmTasks"),
    requirePermission("board:manageColumns"),
    createBoardCollectionController
)

router.patch(
    "/board/collections/:id",
    requireAuth,
    requireFeature("crm"),
    requireFeature("crmTasks"),
    requirePermission("board:manageColumns"),
    validateObjectIdParam("id"),
    updateBoardCollectionController
)

router.delete(
    "/board/collections/:id",
    requireAuth,
    requireFeature("crm"),
    requireFeature("crmTasks"),
    requirePermission("board:manageColumns"),
    validateObjectIdParam("id"),
    deleteBoardCollectionController
)

export default router
