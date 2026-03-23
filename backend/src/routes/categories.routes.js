import { Router } from "express"
import {
  createCategoryController,
  updateCategoryByIdController,
  listCategoriesByClientIdController,
  getCategoryByIdController,
  deleteCategoryByIdController,
} from "../controllers/category.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.post(
  "/categories",
  requireAuth,
  requirePermission("categories:create"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createCategoryController
)

router.patch(
  "/categories/:id",
  requireAuth,
  requirePermission("categories:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "categories", from: "params", field: "id", assignKey: "category" }),
  updateCategoryByIdController
)

router.get(
  "/clients/:clientId/categories",
  requireAuth,
  requirePermission("categories:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listCategoriesByClientIdController
)

router.get(
  "/categories/:id",
  requireAuth,
  requirePermission("categories:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "categories", from: "params", field: "id", assignKey: "category" }),
  getCategoryByIdController
)

router.delete(
  "/categories/:id",
  requireAuth,
  requirePermission("categories:delete"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "categories", from: "params", field: "id", assignKey: "category" }),
  deleteCategoryByIdController
)

export default router
