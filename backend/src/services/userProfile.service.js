import {
  createUserProfile,
  updateUserProfileById,
  getUserProfileById,
} from "../repositories/userProfile.repository.js"

export async function createUserProfileService(input) {
  if (!input?.name) throw new Error("name is required")
  if (!input?.officeId) throw new Error("officeId is required")

  return createUserProfile({
    name: input.name.trim(),
    officeId: input.officeId,
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

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateUserProfileById(id, safePatch)
}

export async function getUserProfileByIdService(id) {
  if (!id) throw new Error("id is required")
  return getUserProfileById(id)
}
