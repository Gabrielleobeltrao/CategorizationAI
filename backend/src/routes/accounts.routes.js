import { Router } from "express"
import {
  createAccountController,
  updateAccountByIdController,
  listAccountsByClientIdController,
  getAccountByIdController,
} from "../controllers/account.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.post(
  "/accounts",
  requireAuth,
  requirePermission("accounts:create"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createAccountController
)

router.patch(
  "/accounts/:id",
  requireAuth,
  requirePermission("accounts:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "account", from: "params", field: "id", assignKey: "account" }),
  updateAccountByIdController
)

router.get(
  "/clients/:clientId/accounts",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listAccountsByClientIdController
)

router.get(
  "/accounts/:id",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "account", from: "params", field: "id", assignKey: "account" }),
  getAccountByIdController
)

export default router
