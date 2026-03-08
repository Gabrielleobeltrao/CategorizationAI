import "dotenv/config"
import { connectDB, getDB } from "./bd.js"
import app from "./app.js"
import { createAuth } from "./lib/auth.js"

const PORT = process.env.PORT || 3001

await connectDB()
app.locals.auth = createAuth(getDB())

app.listen(PORT, () => console.log(`API running on ${PORT}`))