import { Router } from "express"
import {
  createOfficeController,
  updateOfficeByIdController,
  getOfficeByIdController,
} from "../controllers/office.controller.js"

const router = Router()

router.post("/offices", createOfficeController)
router.patch("/offices/:id", updateOfficeByIdController)
router.get("/offices/:id", getOfficeByIdController)

export default router
