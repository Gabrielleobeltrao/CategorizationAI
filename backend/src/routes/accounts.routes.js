import { Router } from "express"
import {
  createAccountController,
  updateAccountByIdController,
  listAccountsByClientIdController,
  getAccountByIdController,
} from "../controllers/account.controller.js"

const router = Router()

router.post("/accounts", createAccountController)
router.patch("/accounts/:id", updateAccountByIdController)
router.get("/clients/:clientId/accounts", listAccountsByClientIdController)
router.get("/accounts/:id", getAccountByIdController)

export default router
