import express from "express"
import cors from "cors"
import { toNodeHandler } from "better-auth/node"
import { auth } from "./lib/auth.js"
import routes from "./routes/index.js"

const app = express()

app.all("/api/auth/splat*", toNodeHandler(auth))

app.use(cors())
app.use(express.json())

app.use("/api", routes)

export default app