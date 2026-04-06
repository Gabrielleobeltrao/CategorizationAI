import { normalizeCategoryType } from "../constants/categoryTypes"

function normalizeCategoryName(value = "") {
  return String(value || "").trim()
}

export function isRefundLikeCategory({ categoryType = "", amount = 0 }) {
  const normalizedType = normalizeCategoryType(categoryType)
  const numericAmount = Number(amount || 0)

  if (!normalizedType || numericAmount === 0) return false
  if (normalizedType === "income") return numericAmount < 0
  return numericAmount > 0
}

export function getCategoryDisplayName({ categoryName = "", categoryType = "", amount = 0 }) {
  const safeName = normalizeCategoryName(categoryName)
  if (!safeName) return ""

  const lowerName = safeName.toLowerCase()
  if (lowerName === "uncategorized income" || lowerName === "uncategorized expenses") {
    return safeName
  }

  if (lowerName.startsWith("refund - ")) {
    return safeName
  }

  if (!isRefundLikeCategory({ categoryType, amount })) {
    return safeName
  }

  return `Refund - ${safeName}`
}
