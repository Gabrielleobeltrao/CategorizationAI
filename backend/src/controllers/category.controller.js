import {
  createCategoryService,
  updateCategoryByIdService,
  listCategoriesByClientIdService,
  getCategoryByIdService,
  deleteCategoryByIdService,
  clearUnusedCategoriesByClientIdService,
} from "../services/category.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function createCategoryController(req, res) {
  try {
    const category = await createCategoryService(req.body, {
      actorProfileId: req.userProfile?._id,
    })
    return res.status(201).json(category)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateCategoryByIdController(req, res) {
  try {
    const { id } = req.params
    const updatedCategory = await updateCategoryByIdService(id, req.body, {
      actorProfileId: req.userProfile?._id,
    })
    return res.status(200).json(updatedCategory)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listCategoriesByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const categories = await listCategoriesByClientIdService(clientId)
    return res.status(200).json(categories)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getCategoryByIdController(req, res) {
  try {
    const category = req.scope?.category || await getCategoryByIdService(req.params.id)

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      })
    }

    return res.status(200).json(category)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteCategoryByIdController(req, res) {
  try {
    const { id } = req.params
    await deleteCategoryByIdService(id)
    return res.status(204).send()
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function clearUnusedCategoriesByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const result = await clearUnusedCategoriesByClientIdService(clientId)
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
