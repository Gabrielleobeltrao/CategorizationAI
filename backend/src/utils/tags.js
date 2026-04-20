export function normalizeTagLabel(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

export function normalizeTags(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  const normalized = []

  for (const item of value) {
    const tag = normalizeTagLabel(item)
    if (!tag || seen.has(tag)) continue

    seen.add(tag)
    normalized.push(tag)
  }

  return normalized
}

export function normalizeTagIds(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  const normalized = []

  for (const item of value) {
    const tagId = String(item || "").trim()
    if (!tagId || seen.has(tagId)) continue

    seen.add(tagId)
    normalized.push(tagId)
  }

  return normalized
}

export function getTagSlug(value = "") {
  const normalized = normalizeTagLabel(value)
  if (!normalized) return ""

  const ascii = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")

  return ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function hasIntersection(tagsA = [], tagsB = []) {
  const setB = new Set(normalizeTags(tagsB))
  if (setB.size === 0) return false

  return normalizeTags(tagsA).some((tag) => setB.has(tag))
}
