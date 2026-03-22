import { api } from "../lib/api"

export async function registerWithOffice(input) {
  const name = input?.name?.trim()
  const email = input?.email?.trim().toLowerCase()
  const password = input?.password
  const officeName = input?.officeName?.trim()

  if (!name) throw new Error("name is required")
  if (!email) throw new Error("email is required")
  if (!password) throw new Error("password is required")
  if (!officeName) throw new Error("officeName is required")

  await api("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })

  const office = await api("/api/offices", {
    method: "POST",
    body: JSON.stringify({ name: officeName }),
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
}

