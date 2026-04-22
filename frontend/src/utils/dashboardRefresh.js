const DASHBOARD_REFRESH_EVENT = "office:dashboard:refresh"

export function emitDashboardRefresh(reason = "") {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent(DASHBOARD_REFRESH_EVENT, {
      detail: {
        reason: String(reason || "").trim(),
        at: Date.now(),
      },
    })
  )
}

export function subscribeDashboardRefresh(listener) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const safeListener = typeof listener === "function" ? listener : () => {}
  const handler = (event) => {
    safeListener(event?.detail || {})
  }

  window.addEventListener(DASHBOARD_REFRESH_EVENT, handler)

  return () => {
    window.removeEventListener(DASHBOARD_REFRESH_EVENT, handler)
  }
}
