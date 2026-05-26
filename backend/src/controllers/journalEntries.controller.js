import {
  createJournalEntryService,
  updateJournalEntryByIdService,
  getJournalEntryByIdService,
  listJournalEntriesByClientIdService,
  deleteJournalEntryByIdService,
  deleteJournalEntriesByIdsService,
  createHalfEntryService,
  categorizeEntryService,
  listUncategorizedEntriesService,
  categorizeWithAiService,
} from "../services/journalEntries.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function createJournalEntryController(req, res) {
  try {
    const entry = await createJournalEntryService(req.body)
    return res.status(201).json(entry)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateJournalEntryByIdController(req, res) {
  try {
    const updated = await updateJournalEntryByIdService(req.params.id, req.body)
    return res.status(200).json(updated)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getJournalEntryByIdController(req, res) {
  try {
    const entry = await getJournalEntryByIdService(req.params.id)
    if (!entry) return res.status(404).json({ message: "Journal entry not found" })
    return res.status(200).json(entry)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listJournalEntriesByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const { fromDate, toDate, accountId, limit, skip } = req.query
    const result = await listJournalEntriesByClientIdService(clientId, {
      fromDate,
      toDate,
      accountId,
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteJournalEntryByIdController(req, res) {
  try {
    await deleteJournalEntryByIdService(req.params.id)
    return res.status(204).send()
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteJournalEntriesBatchController(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    const result = await deleteJournalEntriesByIdsService(ids)
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

// === Inbox / categorization flow ===

export async function createHalfEntryController(req, res) {
  try {
    const entry = await createHalfEntryService(req.body)
    return res.status(201).json(entry)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function categorizeEntryController(req, res) {
  try {
    const result = await categorizeEntryService({
      entryId: req.params.id,
      contraAccountId: req.body?.contraAccountId,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listUncategorizedEntriesController(req, res) {
  try {
    const { clientId } = req.params
    const { limit } = req.query
    const result = await listUncategorizedEntriesService(clientId, {
      limit: limit ? Number(limit) : undefined,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function categorizeWithAiController(req, res) {
  try {
    const { clientId } = req.params
    const { autoApplyThreshold } = req.body || {}
    const result = await categorizeWithAiService({
      clientId,
      autoApplyThreshold: autoApplyThreshold ? Number(autoApplyThreshold) : undefined,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
