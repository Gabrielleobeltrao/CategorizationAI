import { Router } from "express"
import {
  getOfficeOverviewController,
  getOfficeMyActivityController,
  getOfficeActivityController,
} from "../controllers/officeOverview.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.get(
  "/offices/:officeId/overview",
  requireAuth,
  requirePermission("clients:read"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  getOfficeOverviewController,
)

router.get(
  "/offices/:officeId/me/activity",
  requireAuth,
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  getOfficeMyActivityController,
)

router.get(
  "/offices/:officeId/activity",
  requireAuth,
  requirePermission("activityLog:read"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  getOfficeActivityController,
)

export default router
