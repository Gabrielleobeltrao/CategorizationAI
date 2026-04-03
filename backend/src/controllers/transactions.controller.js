import {
  createTransactionsBatchService,
  updateTransactionByIdService,
  updateTransactionsByIdsService,
  listTransactionsPaginatedService,
  summarizeTransactionsService,
  listTransactionPeriodOptionsService,
  deleteTransactionByIdService,
  deleteTransactionsByIdsService,
  categorizeTransactionsWithLlmService,
  categorizeZelleTransactionsService,
  categorizeAllTransactionsWithLlmService,
} from "../services/transactions.service.js"

export async function createTransactionsBatchController(req, res) {
  try {
    const result = await createTransactionsBatchService(req.body.transactions)
    return res.status(201).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function updateTransactionByIdController(req, res) {
  try {
    const { id } = req.params
    const updatedTransaction = await updateTransactionByIdService(id, req.body)
    return res.status(200).json(updatedTransaction)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function updateTransactionsByIdsController(req, res) {
  try {
    const result = await updateTransactionsByIdsService(req.body)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function listTransactionsPaginatedController(req, res) {
  try {
    const result = await listTransactionsPaginatedService(req.query)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function summarizeTransactionsController(req, res) {
  try {
    const result = await summarizeTransactionsService(req.query)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function listTransactionPeriodOptionsController(req, res) {
  try {
    const result = await listTransactionPeriodOptionsService(req.query)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function deleteTransactionByIdController(req, res) {
  try {
    const { id } = req.params
    await deleteTransactionByIdService(id)
    return res.status(204).send()
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function deleteTransactionsBatchController(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    const result = await deleteTransactionsByIdsService(ids)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function categorizeTransactionsWithLlmController(req, res) {
  try {
    const result = await categorizeTransactionsWithLlmService(req.body)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function categorizeZelleTransactionsController(req, res) {
  try {
    const result = await categorizeZelleTransactionsService(req.body)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function categorizeAllTransactionsWithLlmController(req, res) {
  try {
    const result = await categorizeAllTransactionsWithLlmService(req.body)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}
