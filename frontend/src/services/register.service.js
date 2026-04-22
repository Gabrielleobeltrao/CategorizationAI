import { api } from "../lib/api"
import {
  releaseOpenTestAccessReservation,
  validateOpenTestAccessCode,
} from "./openTest.service"

export async function registerWithOffice(input) {
  const name = input?.name?.trim()
  const email = input?.email?.trim().toLowerCase()
  const password = input?.password
  const officeName = input?.officeName?.trim()
  const officeAddress = String(input?.officeAddress || "").trim()
  const officePhone = String(input?.officePhone || "").trim()
  const officeEmail = String(input?.officeEmail || "").trim()
  const openTestAccessCode = String(input?.openTestAccessCode || "").trim()
  const requiresOpenTestAccessCode = Boolean(
    input?.openTestConfig?.registrationRequiresAccessCode ?? input?.requiresOpenTestAccessCode
  )

  if (!name) throw new Error("name is required")
  if (!email) throw new Error("email is required")
  if (!password) throw new Error("password is required")
  if (!officeName) throw new Error("officeName is required")
  if (requiresOpenTestAccessCode && !openTestAccessCode) {
    throw new Error("openTestAccessCode is required")
  }

  let reservationToken = ""

  try {
    if (requiresOpenTestAccessCode) {
      const reservation = await validateOpenTestAccessCode(openTestAccessCode)
      reservationToken = String(reservation?.reservationToken || "").trim()
      if (!reservationToken) {
        throw new Error("Failed to reserve private beta access code")
      }
    }

    await api("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    })

    const office = await api("/api/offices", {
      method: "POST",
      body: JSON.stringify({
        name: officeName,
        address: officeAddress,
        businessPhone: officePhone,
        businessEmail: officeEmail,
        openTestReservationToken: reservationToken,
      }),
    })

    const officeId = office?._id
    if (!officeId) throw new Error("failed to create office")

    const profile = await api("/api/user-profiles", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        officeId,
        role: "owner",
      }),
    })

    return { office, profile }
  } catch (error) {
    if (reservationToken) {
      try {
        await releaseOpenTestAccessReservation(reservationToken)
      } catch {
        // ignore reservation release failures
      }
    }

    throw error
  }
}
