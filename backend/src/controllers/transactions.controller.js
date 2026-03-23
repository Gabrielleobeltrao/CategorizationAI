import {
  createTransactionsBatchService,
  updateTransactionByIdService,
  listTransactionsPaginatedService,
  deleteTransactionByIdService,
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
