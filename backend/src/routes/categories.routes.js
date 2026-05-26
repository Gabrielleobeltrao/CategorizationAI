import { Router } from "express"
import {
  createCategoryController,
  updateCategoryByIdController,
  listCategoriesByClientIdController,
  getCategoryByIdController,
  deleteCategoryByIdController,
  deleteCategoriesBatchController,
  clearUnusedCategoriesByClientIdController,
} from "../controllers/category.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
  validateObjectIdBodyArray,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

// These endpoints kept the /categories paths so existing UI keeps working
// during the double-entry transition, but the underlying collection is
// now `account` (P&L accounts only). Permissions are unified to
// `accounts:*` since categories no longer exist as a separate concept.
const router = Router()

router.post(
  "/categories",
  requireAuth,
  requirePermission("accounts:create"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createCategoryController,
)

router.patch(
  "/categories/:id",
  requireAuth,
  requirePermission("accounts:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "coa_accounts", from: "params", field: "id", assignKey: "category" }),
  updateCategoryByIdController,
)

router.get(
  "/clients/:clientId/categories",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listCategoriesByClientIdController,
)

router.delete(
  "/clients/:clientId/categories/unused",
  requireAuth,
  requirePermission("accounts:delete"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  clearUnusedCategoriesByClientIdController,
)

router.get(
  "/categories/:id",
  requireAuth,
  requirePermission("accounts:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "coa_accounts", from: "params", field: "id", assignKey: "category" }),
  getCategoryByIdController,
)

router.delete(
  "/categories/:id",
  requireAuth,
  requirePermission("accounts:delete"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "coa_accounts", from: "params", field: "id", assignKey: "category" }),
  deleteCategoryByIdController,
)

router.post(
  "/categories/batch-delete",
  requireAuth,
  requirePermission("accounts:delete"),
  validateObjectIdBodyArray("ids"),
  deleteCategoriesBatchController,
)

export default router
