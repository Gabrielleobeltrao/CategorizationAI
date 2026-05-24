import {
  createRecurringService,
  listRecurringService,
  getRecurringService,
  updateRecurringService,
  deleteRecurringService,
  setRecurringActiveService,
  runRecurringOnceService,
  skipRecurringNextService,
} from "../services/recurring.service.js"
import { recordActivityForClient } from "../repositories/activityLog.repository.js"
import { sendErrorResponse } from "../utils/httpError.js"

function actorContext(req) {
  const profile = req.userProfile || {}
  return {
    actorId: profile?._id,
    actorName:
      String(profile?.name || "").trim() ||
      String(profile?.email || "").trim(),
  }
}

export async function listRecurringController(req, res) {
  try {
    const { clientId } = req.params
    const result = await listRecurringService({ clientId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function createRecurringController(req, res) {
  try {
    const { clientId } = req.params
    const payload = {
      ...(req.body || {}),
      clientId,
      createdBy: String(req.userProfile?._id || ""),
    }
    const result = await createRecurringService(payload)
    recordActivityForClient({
      clientId,
      ...actorContext(req),
      action: "recurring.created",
      targetType: "recurring",
      targetId: result?._id || result?.id,
      label: String(result?.title || result?.description || "Recurring"),
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getRecurringController(req, res) {
  try {
    const { id } = req.params
    const result = await getRecurringService({ id })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateRecurringController(req, res) {
  try {
    const { id } = req.params
    const result = await updateRecurringService({ id, patch: req.body || {} })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteRecurringController(req, res) {
  try {
    const { id } = req.params
    const result = await deleteRecurringService({ id })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function setRecurringActiveController(req, res) {
  try {
    const { id } = req.params
    const { isActive } = req.body || {}
    const result = await setRecurringActiveService({ id, isActive })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function runRecurringOnceController(req, res) {
  try {
    const { id } = req.params
    const result = await runRecurringOnceService({ id })
    recordActivityForClient({
      clientId: result?.clientId,
      ...actorContext(req),
      action: "recurring.runOnce",
      targetType: "recurring",
      targetId: id,
      label: String(result?.title || result?.description || "Recurring"),
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function skipRecurringNextController(req, res) {
  try {
    const { id } = req.params
    const result = await skipRecurringNextService({ id })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
