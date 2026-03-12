import { Router } from "express"
import {
  createClientController,
  updateClientByIdController,
  listClientsByOfficeIdController,
  getClientByIdController,
} from "../controllers/clients.controller.js"

const router = Router()

router.post("/clients", createClientController)
router.patch("/clients/:id", updateClientByIdController)
router.get("/offices/:officeId/clients", listClientsByOfficeIdController)
router.get("/clients/:id", getClientByIdController)

export default router
