import { getCurrentUserProfileService } from "../services/userProfile.service.js"
import { getOfficeByIdService } from "../services/office.service.js"
import { normalizeOfficeFeatures } from "../repositories/office.repository.js"
import { listPermissionsCatalogService, listRolesForOfficeService } from "../services/roles.service.js"
import { listOfficeTagsService } from "../services/tag.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getAppBootstrapController(req, res) {
  try {
    const sessionData = await req.app.locals.auth.api.getSession({ headers: req.headers })

    if (!sessionData?.session || !sessionData?.user) {
      return res.status(200).json({
        isAuthenticated: false,
        profile: null,
      })
    }

    const email = String(sessionData.user.email || "").trim().toLowerCase()
    const profile = email ? await getCurrentUserProfileService(email) : null

    if (profile?.status === "inactive") {
      return res.status(403).json({ message: "Account is inactive" })
    }

    const officeId = String(profile?.officeId || "").trim()
    const [officeResult, rolesResult, officeTagsResult] = await Promise.allSettled([
      officeId ? getOfficeByIdService(officeId, { currentProfile: profile }) : Promise.resolve(null),
      officeId ? listRolesForOfficeService(officeId) : Promise.resolve([]),
      officeId ? listOfficeTagsService(officeId, { actorOfficeId: officeId }) : Promise.resolve([]),
    ])
    const office = officeResult.status === "fulfilled" ? officeResult.value : null
    const roles = rolesResult.status === "fulfilled" && Array.isArray(rolesResult.value) ? rolesResult.value : []
    const officeTags = officeTagsResult.status === "fulfilled" && Array.isArray(officeTagsResult.value)
      ? officeTagsResult.value
      : []

    const officeWithFeatures = office
      ? { ...office, features: normalizeOfficeFeatures(office.features) }
      : null

    return res.status(200).json({
      isAuthenticated: true,
      profile: profile || null,
      office: officeWithFeatures,
      officeTags,
      roles,
      permissionCatalog: listPermissionsCatalogService(),
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}
