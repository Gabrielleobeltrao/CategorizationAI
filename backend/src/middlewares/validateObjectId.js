import { ObjectId } from "mongodb"

function isValidObjectId(value) {
  if (typeof value !== "string") return false
  if (!ObjectId.isValid(value)) return false
  return new ObjectId(value).toString() === value
}

function invalidIdResponse(res, field) {
  return res.status(400).json({
    message: `Invalid ObjectId for '${field}'`,
  })
}

export function validateObjectIdParam(field) {
  return (req, res, next) => {
    const value = req.params?.[field]
    if (!isValidObjectId(value)) return invalidIdResponse(res, field)
    next()
  }
}

export function validateObjectIdQuery(field) {
  return (req, res, next) => {
    const value = req.query?.[field]
    if (!isValidObjectId(value)) return invalidIdResponse(res, field)
    next()
  }
}

export function validateObjectIdBody(field) {
  return (req, res, next) => {
    const value = req.body?.[field]
    if (!isValidObjectId(value)) return invalidIdResponse(res, field)
    next()
  }
}

export function validateTransactionsBatchIds(req, res, next) {
  const transactions = req.body?.transactions

  if (!Array.isArray(transactions)) {
    return res.status(400).json({
      message: "transactions must be an array",
    })
  }

  for (let i = 0; i < transactions.length; i += 1) {
    const tx = transactions[i]

    if (!isValidObjectId(tx?.clientId)) {
      return res.status(400).json({
        message: `Invalid ObjectId for 'transactions[${i}].clientId'`,
      })
    }

    if (tx?.accountId !== undefined && tx?.accountId !== null && !isValidObjectId(tx.accountId)) {
      return res.status(400).json({
        message: `Invalid ObjectId for 'transactions[${i}].accountId'`,
      })
    }

    if (tx?.categoryId !== undefined && tx?.categoryId !== null && !isValidObjectId(tx.categoryId)) {
      return res.status(400).json({
        message: `Invalid ObjectId for 'transactions[${i}].categoryId'`,
      })
    }
  }

  next()
}

export function validateObjectIdBodyArray(field) {
  return (req, res, next) => {
    const values = req.body?.[field]

    if (!Array.isArray(values) || values.length === 0) {
      return res.status(400).json({
        message: `${field} must be a non-empty array`,
      })
    }

    for (let i = 0; i < values.length; i += 1) {
      if (!isValidObjectId(values[i])) {
        return res.status(400).json({
          message: `Invalid ObjectId for '${field}[${i}]'`,
        })
      }
    }

    next()
  }
}
