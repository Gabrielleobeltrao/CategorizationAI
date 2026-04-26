function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function normalizeObjectIdLike(value) {
  const safe = String(value || "").trim()
  return safe || null
}

function parseTransactionDateValue(value = "") {
  const safe = String(value || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return null

  const [yearString, monthString, dayString] = safe.split("-")
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

function getDateParts(value = "") {
  const safe = String(value || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
    return {
      year: null,
      month: null,
      dateValue: null,
    }
  }

  return {
    year: safe.slice(0, 4),
    month: safe.slice(5, 7),
    dateValue: parseTransactionDateValue(safe),
  }
}

function isAssignedCategoryValue(categoryId, categoryName) {
  const safeCategoryId = normalizeObjectIdLike(categoryId)
  if (safeCategoryId) return true

  const safeCategoryName = String(categoryName || "").trim().toLowerCase()
  if (!safeCategoryName) return false

  return (
    safeCategoryName !== "uncategorized" &&
    safeCategoryName !== "uncategorized income" &&
    safeCategoryName !== "uncategorized expenses"
  )
}

function tokenizeSearchText(value = "") {
  return normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function buildSearchTermsFromTokens(tokens = []) {
  const uniqueTerms = new Set()

  for (const rawToken of Array.isArray(tokens) ? tokens : []) {
    const token = String(rawToken || "").trim()
    if (!token) continue

    uniqueTerms.add(token)

    const maxPrefixLength = Math.min(token.length, 8)
    for (let length = 1; length <= maxPrefixLength; length += 1) {
      uniqueTerms.add(token.slice(0, length))
    }
  }

  return [...uniqueTerms]
}

export function buildTransactionSearchTerms(transaction = {}) {
  const splitCategoryNames = Array.isArray(transaction?.splits)
    ? transaction.splits.map((split) => split?.category).filter(Boolean)
    : []

  const source = [
    transaction?.date,
    transaction?.description,
    transaction?.accountName,
    transaction?.category,
    ...splitCategoryNames,
  ]
    .filter(Boolean)
    .join(" ")

  return buildSearchTermsFromTokens(tokenizeSearchText(source))
}

export function buildTransactionSearchText(transaction = {}) {
  const splitCategoryNames = Array.isArray(transaction?.splits)
    ? transaction.splits.map((split) => split?.category).filter(Boolean)
    : []

  return normalizeSearchText([
    transaction?.date,
    transaction?.description,
    transaction?.accountName,
    transaction?.category,
    ...splitCategoryNames,
  ]
    .filter(Boolean)
    .join(" "))
}

export function buildTransactionDerivedFields(transaction = {}) {
  const amount = Number(transaction?.amount || 0)
  const splits = Array.isArray(transaction?.splits) ? transaction.splits : []
  const hasSplit = Boolean(transaction?.isSplit) || splits.length > 1
  const { year, month, dateValue } = getDateParts(transaction?.date)
  const directCategoryId = normalizeObjectIdLike(transaction?.categoryId)
  const allCategoryIds = [
    ...new Set(
      [
        directCategoryId,
        ...splits.map((split) => normalizeObjectIdLike(split?.categoryId)),
      ].filter(Boolean)
    ),
  ]

  let hasUncategorizedIncome = false
  let hasUncategorizedExpense = false

  if (hasSplit) {
    for (const split of splits) {
      const splitAmount = Number(split?.amount || 0)
      if (isAssignedCategoryValue(split?.categoryId, split?.category)) continue

      if (splitAmount >= 0) {
        hasUncategorizedIncome = true
      } else {
        hasUncategorizedExpense = true
      }
    }
  } else if (!isAssignedCategoryValue(transaction?.categoryId, transaction?.category)) {
    if (amount >= 0) {
      hasUncategorizedIncome = true
    } else {
      hasUncategorizedExpense = true
    }
  }

  const llmStatus = String(transaction?.llmStatus || "").trim().toLowerCase()
  const llmProcessedState =
    Boolean(transaction?.llmProcessed) ||
    Boolean(transaction?.llmProcessedAt) ||
    ["suggested", "empty", "error"].includes(llmStatus)
      ? "processed"
      : "not_processed"

  const categorizedSource = String(transaction?.categorizedSource || "").trim().toLowerCase()
  const iconType = categorizedSource === "memory"
    ? "memory"
    : llmProcessedState === "processed"
      ? "ai"
      : "none"

  return {
    dateValue,
    year,
    month,
    hasSplit,
    allCategoryIds,
    hasUncategorizedIncome,
    hasUncategorizedExpense,
    llmProcessedState,
    iconType,
  }
}

export function buildTransactionSearchQuery(search = "") {
  const normalizedSearchText = normalizeSearchText(search)
  const tokens = tokenizeSearchText(search)
  const hasOnlyIndexableTokens = tokens.length > 0

  return {
    normalizedSearchText,
    tokens,
    hasOnlyIndexableTokens,
  }
}
