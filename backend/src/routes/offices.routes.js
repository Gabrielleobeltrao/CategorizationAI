import { Router } from "express"
import {
  createOfficeController,
  deleteOfficeTagController,
  updateOfficeByIdController,
  getOfficeByIdController,
  getOfficeDashboardByIdController,
  listOfficeTagsController,
  setOfficeFeaturesController,
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

router.patch(
  "/offices/:id/features",
  requireAuth,
  requirePermission("offices:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  setOfficeFeaturesController
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

router.get(
  "/offices/:id/tags",
  requireAuth,
  requirePermission("offices:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  listOfficeTagsController
)

router.delete(
  "/offices/:id/tags",
  requireAuth,
  requirePermission("offices:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  deleteOfficeTagController
)

export default router
