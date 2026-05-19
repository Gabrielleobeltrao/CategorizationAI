import { Router } from "express"
import { getAccountBalancesReportController } from "../controllers/accountBalances.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.get(
  "/clients/:clientId/reports/account-balances",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getAccountBalancesReportController,
)

export default router
