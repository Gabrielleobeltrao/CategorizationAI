const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "")
const API_BASE_URL = configuredApiUrl || (import.meta.env.DEV ? "http://localhost:3001" : "")
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
  }
}
