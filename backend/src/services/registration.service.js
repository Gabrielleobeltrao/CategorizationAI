import { AppError } from "../utils/appError.js"
import { createOfficeService } from "./office.service.js"
import {
  createUserProfileService,
  getCurrentUserProfileService,
} from "./userProfile.service.js"
import {
  getUserProfileByEmail,
  updateUserProfileById,
} from "../repositories/userProfile.repository.js"
import {
  rollbackOpenTestMarkerByOfficeIdService,
  validateOpenTestAccessCodeService,
} from "./openTest.service.js"
import { deleteOfficeById, getOfficeById } from "../repositories/office.repository.js"

function normalizeOptionalText(value) {
  return String(value || "").trim()
}

export async function bootstrapRegistrationService(input, context = {}) {
  const email = String(context?.user?.email || "").trim().toLowerCase()
  const authUserId = String(context?.user?.id || "").trim()
  const fallbackName = normalizeOptionalText(context?.user?.name)
  const name = normalizeOptionalText(input?.name) || fallbackName

  if (!email) {
    throw new AppError("Unauthorized", 401)
  }

  if (!name) {
    throw new AppError("name is required", 400)
  }

  if (!input?.officeName) {
    throw new AppError("officeName is required", 400)
  }

  const existingProfile = context?.currentProfile?._id
    ? context.currentProfile
    : await getUserProfileByEmail(email)

  if (existingProfile?.officeId) {
    const existingOffice = await getOfficeById(existingProfile.officeId)

    return {
      office: existingOffice,
      profile: await getCurrentUserProfileService(email, {
        currentProfile: existingProfile,
      }),
      alreadyCompleted: true,
    }
  }

  let reservationToken = ""
  let office = null

  try {
    const accessCode = normalizeOptionalText(input?.openTestAccessCode)
    if (accessCode) {
      const reservation = await validateOpenTestAccessCodeService(accessCode)
      reservationToken = String(reservation?.reservationToken || "").trim()
    }

    office = await createOfficeService({
      name: String(input.officeName).trim(),
      address: normalizeOptionalText(input?.officeAddress),
      businessPhone: normalizeOptionalText(input?.officePhone),
      businessEmail: normalizeOptionalText(input?.officeEmail),
      openTestReservationToken: reservationToken,
    }, {
      actorHasProfile: false,
    })

    let profile

    if (existingProfile?._id) {
      profile = await updateUserProfileById(String(existingProfile._id), {
        name,
        email,
        officeId: String(office._id),
        role: "owner",
        status: "active",
        authUserId: authUserId || existingProfile.authUserId,
      })
    } else {
      profile = await createUserProfileService({
        name,
        email,
        officeId: String(office._id),
        role: "owner",
        status: "active",
        authUserId: authUserId || undefined,
      })
    }

    return {
      office,
      profile: await getCurrentUserProfileService(email, {
        currentProfile: profile,
      }),
      alreadyCompleted: false,
    }
  } catch (error) {
    if (office?._id) {
      await rollbackOpenTestMarkerByOfficeIdService(String(office._id)).catch(() => null)
      await deleteOfficeById(String(office._id)).catch(() => null)
    }

    throw error
  }
}
