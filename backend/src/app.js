import express from "express"
import cors from "cors"
import { toNodeHandler } from "better-auth/node"
import routes from "./routes/index.js"
import { isAllowedOrigin } from "./config/security.js"
import { getErrorStatusCode } from "./utils/appError.js"

const app = express()

app.disable("x-powered-by")

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true)
    }

    return callback(new Error("Origin not allowed by CORS"))
  },
  credentials: true,
}))

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  )

  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store")
    res.setHeader("Pragma", "no-cache")
  }

  next()
})

app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    return await toNodeHandler(req.app.locals.auth)(req, res)
  } catch (error) {
    return next(error)
  }
})

app.use(express.json({ limit: "2mb" }))

app.use("/api", routes)

app.use((error, req, res, next) => {
  console.error({
    message: error?.message || "Internal Server Error",
    path: req.path,
    method: req.method,
    statusCode: error?.statusCode || error?.status || 500,
  })

  if (res.headersSent) {
    return next(error)
  }

  const statusCode = getErrorStatusCode(error, 500)
  const isServerError = statusCode >= 500

  return res.status(statusCode).json({
    message: isServerError ? "Internal Server Error" : error?.message || "Request failed",
  })
})

export default app
