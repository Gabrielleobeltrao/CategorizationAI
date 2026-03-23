import {
  createAccountService,
  updateAccountByIdService,
  listAccountsByClientIdService,
  getAccountByIdService,
  deleteAccountByIdService,
} from "../services/account.service.js"

export async function createAccountController(req, res) {
  try {
    const account = await createAccountService(req.body)
    return res.status(201).json(account)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function updateAccountByIdController(req, res) {
  try {
    const { id } = req.params
    const updatedAccount = await updateAccountByIdService(id, req.body)
    return res.status(200).json(updatedAccount)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function listAccountsByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const accounts = await listAccountsByClientIdService(clientId)
    return res.status(200).json(accounts)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function getAccountByIdController(req, res) {
  try {
    const { id } = req.params
    const account = await getAccountByIdService(id)

    if (!account) {
      return res.status(404).json({
        message: "Account not found",
      })
    }

    return res.status(200).json(account)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function deleteAccountByIdController(req, res) {
  try {
    const { id } = req.params
    await deleteAccountByIdService(id)
    return res.status(204).send()
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}
