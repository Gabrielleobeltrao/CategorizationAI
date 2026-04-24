import {
  createAccountService,
  updateAccountByIdService,
  listAccountsByClientIdService,
  getAccountByIdService,
  deleteAccountByIdService,
  deleteAccountsByIdsService,
} from "../services/account.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function createAccountController(req, res) {
  try {
    const account = await createAccountService(req.body)
    return res.status(201).json(account)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateAccountByIdController(req, res) {
  try {
    const { id } = req.params
    const updatedAccount = await updateAccountByIdService(id, req.body)
    return res.status(200).json(updatedAccount)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listAccountsByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const accounts = await listAccountsByClientIdService(clientId)
    return res.status(200).json(accounts)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getAccountByIdController(req, res) {
  try {
    const account = req.scope?.account || await getAccountByIdService(req.params.id)

    if (!account) {
      return res.status(404).json({
        message: "Account not found",
      })
    }

    return res.status(200).json(account)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteAccountByIdController(req, res) {
  try {
    const { id } = req.params
    await deleteAccountByIdService(id)
    return res.status(204).send()
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteAccountsBatchController(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    const result = await deleteAccountsByIdsService(ids)
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
