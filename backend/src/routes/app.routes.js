import { Router } from "express"
import { getAppBootstrapController } from "../controllers/app.controller.js"

const router = Router()

router.get("/app/bootstrap", getAppBootstrapController)

export default router
