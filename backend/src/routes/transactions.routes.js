import { Router } from "express"
import {
  createTransactionsBatchController,
  updateTransactionByIdController,
  listTransactionsPaginatedController,
} from "../controllers/transactions.controller.js"

const router = Router()

router.post("/transactions/batch", createTransactionsBatchController)
router.patch("/transactions/:id", updateTransactionByIdController)
router.get("/transactions", listTransactionsPaginatedController)

export default router
