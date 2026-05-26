import {
  startReconciliationService,
  getWorksheetService,
  updateReconciliationProgressService,
  completeReconciliationService,
  reopenReconciliationService,
  cancelInProgressReconciliationService,
  listReconciliationsService,
  getActiveReconciliationService,
  getOpeningBalanceService,
} from "../services/reconciliation.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function listReconciliationsController(req, res) {
  try {
    const { clientId } = req.params
    const { accountId, limit } = req.query || {}
    const result = await listReconciliationsService({ clientId, accountId, limit })
    return res.status(200).json({ items: result })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getActiveReconciliationController(req, res) {
  try {
    const { clientId } = req.params
    const { accountId } = req.query || {}
    const result = await getActiveReconciliationService({ clientId, accountId })
    return res.status(200).json({ reconciliation: result })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getOpeningBalanceController(req, res) {
  try {
    const { clientId } = req.params
    const { accountId } = req.query || {}
    const result = await getOpeningBalanceService({ clientId, accountId })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function startReconciliationController(req, res) {
  try {
    const { clientId } = req.params
    const { accountId, statementDate, statementEndingBalance, openingBalance } = req.body || {}
    const result = await startReconciliationService({
      clientId,
      accountId,
      statementDate,
      statementEndingBalance,
      openingBalance,
      createdBy: String(req.userProfile?._id || ""),
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getWorksheetController(req, res) {
  try {
    const { id } = req.params
    const result = await getWorksheetService({ reconciliationId: id })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateReconciliationController(req, res) {
  try {
    const { id } = req.params
    const { legRefs } = req.body || {}
    const result = await updateReconciliationProgressService({
      reconciliationId: id,
      legRefs,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function completeReconciliationController(req, res) {
  try {
    const { id } = req.params
    const { legRefs } = req.body || {}
    const result = await completeReconciliationService({
      reconciliationId: id,
      legRefs,
      completedBy: String(req.userProfile?._id || ""),
      completedByName:
        String(req.userProfile?.name || "").trim() ||
        String(req.userProfile?.email || "").trim(),
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function reopenReconciliationController(req, res) {
  try {
    const { id } = req.params
    const result = await reopenReconciliationService({
      reconciliationId: id,
      reopenedBy: String(req.userProfile?._id || ""),
      reopenedByName:
        String(req.userProfile?.name || "").trim() ||
        String(req.userProfile?.email || "").trim(),
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function cancelReconciliationController(req, res) {
  try {
    const { id } = req.params
    const result = await cancelInProgressReconciliationService({ reconciliationId: id })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
