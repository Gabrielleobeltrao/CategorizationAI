import "dotenv/config"
import { connectDB, getDB } from "./db.js"
import app from "./app.js"
import { createAuth } from "./lib/auth.js"
import { ensureTransactionsIndexes } from "./repositories/transactions.repository.js"
import { ensureCategorizationJobsIndexes } from "./repositories/categorizationJob.repository.js"
import { ensureTransactionMemoryIndexes } from "./repositories/transactionMemory.repository.js"
import { ensureUserProfileIndexes } from "./repositories/userProfile.repository.js"
import { ensureClientsIndexes } from "./repositories/clients.repository.js"
import { ensureAccountIndexes } from "./repositories/account.repository.js"
import { ensureCategoryIndexes } from "./repositories/category.repository.js"
import { startCategorizationWorker } from "./workers/categorization.worker.js"

const PORT = process.env.PORT || 3001

await connectDB()

await ensureTransactionsIndexes()
await ensureCategorizationJobsIndexes()
await ensureTransactionMemoryIndexes()
await ensureUserProfileIndexes()
await ensureClientsIndexes()
await ensureAccountIndexes()
await ensureCategoryIndexes()

app.locals.auth = createAuth(getDB())
await startCategorizationWorker()

app.listen(PORT, () => console.log(`API running on ${PORT}`))
