import { Router } from "express"
import { requireAuth } from "../middlewares/requireAuth.js"
import { bootstrapRegistrationController } from "../controllers/registration.controller.js"

const router = Router()

router.post("/registration/bootstrap", requireAuth, bootstrapRegistrationController)

export default router
