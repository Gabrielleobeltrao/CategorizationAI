import { Router } from "express"
import {
  createCategoryController,
  updateCategoryByIdController,
  listCategoriesByClientIdController,
  getCategoryByIdController,
} from "../controllers/category.controller.js"

const router = Router()

router.post("/categories", createCategoryController)
router.patch("/categories/:id", updateCategoryByIdController)
router.get("/clients/:clientId/categories", listCategoriesByClientIdController)
router.get("/categories/:id", getCategoryByIdController)

export default router
