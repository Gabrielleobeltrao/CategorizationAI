import { Router } from "express"
import {
  createCustomRoleController,
  deleteCustomRoleController,
  listPermissionsController,
  listRolesController,
  updateCustomRoleController,
} from "../controllers/roles.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { requirePermission } from "../middlewares/requirePermission.js"
import { validateObjectIdBody, validateObjectIdParam } from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

router.get("/roles", requireAuth, requirePermission("roles:read"), listRolesController)
router.get("/roles/permissions", requireAuth, requirePermission("roles:read"), listPermissionsController)
router.post(
  "/roles/custom",
  requireAuth,
  requirePermission("roles:create"),
  validateObjectIdBody("officeId"),
  ensureResourceExists({ collection: "offices", from: "body", field: "officeId", assignKey: "office" }),
  createCustomRoleController
)
router.patch(
  "/roles/custom/:id",
  requireAuth,
  requirePermission("roles:update"),
  validateObjectIdParam("id"),
  updateCustomRoleController
)
router.delete(
  "/roles/custom/:id",
  requireAuth,
  requirePermission("roles:delete"),
  validateObjectIdParam("id"),
  deleteCustomRoleController
)

export default router
