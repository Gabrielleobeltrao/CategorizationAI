export function readSessionCache(key, fallback = null) {
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeSessionCache(key, value) {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage failures
  }
}

export function removeSessionCache(key) {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore storage failures
  }
}
