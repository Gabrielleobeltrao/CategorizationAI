import { Router } from "express"
import {
  createCategoryController,
  updateCategoryByIdController,
  listCategoriesByClientIdController,
  getCategoryByIdController,
} from "../controllers/category.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"

const router = Router()

router.post(
  "/categories",
  requireAuth,
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createCategoryController
)

router.patch(
  "/categories/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "categories", from: "params", field: "id", assignKey: "category" }),
  updateCategoryByIdController
)

router.get(
  "/clients/:clientId/categories",
  requireAuth,
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listCategoriesByClientIdController
)

router.get(
  "/categories/:id",
  requireAuth,
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "categories", from: "params", field: "id", assignKey: "category" }),
  getCategoryByIdController
)

export default router
