import { api } from "../lib/api"

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

  return api(`/api/offices/${cleanOfficeId}/user-profiles`)
}

export async function listAvailableRoles(officeId) {
  const safeOfficeId = String(officeId || "").trim()
  const query = new URLSearchParams()
  if (safeOfficeId) query.set("officeId", safeOfficeId)

  const path = query.toString() ? `/api/roles?${query.toString()}` : "/api/roles"
  return api(path)
}

export async function listRolePermissions() {
  return api("/api/roles/permissions")
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
