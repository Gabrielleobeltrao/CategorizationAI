import { api } from "../lib/api"

const employeesByOfficeCache = new Map()
const availableRolesCache = new Map()
let rolePermissionsCache = null

function getOfficeScopedCacheKey(officeId) {
  return String(officeId || "").trim()
}

export function getCachedEmployeesByOfficeId(officeId) {
  return employeesByOfficeCache.get(getOfficeScopedCacheKey(officeId)) || null
}

export function clearEmployeesCache(officeId = "") {
  const key = getOfficeScopedCacheKey(officeId)
  if (!key) {
    employeesByOfficeCache.clear()
    return
  }

  employeesByOfficeCache.delete(key)
}

export function getCachedAvailableRoles(officeId) {
  return availableRolesCache.get(getOfficeScopedCacheKey(officeId)) || null
}

export function clearAvailableRolesCache(officeId = "") {
  const key = getOfficeScopedCacheKey(officeId)
  if (!key) {
    availableRolesCache.clear()
    return
  }

  availableRolesCache.delete(key)
}

export function getCachedRolePermissions() {
  return rolePermissionsCache
}

export function clearRolePermissionsCache() {
  rolePermissionsCache = null
}

export async function createEmployeeAccount(input) {
  const name = input?.name?.trim()
  const email = input?.email?.trim()
  const password = input?.password
  const officeId = input?.officeId?.trim()
  const role = input?.role?.trim()

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
    }),
  })
}

export async function listEmployeesByOfficeId(officeId) {
  const cleanOfficeId = officeId?.trim()
  if (!cleanOfficeId) throw new Error("officeId is required")

  const payload = await api(`/api/offices/${cleanOfficeId}/user-profiles`)
  employeesByOfficeCache.set(cleanOfficeId, payload)
  return payload
}

export async function listAvailableRoles(officeId) {
  const safeOfficeId = String(officeId || "").trim()
  const query = new URLSearchParams()
  if (safeOfficeId) query.set("officeId", safeOfficeId)

  const path = query.toString() ? `/api/roles?${query.toString()}` : "/api/roles"
  const payload = await api(path)
  availableRolesCache.set(getOfficeScopedCacheKey(safeOfficeId), payload)
  return payload
}

export async function listRolePermissions() {
  const payload = await api("/api/roles/permissions")
  rolePermissionsCache = payload
  return payload
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
