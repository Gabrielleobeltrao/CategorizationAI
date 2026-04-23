import { api } from "../lib/api"

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

  await api("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })

  return api("/api/registration/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      name,
      officeName,
      officeAddress,
      officePhone,
      officeEmail,
      openTestAccessCode,
    }),
  })
}

export async function completeRegistrationWithOffice(input) {
  const name = input?.name?.trim()
  const officeName = input?.officeName?.trim()
  const officeAddress = String(input?.officeAddress || "").trim()
  const officePhone = String(input?.officePhone || "").trim()
  const officeEmail = String(input?.officeEmail || "").trim()
  const openTestAccessCode = String(input?.openTestAccessCode || "").trim()
  const requiresOpenTestAccessCode = Boolean(
    input?.openTestConfig?.registrationRequiresAccessCode ?? input?.requiresOpenTestAccessCode
  )

  if (!officeName) throw new Error("officeName is required")
  if (requiresOpenTestAccessCode && !openTestAccessCode) {
    throw new Error("openTestAccessCode is required")
  }

  return api("/api/registration/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      name,
      officeName,
      officeAddress,
      officePhone,
      officeEmail,
      openTestAccessCode,
    }),
  })
}
