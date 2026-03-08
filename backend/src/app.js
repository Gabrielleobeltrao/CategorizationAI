import express from "express"
import cors from "cors"
import { toNodeHandler } from "better-auth/node"
import routes from "./routes/index.js"

const app = express()

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}))

app.use(express.json())

app.all("/api/auth/*splat", (req, res) => {
  return toNodeHandler(req.app.locals.auth)(req, res)
})

app.use("/api", routes)

export default app
