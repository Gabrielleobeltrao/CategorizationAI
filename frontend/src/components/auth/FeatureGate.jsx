import { useFeature } from "../../hooks/useFeature"

/**
 * Conditionally renders children when an office feature flag is active.
 * Use this at any boundary that gates a paid add-on (menu items, tabs, widgets).
 *
 * <FeatureGate flag="crm">...</FeatureGate>
 * <FeatureGate flag="crm" fallback={<UpsellBanner />}>...</FeatureGate>
 */
function FeatureGate({ flag, fallback = null, children }) {
    const isEnabled = useFeature(flag)
    if (!isEnabled) return fallback
    return children
}

export default FeatureGate
