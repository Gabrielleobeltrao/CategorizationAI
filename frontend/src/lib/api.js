const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL || "http://localhost:3001"
  : ""
let pendingRequests = 0
let pendingBackgroundRequests = 0
let lastBackgroundLoadingMessage = "Refreshing cached data..."

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

function emitBackgroundLoadingState() {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent("app:background-loading-state", {
      detail: {
        isVisible: pendingBackgroundRequests > 0,
        pendingRequests: pendingBackgroundRequests,
        message: lastBackgroundLoadingMessage,
      },
    })
  )
}

function startBackgroundLoading(message) {
  lastBackgroundLoadingMessage = String(message || "").trim() || "Refreshing cached data..."
  pendingBackgroundRequests += 1
  emitBackgroundLoadingState()
}

function stopBackgroundLoading() {
  pendingBackgroundRequests = Math.max(0, pendingBackgroundRequests - 1)
  emitBackgroundLoadingState()
}

export async function api(path, options = {}) {
  const { silentLoading = false, backgroundLoadingMessage = "", ...fetchOptions } = options
  const method = String(fetchOptions.method || "GET").toUpperCase()
  const useGlobalLoading = !silentLoading && method !== "GET"
  const useBackgroundLoading = Boolean(String(backgroundLoadingMessage || "").trim())

  if (useGlobalLoading) {
    startLoading()
  }
  if (useBackgroundLoading) {
    startBackgroundLoading(backgroundLoadingMessage)
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
      throw new Error(
        typeof data === "object" && data?.message
          ? data.message
          : `Request failed: ${response.status}`
      )
    }

    return data
  } finally {
    if (useGlobalLoading) {
      stopLoading()
    }
    if (useBackgroundLoading) {
      stopBackgroundLoading()
    }
  }
}
