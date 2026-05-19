import { Router } from "express"
import { getChartOfAccountsController } from "../controllers/chartOfAccounts.controller.js"
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

export default router
