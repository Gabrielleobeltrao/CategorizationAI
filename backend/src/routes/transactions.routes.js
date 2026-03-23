import { Router } from "express"
import {
  createTransactionsBatchController,
  updateTransactionByIdController,
  listTransactionsPaginatedController,
  deleteTransactionByIdController,
} from "../controllers/transactions.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdQuery,
  validateTransactionsBatchIds,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.post(
  "/transactions/batch",
  requireAuth,
  requirePermission("transactions:create"),
  validateTransactionsBatchIds,
  createTransactionsBatchController
)

router.patch(
  "/transactions/:id",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "transactions", from: "params", field: "id", assignKey: "transaction" }),
  updateTransactionByIdController
)

router.get(
  "/transactions",
  requireAuth,
  requirePermission("transactions:read"),
  validateObjectIdQuery("clientId"),
  ensureResourceExists({ collection: "clients", from: "query", field: "clientId", assignKey: "client" }),
  listTransactionsPaginatedController
)

router.delete(
  "/transactions/:id",
  requireAuth,
  requirePermission("transactions:delete"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "transactions", from: "params", field: "id", assignKey: "transaction" }),
  deleteTransactionByIdController
)

export default router
