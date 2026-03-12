import { Router } from "express"
import {
  createUserProfileController,
  updateUserProfileByIdController,
  getUserProfileByIdController,
} from "../controllers/userProfile.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

router.post(
  "/user-profiles",
  requireAuth,
  validateObjectIdBody("officeId"),
  ensureResourceExists({ collection: "offices", from: "body", field: "officeId", assignKey: "office" }),
  createUserProfileController
)

router.patch(
  "/user-profiles/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "user_profile", from: "params", field: "id", assignKey: "userProfile" }),
  updateUserProfileByIdController
)

router.get(
  "/user-profiles/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "user_profile", from: "params", field: "id", assignKey: "userProfile" }),
  getUserProfileByIdController
)

export default router
