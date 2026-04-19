import { api } from "../lib/api"

export async function getOfficeById(officeId) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  return api(`/api/offices/${id}`)
}

export async function updateOfficeById(officeId, patch) {
  const id = String(officeId || "").trim()
  if (!id) throw new Error("officeId is required")

  return api(`/api/offices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}
