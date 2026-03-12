import {
  createCategoryService,
  updateCategoryByIdService,
  listCategoriesByClientIdService,
  getCategoryByIdService,
} from "../services/category.service.js"

export async function createCategoryController(req, res) {
  try {
    const category = await createCategoryService(req.body)
    return res.status(201).json(category)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function updateCategoryByIdController(req, res) {
  try {
    const { id } = req.params
    const updatedCategory = await updateCategoryByIdService(id, req.body)
    return res.status(200).json(updatedCategory)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function listCategoriesByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const categories = await listCategoriesByClientIdService(clientId)
    return res.status(200).json(categories)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function getCategoryByIdController(req, res) {
  try {
    const { id } = req.params
    const category = await getCategoryByIdService(id)

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      })
    }

    return res.status(200).json(category)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}
