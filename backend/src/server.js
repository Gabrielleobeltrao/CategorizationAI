import "dotenv/config"
import { webcrypto } from "node:crypto"
import { connectDB, getDB } from "./db.js"
import app from "./app.js"
import { createAuth } from "./lib/auth.js"
import {
  backfillTransactionsSearchAndDerivedFields,
  ensureTransactionsIndexes,
} from "./repositories/transactions.repository.js"
import { ensureCategorizationJobsIndexes } from "./repositories/categorizationJob.repository.js"
import { ensureTransactionMemoryIndexes } from "./repositories/transactionMemory.repository.js"
import { ensureUserProfileIndexes } from "./repositories/userProfile.repository.js"
import { ensureClientsIndexes } from "./repositories/clients.repository.js"
import { ensureAccountIndexes } from "./repositories/account.repository.js"
import { ensureCategoryIndexes } from "./repositories/category.repository.js"
import { ensureCategoryTemplateIndexes } from "./repositories/categoryTemplate.repository.js"
import { ensureCoaPresetTemplateIndexes } from "./repositories/coaPresetTemplate.repository.js"
import { ensureReconciliationIndexes } from "./repositories/reconciliation.repository.js"
import { ensureOfficeTagIndexes } from "./repositories/tag.repository.js"
import { ensureOpenTestAccessCodeIndexes } from "./repositories/openTestAccessCode.repository.js"
import { ensureTasksIndexes } from "./repositories/tasks.repository.js"
import { ensureClientOperationalStatusIndexes } from "./repositories/clientOperationalStatus.repository.js"
import { ensureBoardCollectionsIndexes } from "./repositories/boardCollections.repository.js"
import { ensureJournalEntriesIndexes } from "./repositories/journalEntries.repository.js"
import { startCategorizationWorker } from "./workers/categorization.worker.js"
import { startCategorySyncWorker } from "./workers/categorySync.worker.js"

const PORT = process.env.PORT || 3001

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

await connectDB()

await ensureTransactionsIndexes()
await ensureCategorizationJobsIndexes()
await ensureTransactionMemoryIndexes()
await ensureUserProfileIndexes()
await ensureClientsIndexes()
await ensureAccountIndexes()
await ensureCategoryIndexes()
await ensureCategoryTemplateIndexes()
await ensureCoaPresetTemplateIndexes()
await ensureReconciliationIndexes()
await ensureOfficeTagIndexes()
await ensureOpenTestAccessCodeIndexes()
await ensureTasksIndexes()
await ensureClientOperationalStatusIndexes()
await ensureBoardCollectionsIndexes()
await ensureJournalEntriesIndexes()

app.locals.auth = createAuth(getDB())
await startCategorizationWorker()
await startCategorySyncWorker()

backfillTransactionsSearchAndDerivedFields().catch((error) => {
  console.error("[server] transactions backfill failed", error)
})

app.listen(PORT, () => console.log(`API running on ${PORT}`))
