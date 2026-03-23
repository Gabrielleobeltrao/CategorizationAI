import {
  createUserProfile,
  updateUserProfileById,
  getUserProfileById,
  listUserProfilesByOfficeId,
  getUserProfileByEmail,
  deleteUserProfileById,
} from "../repositories/userProfile.repository.js"

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase()
  if (status !== "active" && status !== "inactive") {
    throw new Error("status must be active or inactive")
  }
  return status
}

export async function createUserProfileService(input) {
  if (!input?.name) throw new Error("name is required")
  if (!input?.officeId) throw new Error("officeId is required")
  if (!input?.role) throw new Error("role is required")

  const role = String(input.role).trim().toLowerCase()
  if (!role) throw new Error("role cannot be empty")

  let email
  if (input?.email !== undefined) {
    email = String(input.email).trim().toLowerCase()
    if (!email) throw new Error("email cannot be empty")
  }

  const status = input?.status === undefined ? "active" : normalizeStatus(input.status)

  return createUserProfile({
    name: input.name.trim(),
    officeId: input.officeId,
    role,
    email,
    status,
  })
}

export async function updateUserProfileByIdService(id, patch) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const safePatch = {}

  if (typeof patch.name === "string") {
    const name = patch.name.trim()
    if (!name) throw new Error("name cannot be empty")
    safePatch.name = name
  }

  if (typeof patch.role === "string") {
    const role = patch.role.trim().toLowerCase()
    if (!role) throw new Error("role cannot be empty")
    safePatch.role = role
  }

  if (typeof patch.email === "string") {
    const email = patch.email.trim().toLowerCase()
    if (!email) throw new Error("email cannot be empty")
    safePatch.email = email
  }

  if (patch.status !== undefined) {
    const nextStatus = normalizeStatus(patch.status)
    if (nextStatus === "inactive") {
      const targetProfile = await getUserProfileById(id)
      const actorEmail = String(patch.actorEmail || "").toLowerCase()
      const targetEmail = String(targetProfile?.email || "").toLowerCase()

      if (actorEmail && targetEmail && actorEmail === targetEmail) {
        throw new Error("You cannot deactivate your own account")
      }
    }
    safePatch.status = nextStatus
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateUserProfileById(id, safePatch)
}

export async function getUserProfileByIdService(id) {
  if (!id) throw new Error("id is required")
  return getUserProfileById(id)
}

export async function listUserProfilesByOfficeIdService(officeId) {
  if (!officeId) throw new Error("officeId is required")
  return listUserProfilesByOfficeId(officeId)
}

export async function getCurrentUserProfileService(email) {
  if (!email) throw new Error("email is required")
  return getUserProfileByEmail(email)
}

export async function deleteUserProfileByIdService(id, actorEmail) {
  if (!id) throw new Error("id is required")

  const targetProfile = await getUserProfileById(id)
  const normalizedActorEmail = String(actorEmail || "").toLowerCase()
  const targetEmail = String(targetProfile?.email || "").toLowerCase()

  if (normalizedActorEmail && targetEmail && normalizedActorEmail === targetEmail) {
    throw new Error("You cannot delete your own account")
  }

  return deleteUserProfileById(id)
}
