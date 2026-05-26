const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "")
const API_BASE_URL = import.meta.env.DEV ? configuredApiUrl || "http://localhost:3001" : ""

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

let pendingRequests = 0

function emitLoadingState() {
  if (typeof window === "undefined") return

  const isVisible = pendingRequests > 0
  window.dispatchEvent(
    new CustomEvent("app:loading-state", {
      detail: { isVisible, pendingRequests },
    })
  )
}

function startLoading() {
  pendingRequests += 1
  emitLoadingState()
}

function stopLoading() {
  pendingRequests = Math.max(0, pendingRequests - 1)
  emitLoadingState()
}

export async function api(path, options = {}) {
  const { silentLoading = false, backgroundLoadingMessage = "", ...fetchOptions } = options
  const method = String(fetchOptions.method || "GET").toUpperCase()
  const useGlobalLoading = !silentLoading && method !== "GET"
  void backgroundLoadingMessage

  if (useGlobalLoading) {
    startLoading()
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      },
      ...fetchOptions,
    })

    const contentType = response.headers.get("content-type") || ""
    const isJson = contentType.includes("application/json")
    const data = isJson ? await response.json() : await response.text()

    if (!response.ok) {
      const message =
        typeof data === "object" && data?.message
          ? data.message
          : `Request failed: ${response.status}`
      const err = new Error(message)
      err.status = response.status
      if (typeof data === "object" && data) {
        // Preserve domain-specific code + details so callers can render
        // context-aware UI (deep links, retry buttons, etc.).
        if (data.code) err.code = data.code
        if (data.details) {
          err.details = data.details
          if (!err.code && data.details.code) err.code = data.details.code
        }
      }
      throw err
    }

    return data
  } finally {
    if (useGlobalLoading) {
      stopLoading()
    }
  }
}
