import { Router } from "express"
import {
  getCurrentStateController,
  getPreCloseChecksController,
  listHistoryController,
  closePeriodController,
  reopenPeriodController,
} from "../controllers/periodClose.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.get(
  "/clients/:clientId/period-close",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getCurrentStateController,
)

router.get(
  "/clients/:clientId/period-close/pre-close-checks",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getPreCloseChecksController,
)

router.get(
  "/clients/:clientId/period-close/history",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listHistoryController,
)

router.post(
  "/clients/:clientId/period-close/close",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  closePeriodController,
)

router.post(
  "/clients/:clientId/period-close/reopen",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  reopenPeriodController,
)

export default router
