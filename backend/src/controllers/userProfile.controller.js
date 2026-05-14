import {
  createEmployeeAccountService,
  createUserProfileService,
  updateUserProfileByIdService,
  updateCurrentUserProfileService,
  getUserProfileByIdService,
  listUserProfilesByOfficeIdService,
  getCurrentUserProfileService,
  deleteUserProfileByIdService,
  resetEmployeePasswordByIdService,
  completeMyPasswordResetService,
} from "../services/userProfile.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function createEmployeeAccountController(req, res) {
  try {
    const result = await createEmployeeAccountService(req.body, {
      auth: req.app.locals.auth,
      actorProfileId: req.userProfile?._id ? String(req.userProfile._id) : "",
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function createUserProfileController(req, res) {
  try {
    const profile = await createUserProfileService(req.body, {
      actorProfileId: req.userProfile?._id ? String(req.userProfile._id) : "",
    })
    return res.status(201).json(profile)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateUserProfileByIdController(req, res) {
  try {
    const { id } = req.params
    const updatedProfile = await updateUserProfileByIdService(id, {
      ...req.body,
      actorEmail: req.user?.email,
    })
    return res.status(200).json(updatedProfile)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getUserProfileByIdController(req, res) {
  try {
    const profile = req.scope?.userProfile || await getUserProfileByIdService(req.params.id)

    if (!profile) {
      return res.status(404).json({
        message: "User profile not found",
      })
    }

    return res.status(200).json(profile)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function listUserProfilesByOfficeIdController(req, res) {
  try {
    const { officeId } = req.params
    const profiles = await listUserProfilesByOfficeIdService(officeId)
    return res.status(200).json(profiles)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function getMyUserProfileController(req, res) {
  try {
    const profile = await getCurrentUserProfileService(req.user?.email, {
      currentProfile: req.userProfile,
    })

    if (!profile) {
      return res.status(404).json({
        message: "User profile not found",
      })
    }

    return res.status(200).json(profile)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function updateMyUserProfileController(req, res) {
  try {
    const profile = await updateCurrentUserProfileService(req.user?.email, req.body, {
      currentProfile: req.userProfile,
    })
    return res.status(200).json(profile)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function deleteUserProfileByIdController(req, res) {
  try {
    const { id } = req.params
    const deletedProfile = await deleteUserProfileByIdService(id, req.user?.email)
    return res.status(200).json(deletedProfile)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function resetEmployeePasswordByIdController(req, res) {
  try {
    const { id } = req.params
    const result = await resetEmployeePasswordByIdService(id, req.user?.email)
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

export async function completeMyPasswordResetController(req, res) {
  try {
    const result = await completeMyPasswordResetService(req.user?.email, req.body?.newPassword)
    return res.status(200).json(result)
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
