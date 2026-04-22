import { Router } from "express"
import {
  getProfitLossByClientIdController,
  listProfitLossPeriodOptionsByClientIdController,
} from "../controllers/profitLoss.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.get(
  "/clients/:clientId/profit-loss/period-options",
  requireAuth,
  requirePermission("profitLoss:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listProfitLossPeriodOptionsByClientIdController
)

router.get(
  "/clients/:clientId/profit-loss",
  requireAuth,
  requirePermission("profitLoss:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getProfitLossByClientIdController
)

export default router
