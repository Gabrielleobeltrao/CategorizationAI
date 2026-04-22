import {
  createCategoryTemplateService,
  deleteCategoryTemplateByIdService,
  listCategoryTemplatesByOfficeIdService,
  updateCategoryTemplateByIdService,
} from "../services/categoryTemplate.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function createCategoryTemplateController(req, res) {
  try {
    const template = await createCategoryTemplateService(req.body, {
      actorOfficeId: req.userProfile?.officeId,
      actorProfileId: req.userProfile?._id,
    })
    return res.status(201).json(template)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listCategoryTemplatesByOfficeIdController(req, res) {
  try {
    const templates = await listCategoryTemplatesByOfficeIdService(req.params.officeId, {
      actorOfficeId: req.userProfile?.officeId,
    })
    return res.status(200).json(templates)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateCategoryTemplateByIdController(req, res) {
  try {
    const template = await updateCategoryTemplateByIdService(req.params.id, req.body, {
      actorOfficeId: req.userProfile?.officeId,
      actorProfileId: req.userProfile?._id,
    })
    return res.status(200).json(template)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteCategoryTemplateByIdController(req, res) {
  try {
    await deleteCategoryTemplateByIdService(req.params.id, {
      actorOfficeId: req.userProfile?.officeId,
    })
    return res.status(204).send()
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
