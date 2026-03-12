import { Router } from "express"
import {
  createOfficeController,
  updateOfficeByIdController,
  getOfficeByIdController,
} from "../controllers/office.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

router.post("/offices", requireAuth, createOfficeController)

router.patch(
  "/offices/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  updateOfficeByIdController
)

router.get(
  "/offices/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "offices", from: "params", field: "id", assignKey: "office" }),
  getOfficeByIdController
)

export default router
