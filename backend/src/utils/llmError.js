import { AppError } from "./appError.js"

export const LLM_SPEND_LIMIT_MESSAGE =
  "You reached the AI categorization limit for this workspace."

function extractLlmErrorCode(error) {
  return String(
    error?.code ||
    error?.type ||
    error?.error?.code ||
    error?.error?.type ||
    error?.cause?.code ||
    error?.cause?.type ||
    error?.response?.data?.error?.code ||
    error?.response?.data?.error?.type ||
    ""
  )
    .trim()
    .toLowerCase()
}

function extractLlmErrorMessage(error) {
  return String(
    error?.message ||
    error?.error?.message ||
    error?.cause?.message ||
    error?.response?.data?.error?.message ||
    ""
  )
    .trim()
    .toLowerCase()
}

export function isLlmSpendLimitError(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0)
  const code = extractLlmErrorCode(error)
  const message = extractLlmErrorMessage(error)

  if (code === "insufficient_quota") return true
  if (code === "billing_hard_limit_reached") return true
  if (code === "usage_limit_reached") return true

  if (status !== 429) return false

  return (
    message.includes("insufficient_quota") ||
    message.includes("exceeded your current quota") ||
    message.includes("billing hard limit") ||
    message.includes("hard limit reached") ||
    message.includes("usage limit reached")
  )
}

export function normalizeLlmError(error) {
  if (error instanceof AppError) return error

  if (isLlmSpendLimitError(error)) {
    return new AppError(LLM_SPEND_LIMIT_MESSAGE, 429, {
      reason: "llm_spend_limit_reached",
    })
  }

  return error
}
