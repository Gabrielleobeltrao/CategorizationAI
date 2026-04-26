function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
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
