import express from "express"
import cors from "cors"
import { toNodeHandler } from "better-auth/node"
import routes from "./routes/index.js"

const app = express()

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}))

app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    return await toNodeHandler(req.app.locals.auth)(req, res)
  } catch (error) {
    return next(error)
  }
})

app.use(express.json())

app.use("/api", routes)

app.use((error, req, res, next) => {
  console.error(error)
  if (res.headersSent) {
    return next(error)
  }
  return res.status(500).json({
    message: error?.message || "Internal Server Error",
  })
})

export default app
