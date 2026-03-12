import { Router } from "express"
import {
  createUserProfileController,
  updateUserProfileByIdController,
  getUserProfileByIdController,
} from "../controllers/userProfile.controller.js"

const router = Router()

router.post("/user-profiles", createUserProfileController)
router.patch("/user-profiles/:id", updateUserProfileByIdController)
router.get("/user-profiles/:id", getUserProfileByIdController)

export default router
