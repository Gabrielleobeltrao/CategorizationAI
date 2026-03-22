import { Router } from "express"
import { listRolesController } from "../controllers/roles.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"

const router = Router()

router.get("/roles", requireAuth, listRolesController)

export default router

