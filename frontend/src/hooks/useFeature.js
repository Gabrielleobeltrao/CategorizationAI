import { useAuth } from "../contexts/auth.context"

/**
 * Returns true when the office has the given paid add-on enabled.
 * Defaults to false for unknown flags so UI fails closed.
 */
export function useFeature(flag) {
  const { features } = useAuth()
  if (!flag) return false
  return Boolean(features?.[flag])
}
