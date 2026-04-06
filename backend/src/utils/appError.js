export class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message)
    this.name = "AppError"
    this.statusCode = statusCode
    this.details = details
  }
}

export function getErrorStatusCode(error, fallback = 400) {
  const statusCode = Number(error?.statusCode)
  return Number.isInteger(statusCode) && statusCode >= 100 ? statusCode : fallback
}
