import { getOfficeById, normalizeOfficeFeatures } from "../repositories/office.repository.js"

/**
 * Gate a route behind a paid add-on flag (e.g. CRM). Requires requireAuth and
 * requirePermission to have populated req.userProfile.officeId.
 *
 * Returns 402 Payment Required when the office has authenticated but lacks the
 * feature — distinct from 403 (forbidden / no permission).
 */
export function requireFeature(flag) {
  const featureFlag = String(flag || "").trim()
  if (!featureFlag) {
    throw new Error("requireFeature: flag is required")
  }

  return async (req, res, next) => {
    try {
      const officeId = String(req.userProfile?.officeId || "").trim()
      if (!officeId) {
        return res.status(403).json({ message: "Office context required" })
      }

      const office = req.office || (await getOfficeById(officeId))
      if (!office) {
        return res.status(403).json({ message: "Office not found" })
      }

      const features = normalizeOfficeFeatures(office.features)
      if (!features[featureFlag]) {
        return res.status(402).json({
          message: "This add-on is not active for your office",
          feature: featureFlag,
        })
      }

      req.office = office
      return next()
    } catch {
      return res.status(403).json({ message: "Forbidden" })
    }
  }
}
