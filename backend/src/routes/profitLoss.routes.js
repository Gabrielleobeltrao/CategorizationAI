import { Router } from "express"
import { getProfitLossByClientIdController } from "../controllers/profitLoss.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

router.get(
  "/clients/:clientId/profit-loss",
  requireAuth,
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  getProfitLossByClientIdController
)

export default router
