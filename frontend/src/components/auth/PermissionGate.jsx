import { useAuth } from "../../contexts/auth.context"
import { hasPermission } from "../../utils/permissions"

/**
 * Conditionally renders children when the logged-in user holds a given
 * permission. Mirrors FeatureGate's API.
 *
 * Examples:
 *   <PermissionGate permission="tasks:read">...</PermissionGate>
 *   <PermissionGate permission="tasks:read" fallback={<Navigate to="/home" />}>
 *     ...
 *   </PermissionGate>
 */
function PermissionGate({ permission, fallback = null, children }) {
    const { profile } = useAuth()
    const granted = hasPermission(profile?.permissions, permission)
    if (!granted) return fallback
    return children
}

export default PermissionGate
