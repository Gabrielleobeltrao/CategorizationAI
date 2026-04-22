function normalizeOrigin(value) {
  const safeValue = String(value || "").trim()
  return safeValue || null
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean)
}

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]

const configuredOrigins = parseOrigins(process.env.ALLOWED_ORIGINS)

export const ALLOWED_ORIGINS = Array.from(
  new Set(
    [
      ...DEFAULT_ALLOWED_ORIGINS,
      ...configuredOrigins,
    ].filter(Boolean)
  )
)

export function isAllowedOrigin(origin) {
  if (!origin) return true
  return ALLOWED_ORIGINS.includes(String(origin).trim())
}
