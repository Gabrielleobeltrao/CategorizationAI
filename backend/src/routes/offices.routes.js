import { Router } from "express"
import {
  createOfficeController,
  updateOfficeByIdController,
  getOfficeByIdController,
  getOfficeDashboardByIdController,
} from "../controllers/office.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.post("/offices", requireAuth, requirePermission("offices:create"), createOfficeController)

router.patch(
  "/offices/:id",
  requireAuth,
  requirePermission("offices:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  updateOfficeByIdController
)

router.get(
  "/offices/:id",
  requireAuth,
  requirePermission("offices:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  getOfficeByIdController
)

router.get(
  "/offices/:id/dashboard",
  requireAuth,
  requirePermission("offices:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  getOfficeDashboardByIdController
)

export default router
