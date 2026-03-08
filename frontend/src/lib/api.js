const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
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
}
