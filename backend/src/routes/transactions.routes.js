import { Router } from "express"
import {
  createTransactionsBatchController,
  updateTransactionByIdController,
  listTransactionsPaginatedController,
  listTransactionPeriodOptionsController,
  deleteTransactionByIdController,
  categorizeTransactionsWithLlmController,
  categorizeZelleTransactionsController,
  categorizeAllTransactionsWithLlmController,
} from "../controllers/transactions.controller.js"
import {
  createCategorizationJobController,
  getCategorizationJobByIdController,
  listCategorizationJobsController,
} from "../controllers/categorizationJob.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdQuery,
  validateObjectIdBody,
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

router.post(
  "/transactions/categorize-llm",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  categorizeTransactionsWithLlmController
)

router.post(
  "/transactions/categorize-all-llm",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  categorizeAllTransactionsWithLlmController
)

router.post(
  "/transactions/categorize-all-llm/jobs",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createCategorizationJobController
)

router.get(
  "/transactions/categorize-all-llm/jobs",
  requireAuth,
  requirePermission("transactions:read"),
  listCategorizationJobsController
)

router.get(
  "/transactions/categorize-all-llm/jobs/:jobId",
  requireAuth,
  requirePermission("transactions:read"),
  validateObjectIdParam("jobId"),
  getCategorizationJobByIdController
)

router.post(
  "/transactions/categorize-zelle",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  categorizeZelleTransactionsController
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
  "/transactions/filter-options",
  requireAuth,
  requirePermission("transactions:read"),
  validateObjectIdQuery("clientId"),
  ensureResourceExists({ collection: "clients", from: "query", field: "clientId", assignKey: "client" }),
  listTransactionPeriodOptionsController
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
