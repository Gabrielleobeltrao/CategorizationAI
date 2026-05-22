import { Router } from "express"
import {
  listReconciliationsController,
  getActiveReconciliationController,
  getOpeningBalanceController,
  startReconciliationController,
  getWorksheetController,
  updateReconciliationController,
  completeReconciliationController,
  reopenReconciliationController,
  cancelReconciliationController,
} from "../controllers/reconciliation.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

// Reads use accounts:read; writes use accounts:write (no dedicated
// reconciliation:* permission yet — can split later).

router.get(
  "/clients/:clientId/reconciliations",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listReconciliationsController,
)

router.get(
  "/clients/:clientId/reconciliations/active",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getActiveReconciliationController,
)

router.get(
  "/clients/:clientId/reconciliations/opening-balance",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getOpeningBalanceController,
)

router.post(
  "/clients/:clientId/reconciliations",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  startReconciliationController,
)

router.get(
  "/reconciliations/:id",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("id"),
  getWorksheetController,
)

router.patch(
  "/reconciliations/:id",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  updateReconciliationController,
)

router.post(
  "/reconciliations/:id/complete",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  completeReconciliationController,
)

router.post(
  "/reconciliations/:id/reopen",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  reopenReconciliationController,
)

router.delete(
  "/reconciliations/:id",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("id"),
  cancelReconciliationController,
)

export default router
