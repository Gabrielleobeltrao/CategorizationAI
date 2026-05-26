import {
  getChartOfAccountsService,
  listCoaPresetsService,
  applyCoaPresetService,
  createCustomCoaPresetService,
  deleteCustomCoaPresetService,
} from "../services/chartOfAccounts.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getChartOfAccountsController(req, res) {
  try {
    const { clientId } = req.params
    const result = await getChartOfAccountsService({ clientId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listCoaPresetsController(req, res) {
  try {
    const officeId = req.userProfile?.officeId
    const result = await listCoaPresetsService({ officeId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function applyCoaPresetController(req, res) {
  try {
    const { clientId } = req.params
    const presetId = req.body?.presetId
    const officeId = req.userProfile?.officeId
    const result = await applyCoaPresetService({ clientId, presetId, officeId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function createCustomCoaPresetController(req, res) {
  try {
    const officeId = req.userProfile?.officeId
    const createdBy = req.userProfile?._id
    const { name, description, accounts } = req.body || {}
    const result = await createCustomCoaPresetService({
      officeId,
      name,
      description,
      accounts,
      createdBy,
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteCustomCoaPresetController(req, res) {
  try {
    const officeId = req.userProfile?.officeId
    const result = await deleteCustomCoaPresetService({ id: req.params.id, officeId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
