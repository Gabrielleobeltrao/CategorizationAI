function getBackendBaseUrl() {
  const value = String(process.env.BACKEND_API_URL || "").trim()
  if (!value) {
    throw new Error("BACKEND_API_URL is not configured")
  }

  return value.endsWith("/") ? value.slice(0, -1) : value
}

const API_PROXY_TIMEOUT_MS = Math.max(1000, Number(process.env.API_PROXY_TIMEOUT_MS || 25000))
const API_PROXY_DEBUG = String(process.env.API_PROXY_DEBUG || "false").trim().toLowerCase() === "true"
const API_PROXY_SLOW_MS = Math.max(0, Number(process.env.API_PROXY_SLOW_MS || 1000))

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6
}

function roundMs(value) {
  return Math.round(Number(value || 0))
}

function shouldLogProxyMetric(totalMs) {
  return API_PROXY_DEBUG || (API_PROXY_SLOW_MS > 0 && totalMs >= API_PROXY_SLOW_MS)
}

function logProxyMetric(metric = {}) {
  const totalMs = roundMs(metric.totalMs)
  if (!shouldLogProxyMetric(totalMs)) return

  console.info("[api.proxy]", JSON.stringify({
    totalMs,
    upstreamMs: roundMs(metric.upstreamMs),
    readMs: roundMs(metric.readMs),
    method: metric.method,
    path: metric.path,
    status: metric.status,
    timedOut: Boolean(metric.timedOut),
  }))
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
    if (lowerKey === "content-encoding") return
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

function normalizeApiPath(rawPath) {
  const safePath = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "")
  return safePath.replace(/^\/+/, "")
}

export default async function handler(req, res) {
  const requestStartMs = nowMs()
  const metric = {
    method: req.method,
    path: normalizeApiPath(req.query?.path),
    status: 500,
    timedOut: false,
  }
  let timeoutId = null

  try {
    const backendBaseUrl = getBackendBaseUrl()
    const upstreamPath = metric.path
    const targetUrl = new URL(`${backendBaseUrl}/api/${upstreamPath}`)

    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === "path") continue
      if (Array.isArray(value)) {
        value.forEach((item) => targetUrl.searchParams.append(key, item))
        continue
      }
      if (value !== undefined) {
        targetUrl.searchParams.set(key, value)
      }
    }

    const body = await readRequestBody(req)
    const abortController = new AbortController()
    timeoutId = setTimeout(() => {
      metric.timedOut = true
      abortController.abort()
    }, API_PROXY_TIMEOUT_MS)

    const upstreamStartMs = nowMs()
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: buildUpstreamHeaders(req),
      body,
      redirect: "manual",
      signal: abortController.signal,
    })
    metric.upstreamMs = nowMs() - upstreamStartMs

    const readStartMs = nowMs()
    const payload = Buffer.from(await upstream.arrayBuffer())
    metric.readMs = nowMs() - readStartMs

    res.statusCode = upstream.status
    metric.status = upstream.status
    applyResponseHeaders(res, upstream)
    res.setHeader("Server-Timing", `proxy;dur=${roundMs(nowMs() - requestStartMs)}, upstream;dur=${roundMs(metric.upstreamMs)}, read;dur=${roundMs(metric.readMs)}`)
    res.end(payload)
  } catch (error) {
    const isTimeout = metric.timedOut || error?.name === "AbortError"
    res.statusCode = isTimeout ? 504 : 500
    metric.status = res.statusCode
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({
      message: isTimeout ? "API proxy timed out" : error?.message || "API proxy failed",
    }))
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    metric.totalMs = nowMs() - requestStartMs
    logProxyMetric(metric)
  }
}
