import {
  createOffice,
  deleteOfficeById,
  updateOfficeById,
  getOfficeById,
  setOfficeFeatures,
  normalizeOfficeFeatures,
} from "../repositories/office.repository.js"
import {
  getOfficeDashboardSnapshot,
  getOfficeDashboardCustomRange,
  getOfficeDashboardFeed,
} from "../repositories/dashboard.repository.js"
import { OPEN_TEST_ENABLED } from "../config/openTest.js"
import { resolveOpenTestMarkerService } from "./openTest.service.js"

function normalizeOptionalText(value) {
  if (value === undefined) return undefined
  if (value === null) return ""
  return String(value).trim()
}

export async function createOfficeService(input, context = {}) {
  if (!input?.name) throw new Error("name is required")

  const shouldValidateOpenTestCode = OPEN_TEST_ENABLED && !context?.actorHasProfile
  const office = await createOffice({
    name: input.name.trim(),
    address: normalizeOptionalText(input.address),
    businessPhone: normalizeOptionalText(input.businessPhone),
    businessEmail: normalizeOptionalText(input.businessEmail),
    openTest: null,
  })

  if (!shouldValidateOpenTestCode) {
    return office
  }

  try {
    const openTestMarker = await resolveOpenTestMarkerService(
      input?.openTestReservationToken,
      office?._id
    )

    office.isOpenTestOffice = Boolean(openTestMarker?.isOpenTestOffice)
    office.openTestAccessCodeLabel = String(openTestMarker?.accessCodeLabel || "")
    office.openTestCreatedAt = openTestMarker?.createdAt || null

    return updateOfficeById(office._id, {
      name: office.name,
      address: office.address,
      businessPhone: office.businessPhone,
      businessEmail: office.businessEmail,
      isOpenTestOffice: office.isOpenTestOffice,
      openTestAccessCodeLabel: office.openTestAccessCodeLabel,
      openTestCreatedAt: office.openTestCreatedAt,
    })
  } catch (error) {
    await deleteOfficeById(office._id)
    throw error
  }
}

export async function updateOfficeByIdService(id, patch) {
  const actorOfficeId = String(patch?.actorOfficeId || "").trim()

  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")
  if (actorOfficeId && actorOfficeId !== id) {
    throw new Error("Forbidden for this office")
  }

  const safePatch = {}

  if (typeof patch.name === "string") {
    const name = patch.name.trim()
    if (!name) throw new Error("name cannot be empty")
    safePatch.name = name
  }

  if (patch.address !== undefined) {
    safePatch.address = normalizeOptionalText(patch.address)
  }

  if (patch.businessPhone !== undefined) {
    safePatch.businessPhone = normalizeOptionalText(patch.businessPhone)
  }

  if (patch.businessEmail !== undefined) {
    safePatch.businessEmail = normalizeOptionalText(patch.businessEmail)
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateOfficeById(id, safePatch)
}

export async function getOfficeByIdService(id, options = {}) {
  if (!id) throw new Error("id is required")

  const actorOfficeId = String(options?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== id) {
    throw new Error("Forbidden for this office")
  }

  return getOfficeById(id)
}

export async function setOfficeFeaturesService(officeId, featuresPatch, options = {}) {
  if (!officeId) throw new Error("officeId is required")

  const actorOfficeId = String(options?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== String(officeId).trim()) {
    throw new Error("Forbidden for this office")
  }

  const existing = await getOfficeById(officeId)
  if (!existing) throw new Error("Office not found")

  const merged = {
    ...normalizeOfficeFeatures(existing.features),
    ...(featuresPatch && typeof featuresPatch === "object" ? featuresPatch : {}),
  }

  return setOfficeFeatures(officeId, merged)
}

export async function getOfficeDashboardByIdService(officeId, options = {}) {
  if (!officeId) throw new Error("officeId is required")

  const actorOfficeId = String(options?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== officeId) {
    throw new Error("Forbidden for this office")
  }

  return getOfficeDashboardSnapshot(officeId, {
    month: options?.month,
    actorId: options?.actorId,
    clientId: options?.clientId,
  })
}

export async function getOfficeDashboardFeedByIdService(officeId, options = {}) {
  if (!officeId) throw new Error("officeId is required")

  const actorOfficeId = String(options?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== officeId) {
    throw new Error("Forbidden for this office")
  }

  return getOfficeDashboardFeed(officeId, {
    actorId: options?.actorId,
    clientId: options?.clientId,
  })
}

export async function getOfficeDashboardCustomRangeByIdService(officeId, options = {}) {
  if (!officeId) throw new Error("officeId is required")

  const actorOfficeId = String(options?.actorOfficeId || "").trim()
  if (actorOfficeId && actorOfficeId !== officeId) {
    throw new Error("Forbidden for this office")
  }

  return getOfficeDashboardCustomRange(officeId, {
    from: options?.from,
    to: options?.to,
    actorId: options?.actorId,
    clientId: options?.clientId,
  })
}
