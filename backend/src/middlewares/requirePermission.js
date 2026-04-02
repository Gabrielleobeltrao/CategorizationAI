import { getDB } from "../db.js"
import { ROLE_PERMISSIONS } from "../config/roles.js"
import { getPermissionsForRoleService } from "../services/roles.service.js"

function hasPermissionFromList(permissions, permission) {
  if (!permissions) return false
  if (permissions.includes("*")) return true
  if (permissions.includes(permission)) return true

  const [resource] = permission.split(":")
  return permissions.includes(`${resource}:*`)
}

function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role]
  return hasPermissionFromList(permissions, permission)
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const email = req.user?.email
      if (!email) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const db = getDB()
      const profile = await db.collection("user_profile").findOne({ email: String(email).toLowerCase() })

      if (!profile) {
        const isOfficeBootstrap = permission === "offices:create"
        const isSelfProfileBootstrap =
          permission === "userProfiles:create" &&
          String(req.body?.email || "").toLowerCase() === String(email).toLowerCase()

        if (isOfficeBootstrap || isSelfProfileBootstrap) {
          return next()
        }

        return res.status(403).json({ message: "User profile not found for this account" })
      }

      const role = String(profile.role || "").toLowerCase()
      if (hasPermission(role, permission)) {
        req.userProfile = profile
        return next()
      }

      const customRolePermissions = await getPermissionsForRoleService(role, profile.officeId)
      if (!hasPermissionFromList(customRolePermissions, permission)) {
        return res.status(403).json({ message: "Forbidden" })
      }

      req.userProfile = profile
      return next()
    } catch {
      return res.status(403).json({ message: "Forbidden" })
    }
  }
}
