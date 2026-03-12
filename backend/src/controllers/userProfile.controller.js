import {
  createUserProfileService,
  updateUserProfileByIdService,
  getUserProfileByIdService,
} from "../services/userProfile.service.js"

export async function createUserProfileController(req, res) {
  try {
    const profile = await createUserProfileService(req.body)
    return res.status(201).json(profile)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function updateUserProfileByIdController(req, res) {
  try {
    const { id } = req.params
    const updatedProfile = await updateUserProfileByIdService(id, req.body)
    return res.status(200).json(updatedProfile)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function getUserProfileByIdController(req, res) {
  try {
    const { id } = req.params
    const profile = await getUserProfileByIdService(id)

    if (!profile) {
      return res.status(404).json({
        message: "User profile not found",
      })
    }

    return res.status(200).json(profile)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}
