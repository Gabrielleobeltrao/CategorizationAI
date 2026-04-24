import { Router } from "express"
import {
  createClientController,
  updateClientByIdController,
  listClientsByOfficeIdController,
  getClientByIdController,
  getClientLedgerBootstrapController,
  deleteClientByIdController,
} from "../controllers/clients.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.post(
  "/clients",
  requireAuth,
  requirePermission("clients:create"),
  validateObjectIdBody("officeId"),
  ensureResourceExists({ collection: "offices", from: "body", field: "officeId", assignKey: "office" }),
  createClientController
)

router.patch(
  "/clients/:id",
  requireAuth,
  requirePermission("clients:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  updateClientByIdController
)

router.get(
  "/offices/:officeId/clients",
  requireAuth,
  requirePermission("clients:read"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  listClientsByOfficeIdController
)

router.get(
  "/clients/:id/ledger-bootstrap",
  requireAuth,
  requirePermission("clients:read"),
  requirePermission("accounts:read"),
  requirePermission("categories:read"),
  requirePermission("transactions:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  getClientLedgerBootstrapController
)

router.get(
  "/clients/:id",
  requireAuth,
  requirePermission("clients:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  getClientByIdController
)

router.delete(
  "/clients/:id",
  requireAuth,
  requirePermission("clients:delete"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  deleteClientByIdController
)

export default router
