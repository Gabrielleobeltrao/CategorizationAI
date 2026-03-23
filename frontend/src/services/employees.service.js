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

  const authUser = await api("/api/auth/sign-up/email", {
    method: "POST",
    credentials: "omit",
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  })

  const userProfile = await api("/api/user-profiles", {
    method: "POST",
    body: JSON.stringify({
      name,
      officeId,
      role,
      email,
      status: "active",
    }),
  })

  return {
    authUser,
    userProfile,
  }
}

export async function listEmployeesByOfficeId(officeId) {
  const cleanOfficeId = officeId?.trim()
  if (!cleanOfficeId) throw new Error("officeId is required")

  return api(`/api/offices/${cleanOfficeId}/user-profiles`)
}

export async function listAvailableRoles() {
  return api("/api/roles")
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
