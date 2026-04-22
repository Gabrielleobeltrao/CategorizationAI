export function normalizePermissions(value) {
  if (!Array.isArray(value)) return []

  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
}

export function hasPermission(permissions, permission) {
  const safePermissions = normalizePermissions(permissions)

  if (safePermissions.includes("*")) return true
  if (safePermissions.includes(permission)) return true

  const [resource] = String(permission || "").split(":")
  return safePermissions.includes(`${resource}:*`)
}
