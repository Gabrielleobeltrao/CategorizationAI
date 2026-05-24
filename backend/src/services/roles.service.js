import {
  PERMISSION_DEFINITIONS,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
} from "../config/roles.js"
import {
  createCustomRole,
  deleteCustomRoleById,
  getCustomRoleById,
  getCustomRoleByOfficeIdAndKey,
  listCustomRolesByOfficeId,
  updateCustomRoleById,
} from "../repositories/roles.repository.js"
import { countUserProfilesByOfficeIdAndRole } from "../repositories/userProfile.repository.js"

const SYSTEM_ROLE_KEYS = new Set(ROLE_DEFINITIONS.map((role) => role.key))
const PERMISSION_KEY_SET = new Set(PERMISSION_KEYS)

function slugifyRoleKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function sanitizePermissions(input) {
  if (!Array.isArray(input)) return []

  const dedup = new Set()
  for (const raw of input) {
    const key = String(raw || "").trim()
    if (!key) continue
    if (!PERMISSION_KEY_SET.has(key)) continue
    dedup.add(key)
  }
  return [...dedup]
}

function toSystemRoleDto(role) {
  return {
    id: `system_${role.key}`,
    key: role.key,
    label: role.label,
    description: role.description,
    permissions: role.permissions,
    isSystem: true,
    createdAt: null,
    updatedAt: null,
  }
}

function toCustomRoleDto(role) {
  return {
    id: String(role._id),
    key: String(role.key || "").toLowerCase(),
    label: String(role.label || ""),
    description: String(role.description || ""),
    permissions: Array.isArray(role.permissions) ? role.permissions : [],
    isSystem: false,
    createdAt: role.createdAt || null,
    updatedAt: role.updatedAt || null,
  }
}

export function listPermissionsCatalogService() {
  return PERMISSION_DEFINITIONS
}

export async function listRolesForOfficeService(officeId) {
  if (!officeId) throw new Error("officeId is required")

  const systemRoles = ROLE_DEFINITIONS.map(toSystemRoleDto)
  const customRoles = (await listCustomRolesByOfficeId(officeId)).map(toCustomRoleDto)
  return [...systemRoles, ...customRoles]
}

export async function roleExistsForOfficeService(roleKey, officeId) {
  const normalizedRoleKey = String(roleKey || "").trim().toLowerCase()
  if (!normalizedRoleKey) return false
  if (SYSTEM_ROLE_KEYS.has(normalizedRoleKey)) return true
  if (!officeId) return false

  const customRole = await getCustomRoleByOfficeIdAndKey(officeId, normalizedRoleKey)
  return Boolean(customRole)
}

export async function getPermissionsForRoleService(roleKey, officeId) {
  const normalizedRoleKey = String(roleKey || "").trim().toLowerCase()
  if (!normalizedRoleKey) return []

  const systemRole = ROLE_DEFINITIONS.find((role) => role.key === normalizedRoleKey)
  if (systemRole) return systemRole.permissions

  if (!officeId) return []
  const customRole = await getCustomRoleByOfficeIdAndKey(officeId, normalizedRoleKey)
  if (!customRole) return []
  return Array.isArray(customRole.permissions) ? customRole.permissions : []
}

export function hasPermissionFromListService(permissions, permission) {
  const safePermissions = Array.isArray(permissions) ? permissions : []
  if (safePermissions.includes("*")) return true
  if (safePermissions.includes(permission)) return true

  const [resource] = String(permission || "").split(":")
  return safePermissions.includes(`${resource}:*`)
}

// Client scoping — returns true when the user's profile permits accessing
// the given client. Default scope ("all") grants access to anything in the
// office; "assigned" restricts to a whitelist on the profile.
export function userClientScopeAllowsClient(userProfile, clientId) {
  if (!userProfile) return false
  const scope = String(userProfile.clientScope || "all")
  if (scope !== "assigned") return true
  const assigned = Array.isArray(userProfile.assignedClientIds)
    ? userProfile.assignedClientIds.map((id) => String(id))
    : []
  return assigned.includes(String(clientId || ""))
}

export function isClientScopeRestricted(userProfile) {
  return String(userProfile?.clientScope || "all") === "assigned"
}

export async function userHasPermissionService(userProfile, permission) {
  const role = String(userProfile?.role || "").toLowerCase()
  const officeId = String(userProfile?.officeId || "")
  if (!role) return false

  if (Array.isArray(userProfile?.permissions) && userProfile.permissions.length > 0) {
    return hasPermissionFromListService(userProfile.permissions, permission)
  }

  const permissions = await getPermissionsForRoleService(role, officeId)
  return hasPermissionFromListService(permissions, permission)
}

export async function createCustomRoleService(input, context = {}) {
  const officeId = String(input?.officeId || "").trim()
  const actorOfficeId = String(context?.actorOfficeId || "").trim()

  if (!officeId) throw new Error("officeId is required")
  if (actorOfficeId && actorOfficeId !== officeId) throw new Error("Forbidden for this office")

  const label = String(input?.label || "").trim()
  if (!label) throw new Error("label is required")

  const key = slugifyRoleKey(input?.key || label)
  if (!key) throw new Error("role key is invalid")
  if (SYSTEM_ROLE_KEYS.has(key)) throw new Error("role key conflicts with system role")

  const existing = await getCustomRoleByOfficeIdAndKey(officeId, key)
  if (existing) throw new Error("role key already exists in this office")

  const permissions = sanitizePermissions(input?.permissions)
  const description = String(input?.description || "").trim()

  return createCustomRole({
    officeId,
    key,
    label,
    description,
    permissions,
    createdBy: context?.actorEmail || null,
  })
}

export async function updateCustomRoleService(roleId, patch, context = {}) {
  if (!roleId) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const current = await getCustomRoleById(roleId)
  if (!current) throw new Error("Role not found")
  if (current.isSystem) throw new Error("System role cannot be updated")

  const actorOfficeId = String(context?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== String(current.officeId || "")) {
    throw new Error("Forbidden for this office")
  }

  const safePatch = {}

  if (typeof patch.label === "string") {
    const label = patch.label.trim()
    if (!label) throw new Error("label cannot be empty")
    safePatch.label = label
  }

  if (typeof patch.description === "string") {
    safePatch.description = patch.description.trim()
  }

  if (Array.isArray(patch.permissions)) {
    safePatch.permissions = sanitizePermissions(patch.permissions)
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateCustomRoleById(roleId, safePatch)
}

export async function deleteCustomRoleService(roleId, context = {}) {
  if (!roleId) throw new Error("id is required")

  const current = await getCustomRoleById(roleId)
  if (!current) throw new Error("Role not found")
  if (current.isSystem) throw new Error("System role cannot be deleted")

  const actorOfficeId = String(context?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== String(current.officeId || "")) {
    throw new Error("Forbidden for this office")
  }

  const roleUsageCount = await countUserProfilesByOfficeIdAndRole(current.officeId, current.key)
  if (roleUsageCount > 0) {
    throw new Error("Role is being used by employees")
  }

  return deleteCustomRoleById(roleId)
}
