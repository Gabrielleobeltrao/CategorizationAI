import { Router } from "express"
import {
  createClientController,
  updateClientByIdController,
  listClientsByOfficeIdController,
  getClientByIdController,
} from "../controllers/clients.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

router.post(
  "/clients",
  requireAuth,
  validateObjectIdBody("officeId"),
  ensureResourceExists({ collection: "offices", from: "body", field: "officeId", assignKey: "office" }),
  createClientController
)

router.patch(
  "/clients/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  updateClientByIdController
)

router.get(
  "/offices/:officeId/clients",
  requireAuth,
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  listClientsByOfficeIdController
)

router.get(
  "/clients/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "clients", from: "params", field: "id", assignKey: "client" }),
  getClientByIdController
)

export default router
