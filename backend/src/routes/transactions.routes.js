import { Router } from "express"
import {
  createTransactionsBatchController,
  updateTransactionByIdController,
  listTransactionsPaginatedController,
} from "../controllers/transactions.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdQuery,
  validateTransactionsBatchIds,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

router.post(
  "/transactions/batch",
  requireAuth,
  validateTransactionsBatchIds,
  createTransactionsBatchController
)

router.patch(
  "/transactions/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "transactions", from: "params", field: "id", assignKey: "transaction" }),
  updateTransactionByIdController
)

router.get(
  "/transactions",
  requireAuth,
  validateObjectIdQuery("clientId"),
  ensureResourceExists({ collection: "clients", from: "query", field: "clientId", assignKey: "client" }),
  listTransactionsPaginatedController
)

export default router
