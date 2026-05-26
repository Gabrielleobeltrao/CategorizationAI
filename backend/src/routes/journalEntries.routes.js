import { Router } from "express"
import {
  createJournalEntryController,
  updateJournalEntryByIdController,
  getJournalEntryByIdController,
  listJournalEntriesByClientIdController,
  deleteJournalEntryByIdController,
  deleteJournalEntriesBatchController,
  createHalfEntryController,
  categorizeEntryController,
  listUncategorizedEntriesController,
  categorizeWithAiController,
} from "../controllers/journalEntries.controller.js"
import { requireAuth } from "../middlewares/requireAuth.js"
import {
  validateObjectIdParam,
  validateObjectIdBody,
  validateObjectIdBodyArray,
} from "../middlewares/validateObjectId.js"
import { ensureResourceExists } from "../middlewares/authorizeScope.js"
import { requirePermission } from "../middlewares/requirePermission.js"

const router = Router()

router.post(
  "/journal-entries",
  requireAuth,
  requirePermission("transactions:create"),
  validateObjectIdBody("clientId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createJournalEntryController,
)

router.get(
  "/clients/:clientId/journal-entries",
  requireAuth,
  requirePermission("transactions:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listJournalEntriesByClientIdController,
)

router.get(
  "/journal-entries/:id",
  requireAuth,
  requirePermission("transactions:read"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "journal_entries", from: "params", field: "id", assignKey: "journalEntry" }),
  getJournalEntryByIdController,
)

router.patch(
  "/journal-entries/:id",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "journal_entries", from: "params", field: "id", assignKey: "journalEntry" }),
  updateJournalEntryByIdController,
)

router.delete(
  "/journal-entries/:id",
  requireAuth,
  requirePermission("transactions:delete"),
  validateObjectIdParam("id"),
  ensureResourceExists({ collection: "journal_entries", from: "params", field: "id", assignKey: "journalEntry" }),
  deleteJournalEntryByIdController,
)

router.post(
  "/journal-entries/batch-delete",
  requireAuth,
  requirePermission("transactions:delete"),
  validateObjectIdBodyArray("ids"),
  deleteJournalEntriesBatchController,
)

// === Inbox / categorization flow ===

// Bank-import endpoint — creates a journal entry with the bank leg
// fixed and the contra-leg pointing to the auto-created Suspense
// account. Caller categorizes later (manually or via AI).
router.post(
  "/journal-entries/half",
  requireAuth,
  requirePermission("transactions:create"),
  validateObjectIdBody("clientId"),
  validateObjectIdBody("bankAccountId"),
  ensureResourceExists({ collection: "clients", from: "body", field: "clientId", assignKey: "client" }),
  createHalfEntryController,
)

// Replace the suspense leg of an entry with a real contra-account.
router.post(
  "/journal-entries/:id/categorize",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdParam("id"),
  validateObjectIdBody("contraAccountId"),
  ensureResourceExists({ collection: "journal_entries", from: "params", field: "id", assignKey: "journalEntry" }),
  categorizeEntryController,
)

// Entries that still touch the suspense account.
router.get(
  "/clients/:clientId/journal-entries/uncategorized",
  requireAuth,
  requirePermission("transactions:read"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  listUncategorizedEntriesController,
)

// AI bulk categorization — runs categorizeTransaction over every
// uncategorized entry, auto-applies the high-confidence ones and
// returns suggestions for the rest.
router.post(
  "/clients/:clientId/journal-entries/categorize-with-ai",
  requireAuth,
  requirePermission("transactions:update"),
  validateObjectIdParam("clientId"),
  ensureResourceExists({ collection: "clients", from: "params", field: "clientId", assignKey: "client" }),
  categorizeWithAiController,
)

export default router
