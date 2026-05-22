import {
  getCurrentStateService,
  getPreCloseChecksService,
  listHistoryService,
  closePeriodService,
  reopenPeriodService,
} from "../services/periodClose.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getCurrentStateController(req, res) {
  try {
    const { clientId } = req.params
    const result = await getCurrentStateService({ clientId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getPreCloseChecksController(req, res) {
  try {
    const { clientId } = req.params
    const { throughDate } = req.query || {}
    const result = await getPreCloseChecksService({ clientId, throughDate })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listHistoryController(req, res) {
  try {
    const { clientId } = req.params
    const { limit } = req.query || {}
    const result = await listHistoryService({ clientId, limit })
    return res.status(200).json({ items: result })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function closePeriodController(req, res) {
  try {
    const { clientId } = req.params
    const { throughDate, note } = req.body || {}
    const result = await closePeriodService({
      clientId,
      throughDate,
      note,
      createdBy: String(req.userProfile?._id || ""),
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function reopenPeriodController(req, res) {
  try {
    const { clientId } = req.params
    const { note } = req.body || {}
    const result = await reopenPeriodService({
      clientId,
      note,
      createdBy: String(req.userProfile?._id || ""),
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
