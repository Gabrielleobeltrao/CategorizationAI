import { Router } from "express"
import {
  createUserProfileController,
  updateUserProfileByIdController,
  getUserProfileByIdController,
  listUserProfilesByOfficeIdController,
  getMyUserProfileController,
  deleteUserProfileByIdController,
  resetEmployeePasswordByIdController,
  completeMyPasswordResetController,
} from "../controllers/userProfile.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.post(
  "/user-profiles",
  requireAuth,
  requirePermission("userProfiles:create"),
  validateObjectIdBody("officeId"),
  ensureResourceExists({ collection: "offices", from: "body", field: "officeId", assignKey: "office" }),
  createUserProfileController
)

router.get(
  "/user-profiles/me",
  requireAuth,
  requirePermission("userProfiles:read"),
  getMyUserProfileController
)

router.post(
  "/user-profiles/me/complete-password-reset",
  requireAuth,
  completeMyPasswordResetController
)

router.get(
  "/offices/:officeId/user-profiles",
  requireAuth,
  requirePermission("userProfiles:read"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  listUserProfilesByOfficeIdController
)

router.patch(
  "/user-profiles/:id",
  requireAuth,
  requirePermission("userProfiles:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "user_profile", from: "params", field: "id", assignKey: "userProfile" }),
  updateUserProfileByIdController
)

router.get(
  "/user-profiles/:id",
  requireAuth,
  requirePermission("userProfiles:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "user_profile", from: "params", field: "id", assignKey: "userProfile" }),
  getUserProfileByIdController
)

router.delete(
  "/user-profiles/:id",
  requireAuth,
  requirePermission("userProfiles:delete"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "user_profile", from: "params", field: "id", assignKey: "userProfile" }),
  deleteUserProfileByIdController
)

router.post(
  "/user-profiles/:id/reset-password-temp",
  requireAuth,
  requirePermission("userProfiles:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "user_profile", from: "params", field: "id", assignKey: "userProfile" }),
  resetEmployeePasswordByIdController
)

export default router
