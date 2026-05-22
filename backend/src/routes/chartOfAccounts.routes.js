import { Router } from "express"
import {
  getChartOfAccountsController,
  listCoaPresetsController,
  applyCoaPresetController,
  createCustomCoaPresetController,
  deleteCustomCoaPresetController,
} from "../controllers/chartOfAccounts.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.get(
  "/clients/:clientId/chart-of-accounts",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getChartOfAccountsController,
)

router.get(
  "/coa-presets",
  requireAuth,
  listCoaPresetsController,
)

router.post(
  "/coa-presets",
  requireAuth,
  requirePermission("accounts:write"),
  createCustomCoaPresetController,
)

router.delete(
  "/coa-presets/:id",
  requireAuth,
  requirePermission("accounts:write"),
  deleteCustomCoaPresetController,
)

router.post(
  "/clients/:clientId/chart-of-accounts/apply-preset",
  requireAuth,
  requirePermission("accounts:write"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  applyCoaPresetController,
)

export default router
