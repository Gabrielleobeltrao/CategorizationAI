import { userClientScopeAllowsClient } from "../services/roles.service.js"

// Use AFTER ensureResourceExists({ collection: "clients", ... }) has loaded
// the client into req.scope. Resolves the clientId from a configurable
// source (param/body/query). Returns 404 (not 403) for unassigned clients
// so we don't leak existence to restricted users.
export function requireClientAccess({ from = "params", field = "clientId" } = {}) {
    return (req, res, next) => {
        const source =
            from === "params" ? req.params :
            from === "body" ? req.body :
            from === "query" ? req.query :
            null
        const clientId = String(source?.[field] || req.scope?.client?._id || "").trim()
        if (!clientId) return next()

        const profile = req.userProfile
        if (!profile) {
            return res.status(401).json({ message: "Unauthorized" })
        }
        if (!userClientScopeAllowsClient(profile, clientId)) {
            return res.status(404).json({ message: "Client not found" })
        }
        return next()
    }
}
