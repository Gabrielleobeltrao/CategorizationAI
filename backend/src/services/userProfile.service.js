import {
  createUserProfile,
  updateUserProfileById,
  getUserProfileById,
  listUserProfilesByOfficeId,
  getUserProfileByEmail,
  deleteUserProfileById,
  getAuthUserByEmail,
  setCredentialPasswordByAuthUserId,
} from "../repositories/userProfile.repository.js"
import { roleExistsForOfficeService } from "./roles.service.js"
import { hashPassword } from "better-auth/crypto"

function generateTemporaryPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$"
  let result = ""
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * chars.length)
    result += chars[index]
  }
  return result
}

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

  const roleExists = await roleExistsForOfficeService(role, input.officeId)
  if (!roleExists) throw new Error("role is invalid for this office")

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
    authUserId: input?.authUserId || undefined,
    mustChangePassword: Boolean(input?.mustChangePassword),
    passwordResetAt: input?.passwordResetAt || null,
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

    const targetProfile = await getUserProfileById(id)
    if (!targetProfile) throw new Error("User profile not found")
    const roleExists = await roleExistsForOfficeService(role, targetProfile.officeId)
    if (!roleExists) throw new Error("role is invalid for this office")

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

export async function resetEmployeePasswordByIdService(id, actorEmail) {
  if (!id) throw new Error("id is required")

  const targetProfile = await getUserProfileById(id)
  if (!targetProfile) throw new Error("User profile not found")

  const normalizedActorEmail = String(actorEmail || "").toLowerCase()
  const targetEmail = String(targetProfile?.email || "").toLowerCase()

  if (!targetEmail) {
    throw new Error("Target employee has no email in user profile")
  }

  if (normalizedActorEmail && targetEmail && normalizedActorEmail === targetEmail) {
    throw new Error("You cannot reset your own password from this screen")
  }

  const authUser = await getAuthUserByEmail(targetEmail)
  if (!authUser?._id) {
    throw new Error("Auth user not found")
  }

  const temporaryPassword = generateTemporaryPassword()
  const hashedPassword = await hashPassword(temporaryPassword)

  const updatedAccount = await setCredentialPasswordByAuthUserId(authUser._id, hashedPassword)
  if (!updatedAccount) {
    throw new Error("Credential account not found")
  }

  await updateUserProfileById(id, {
    authUserId: String(authUser._id),
    mustChangePassword: true,
    passwordResetAt: new Date(),
  })

  return {
    email: targetEmail,
    temporaryPassword,
    mustChangePassword: true,
  }
}

export async function completeMyPasswordResetService(email, newPassword) {
  const safeEmail = String(email || "").trim().toLowerCase()
  const safePassword = String(newPassword || "")

  if (!safeEmail) throw new Error("email is required")
  if (!safePassword) throw new Error("newPassword is required")
  if (safePassword.length < 8) throw new Error("Password must have at least 8 characters")

  const profile = await getUserProfileByEmail(safeEmail)
  if (!profile) throw new Error("User profile not found")
  if (!profile.mustChangePassword) {
    return { status: true, mustChangePassword: false }
  }

  const authUser = await getAuthUserByEmail(safeEmail)
  if (!authUser?._id) throw new Error("Auth user not found")

  const hashedPassword = await hashPassword(safePassword)
  const updatedAccount = await setCredentialPasswordByAuthUserId(authUser._id, hashedPassword)
  if (!updatedAccount) throw new Error("Credential account not found")

  await updateUserProfileById(String(profile._id), {
    mustChangePassword: false,
    updatedAt: new Date(),
  })

  return { status: true, mustChangePassword: false }
}
