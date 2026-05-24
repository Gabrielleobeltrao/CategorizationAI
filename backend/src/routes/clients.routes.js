import { Router } from "express"
import {
  createClientController,
  updateClientByIdController,
  listClientsByOfficeIdController,
  getClientByIdController,
  getClientLedgerBootstrapController,
  deleteClientByIdController,
  addClientNoteController,
  updateClientNoteController,
  deleteClientNoteController,
} from "../controllers/clients.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"
import { requireFeature } from "../middlewares/requireFeature.js"
import {
  getClientOperationalStatusController,
  setClientOperationalStatusController,
} from "../controllers/operationalStatus.controller.js"

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

router.get(
  "/clients/:id/operational-status",
  requireAuth,
  requirePermission("clients:read"),
  requireFeature("crmOperationalStatus"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  getClientOperationalStatusController
)

router.patch(
  "/clients/:id/operational-status",
  requireAuth,
  requirePermission("clients:update"),
  requireFeature("crmOperationalStatus"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  setClientOperationalStatusController
)

// Client notes — free-form log entries kept on the client doc. Authors can
// always edit/delete their own; touching someone else's needs
// clientsNotes:update / clientsNotes:delete (enforced in the service).
router.post(
  "/clients/:id/notes",
  requireAuth,
  requirePermission("clients:read"),
  requirePermission("clientsNotes:create"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  addClientNoteController
)

router.patch(
  "/clients/:id/notes/:noteId",
  requireAuth,
  requirePermission("clients:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  updateClientNoteController
)

router.delete(
  "/clients/:id/notes/:noteId",
  requireAuth,
  requirePermission("clients:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  deleteClientNoteController
)

export default router
