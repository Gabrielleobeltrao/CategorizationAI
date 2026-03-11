import "dotenv/config"
import { connectDB, getDB } from "./db.js"
import app from "./app.js"
import { createAuth } from "./lib/auth.js"
import { ensureTransactionsIndexes } from "./repositories/transactions.repository.js"

const PORT = process.env.PORT || 3001

await connectDB()

await ensureTransactionsIndexes()

app.locals.auth = createAuth(getDB())

app.listen(PORT, () => console.log(`API running on ${PORT}`))