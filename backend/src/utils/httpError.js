import { getErrorStatusCode } from "./appError.js"

export function sendErrorResponse(res, error, options = {}) {
  const fallbackStatus = Number.isInteger(options.fallbackStatus) ? options.fallbackStatus : 400
  const derivedStatusCode = typeof options.deriveStatusCode === "function"
    ? options.deriveStatusCode(error)
    : null

  const statusCode = Number.isInteger(derivedStatusCode)
    ? derivedStatusCode
    : getErrorStatusCode(error, fallbackStatus)

  const isServerError = statusCode >= 500

  const body = {
    message: isServerError
      ? "Internal Server Error"
      : String(error?.message || options.fallbackMessage || "Request failed"),
  }

  if (!isServerError && error?.details) {
    body.details = error.details
  }

  // Surface domain-specific codes (PERIOD_CLOSED, RECONCILED_TRANSACTION_LOCKED, …)
  // so the frontend can render context-aware actions in the toast.
  const code = error?.code || error?.details?.code
  if (!isServerError && code) {
    body.code = code
  }

  return res.status(statusCode).json(body)
}
