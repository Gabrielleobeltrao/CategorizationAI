import { Router } from "express"
import {
  createCategoryTemplateController,
  deleteCategoryTemplateByIdController,
  listCategoryTemplatesByOfficeIdController,
  updateCategoryTemplateByIdController,
} from "../controllers/categoryTemplate.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import { requirePermission } from "../middlewares/requirePermission.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { validateObjectIdBody, validateObjectIdParam } from "../middlewares/validateObjectId.js"

const router = Router()

router.post(
  "/category-templates",
  requireAuth,
  requirePermission("categories:create"),
  validateObjectIdBody("officeId"),
  ensureResourceExists({ collection: "offices", from: "body", field: "officeId", assignKey: "office" }),
  createCategoryTemplateController
)

router.get(
  "/offices/:officeId/category-templates",
  requireAuth,
  requirePermission("categories:read"),
  validateObjectIdParam("officeId"),
  ensureResourceExists({ collection: "offices", from: "params", field: "officeId", assignKey: "office" }),
  listCategoryTemplatesByOfficeIdController
)

router.patch(
  "/category-templates/:id",
  requireAuth,
  requirePermission("categories:update"),
  validateObjectIdParam("id"),
  updateCategoryTemplateByIdController
)

router.delete(
  "/category-templates/:id",
  requireAuth,
  requirePermission("categories:delete"),
  validateObjectIdParam("id"),
  deleteCategoryTemplateByIdController
)

export default router
