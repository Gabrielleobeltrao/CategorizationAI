import { Router } from "express"
import {
  listRecurringController,
  createRecurringController,
  getRecurringController,
  updateRecurringController,
  deleteRecurringController,
  setRecurringActiveController,
  runRecurringOnceController,
  skipRecurringNextController,
} from "../controllers/recurring.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.get(
  "/clients/:clientId/recurring-entries",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listRecurringController,
)

router.post(
  "/clients/:clientId/recurring-entries",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  createRecurringController,
)

router.get(
  "/recurring-entries/:id",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("id"),
  getRecurringController,
)

router.patch(
  "/recurring-entries/:id",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  updateRecurringController,
)

router.delete(
  "/recurring-entries/:id",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  deleteRecurringController,
)

router.post(
  "/recurring-entries/:id/active",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  setRecurringActiveController,
)

router.post(
  "/recurring-entries/:id/run",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  runRecurringOnceController,
)

router.post(
  "/recurring-entries/:id/skip",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  skipRecurringNextController,
)

export default router
