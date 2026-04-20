export function normalizeCategoryIdentityName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

export function getCategoryIdentityKey(name = "", type = "") {
  const safeName = normalizeCategoryIdentityName(name)
  const safeType = String(type || "").trim().toLowerCase()

  if (!safeName || !safeType) return ""
  return `${safeName}::${safeType}`
}
