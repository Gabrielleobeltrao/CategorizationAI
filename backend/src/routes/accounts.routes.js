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

const router = Router()

router.post(
  "/accounts",
  requireAuth,
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createAccountController
)

router.patch(
  "/accounts/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "account", from: "params", field: "id", assignKey: "account" }),
  updateAccountByIdController
)

router.get(
  "/clients/:clientId/accounts",
  requireAuth,
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listAccountsByClientIdController
)

router.get(
  "/accounts/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "account", from: "params", field: "id", assignKey: "account" }),
  getAccountByIdController
)

export default router
