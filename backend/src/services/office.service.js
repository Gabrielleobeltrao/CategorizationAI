import {
  createOffice,
  updateOfficeById,
  getOfficeById,
} from "../repositories/office.repository.js"
import { getOfficeDashboardSnapshot } from "../repositories/dashboard.repository.js"

export async function createOfficeService(input) {
  if (!input?.name) throw new Error("name is required")

  return createOffice({
    name: input.name.trim(),
  })
}

export async function updateOfficeByIdService(id, patch) {
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

  return updateOfficeById(id, safePatch)
}

export async function getOfficeByIdService(id) {
  if (!id) throw new Error("id is required")
  return getOfficeById(id)
}

export async function getOfficeDashboardByIdService(officeId, options = {}) {
  if (!officeId) throw new Error("officeId is required")

  const actorOfficeId = String(options?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== officeId) {
    throw new Error("Forbidden for this office")
  }

  return getOfficeDashboardSnapshot(officeId, {
    month: options?.month,
  })
}
