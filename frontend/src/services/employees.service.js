import { api } from "../lib/api"
import { readSessionCache, removeSessionCache, writeSessionCache } from "../utils/sessionCache"

const employeesByOfficeCache = new Map()
const availableRolesCache = new Map()
let rolePermissionsCache = null
const EMPLOYEES_CACHE_PREFIX = "cache:employees:"
const ROLES_CACHE_PREFIX = "cache:roles:"
const ROLE_PERMISSIONS_CACHE_KEY = "cache:role-permissions:v2"

function getOfficeScopedCacheKey(officeId) {
  return String(officeId || "").trim()
}

export function getCachedEmployeesByOfficeId(officeId) {
  const key = getOfficeScopedCacheKey(officeId)
  if (employeesByOfficeCache.has(key)) {
    return employeesByOfficeCache.get(key) || null
  }

  const persisted = readSessionCache(`${EMPLOYEES_CACHE_PREFIX}${key}`, null)
  if (persisted) {
    employeesByOfficeCache.set(key, persisted)
    return persisted
  }

  return null
}

export function clearEmployeesCache(officeId = "") {
  const key = getOfficeScopedCacheKey(officeId)
  if (!key) {
    employeesByOfficeCache.clear()
    if (typeof window !== "undefined") {
      Object.keys(window.sessionStorage)
        .filter((storageKey) => storageKey.startsWith(EMPLOYEES_CACHE_PREFIX))
        .forEach((storageKey) => removeSessionCache(storageKey))
    }
    return
  }

  employeesByOfficeCache.delete(key)
  removeSessionCache(`${EMPLOYEES_CACHE_PREFIX}${key}`)
}

export function getCachedAvailableRoles(officeId) {
  const key = getOfficeScopedCacheKey(officeId)
  if (availableRolesCache.has(key)) {
    return availableRolesCache.get(key) || null
  }

  const persisted = readSessionCache(`${ROLES_CACHE_PREFIX}${key}`, null)
  if (persisted) {
    availableRolesCache.set(key, persisted)
    return persisted
  }

  return null
}

export function clearAvailableRolesCache(officeId = "") {
  const key = getOfficeScopedCacheKey(officeId)
  if (!key) {
    availableRolesCache.clear()
    if (typeof window !== "undefined") {
      Object.keys(window.sessionStorage)
        .filter((storageKey) => storageKey.startsWith(ROLES_CACHE_PREFIX))
        .forEach((storageKey) => removeSessionCache(storageKey))
    }
    return
  }

  availableRolesCache.delete(key)
  removeSessionCache(`${ROLES_CACHE_PREFIX}${key}`)
}

export function hydrateAvailableRolesCache(officeId, roles) {
  const key = getOfficeScopedCacheKey(officeId)
  if (!key || !Array.isArray(roles)) return []
  availableRolesCache.set(key, roles)
  writeSessionCache(`${ROLES_CACHE_PREFIX}${key}`, roles)
  return roles
}

export function getCachedRolePermissions() {
  if (rolePermissionsCache) return rolePermissionsCache
  rolePermissionsCache = readSessionCache(ROLE_PERMISSIONS_CACHE_KEY, null)
  return rolePermissionsCache
}

export function clearRolePermissionsCache() {
  rolePermissionsCache = null
  removeSessionCache(ROLE_PERMISSIONS_CACHE_KEY)
}

export function hydrateRolePermissionsCache(permissions) {
  if (!Array.isArray(permissions)) return []
  rolePermissionsCache = permissions
  writeSessionCache(ROLE_PERMISSIONS_CACHE_KEY, permissions)
  return permissions
}

export async function createEmployeeAccount(input) {
  const name = input?.name?.trim()
  const email = input?.email?.trim()
  const password = input?.password
  const officeId = input?.officeId?.trim()
  const role = input?.role?.trim()
  const clientScope = input?.clientScope === "assigned" ? "assigned" : "all"
  const assignedClientIds = Array.isArray(input?.assignedClientIds)
    ? input.assignedClientIds.map((id) => String(id || "").trim()).filter(Boolean)
    : []

  if (!name) throw new Error("name is required")
  if (!email) throw new Error("email is required")
  if (!password) throw new Error("password is required")
  if (!officeId) throw new Error("officeId is required")
  if (!role) throw new Error("role is required")

  return api("/api/user-profiles/employee-account", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      officeId,
      role,
      clientScope,
      assignedClientIds: clientScope === "assigned" ? assignedClientIds : [],
    }),
  })
}

export async function listEmployeesByOfficeId(officeId, options = {}) {
  const cleanOfficeId = officeId?.trim()
  if (!cleanOfficeId) throw new Error("officeId is required")

  const payload = await api(`/api/offices/${cleanOfficeId}/user-profiles`, {
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  employeesByOfficeCache.set(cleanOfficeId, payload)
  writeSessionCache(`${EMPLOYEES_CACHE_PREFIX}${cleanOfficeId}`, payload)
  return payload
}

export async function listAvailableRoles(officeId, options = {}) {
  const safeOfficeId = String(officeId || "").trim()
  const query = new URLSearchParams()
  if (safeOfficeId) query.set("officeId", safeOfficeId)

  const path = query.toString() ? `/api/roles?${query.toString()}` : "/api/roles"
  const payload = await api(path, {
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  return hydrateAvailableRolesCache(safeOfficeId, payload)
}

export async function listRolePermissions(options = {}) {
  const payload = await api("/api/roles/permissions", {
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  return hydrateRolePermissionsCache(payload)
}

export async function createCustomRole(input) {
  return api("/api/roles/custom", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function updateCustomRoleById(roleId, patch) {
  const id = String(roleId || "").trim()
  if (!id) throw new Error("roleId is required")

  return api(`/api/roles/custom/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function deleteCustomRoleById(roleId) {
  const id = String(roleId || "").trim()
  if (!id) throw new Error("roleId is required")

  return api(`/api/roles/custom/${id}`, {
    method: "DELETE",
  })
}

export async function getMyUserProfile() {
  return api("/api/user-profiles/me")
}

export async function updateEmployeeById(employeeId, patch) {
  const id = String(employeeId || "").trim()
  if (!id) throw new Error("employeeId is required")

  return api(`/api/user-profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function deleteEmployeeById(employeeId) {
  const id = String(employeeId || "").trim()
  if (!id) throw new Error("employeeId is required")

  return api(`/api/user-profiles/${id}`, {
    method: "DELETE",
  })
}

export async function resetEmployeePasswordById(employeeId) {
  const id = String(employeeId || "").trim()
  if (!id) throw new Error("employeeId is required")

  return api(`/api/user-profiles/${id}/reset-password-temp`, {
    method: "POST",
  })
}
