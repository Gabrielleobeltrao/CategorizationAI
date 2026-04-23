function getBackendBaseUrl() {
  const value = String(process.env.BACKEND_API_URL || "").trim()
  if (!value) {
    throw new Error("BACKEND_API_URL is not configured")
  }

  return value.endsWith("/") ? value.slice(0, -1) : value
}

async function readRequestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) {
    return undefined
  }

  return Buffer.concat(chunks)
}

function buildUpstreamHeaders(req) {
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value === undefined) continue
    if (key.toLowerCase() === "host") continue
    if (key.toLowerCase() === "content-length") continue

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item)
      }
      continue
    }

    headers.set(key, value)
  }

  return headers
}

function applyResponseHeaders(res, upstream) {
  const setCookies = typeof upstream.headers.getSetCookie === "function"
    ? upstream.headers.getSetCookie()
    : []

  upstream.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()

    if (lowerKey === "content-length") return
    if (lowerKey === "transfer-encoding") return
    if (lowerKey === "set-cookie") return

    res.setHeader(key, value)
  })

  if (setCookies.length > 0) {
    res.setHeader("Set-Cookie", setCookies)
    return
  }

  const fallbackSetCookie = upstream.headers.get("set-cookie")
  if (fallbackSetCookie) {
    res.setHeader("Set-Cookie", fallbackSetCookie)
  }
}

export default async function handler(req, res) {
  try {
    const backendBaseUrl = getBackendBaseUrl()
    const targetUrl = `${backendBaseUrl}${req.url}`
    const body = await readRequestBody(req)

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: buildUpstreamHeaders(req),
      body,
      redirect: "manual",
    })

    const payload = Buffer.from(await upstream.arrayBuffer())

    res.statusCode = upstream.status
    applyResponseHeaders(res, upstream)
    res.end(payload)
  } catch (error) {
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({
      message: error?.message || "API proxy failed",
    }))
  }
}
