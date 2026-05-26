/* eslint-disable no-console */
//
// End-to-end smoke test for the bookkeeping platform. Creates a
// throwaway client with realistic transactions, then exercises every
// major workflow (CoA preset, transactions, manual JE, reconciliation,
// period close, all reports) and validates the math.
//
// Usage:
//   node scripts/e2eSmokeTest.js [--keep] [--client-name="..."]
//
// Flags:
//   --keep            Skip the final cleanup so you can poke around in the UI.
//   --client-name=X   Use a specific client name (defaults to E2E Smoke Test).

import "dotenv/config"
import { connectDB, getDB, closeDB } from "../src/db.js"
import { ObjectId } from "mongodb"
import {
  ensureJournalEntriesIndexes,
  getOrCreateSuspenseAccountId,
} from "../src/repositories/journalEntries.repository.js"
import { ensureAccountIndexes } from "../src/repositories/account.repository.js"
import { ensureCoaPresetTemplateIndexes } from "../src/repositories/coaPresetTemplate.repository.js"
import { ensureReconciliationIndexes } from "../src/repositories/reconciliation.repository.js"
import { ensurePeriodCloseIndexes } from "../src/repositories/periodClose.repository.js"
import { ensureRecurringIndexes } from "../src/repositories/recurring.repository.js"
import { applyCoaPresetService } from "../src/services/chartOfAccounts.service.js"
import { getChartOfAccountsByClientId } from "../src/repositories/chartOfAccounts.repository.js"
import { insertTransactionsInBatches } from "../src/repositories/transactions.repository.js"
import { createJournalEntry } from "../src/repositories/journalEntries.repository.js"
import {
  startReconciliationService,
  getWorksheetService,
  completeReconciliationService,
} from "../src/services/reconciliation.service.js"
import {
  closePeriodService,
  reopenPeriodService,
} from "../src/services/periodClose.service.js"
import { getProfitLossByClientIdService } from "../src/services/profitLoss.service.js"
import { getAccountBalancesReportService } from "../src/services/accountBalances.service.js"
import { getBalanceSheetReportService } from "../src/services/balanceSheet.service.js"
import { getTrialBalanceReportService } from "../src/services/trialBalance.service.js"
import { getGeneralLedgerReportService } from "../src/services/generalLedger.service.js"
import { updateTransactionById } from "../src/repositories/transactions.repository.js"
import { getOnboardingStateService } from "../src/services/onboarding.service.js"

// ───────────────────────────── pretty logging ─────────────────────────────

const PASSES = []
const FAILS = []

function pass(label, detail = "") {
  PASSES.push(label)
  console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`)
}
function fail(label, error = "") {
  FAILS.push({ label, error: String(error) })
  console.log(`  ✗ ${label}  ${error}`)
}
function step(title) {
  console.log(`\n=== ${title} ===`)
}
function info(label, value) {
  console.log(`  · ${label}: ${value}`)
}

function approxEq(a, b, eps = 0.005) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < eps
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function arg(name) {
  const flag = `--${name}=`
  const found = process.argv.find((a) => a.startsWith(flag))
  return found ? found.slice(flag.length) : null
}

// ───────────────────────────── fixtures ─────────────────────────────

const CLIENT_NAME = arg("client-name") || "E2E Smoke Test"
const KEEP = process.argv.includes("--keep")

// Six months of realistic transactions for a small consultancy.
// Amounts are signed from the bank's perspective: positive = deposit.
function generateTransactions(bankAccountId, clientId) {
  const txns = []
  const months = ["01", "02", "03", "04", "05", "06"]
  for (const m of months) {
    // Three client payments per month, $4-12k each
    for (let i = 0; i < 3; i += 1) {
      const day = String(5 + i * 10).padStart(2, "0")
      const amount = 4000 + Math.floor(Math.random() * 8000)
      txns.push({
        clientId,
        accountId: bankAccountId,
        date: `2026-${m}-${day}`,
        description: `STRIPE PAYOUT — invoice #${m}${i}`,
        amount,
        categoryId: null,
      })
    }
    // Office rent on the 1st
    txns.push({
      clientId,
      accountId: bankAccountId,
      date: `2026-${m}-01`,
      description: `WEWORK MONTHLY MEMBERSHIP`,
      amount: -2500,
      categoryId: null,
    })
    // Software subscriptions
    txns.push({
      clientId,
      accountId: bankAccountId,
      date: `2026-${m}-03`,
      description: `GOOGLE WORKSPACE`,
      amount: -84,
      categoryId: null,
    })
    txns.push({
      clientId,
      accountId: bankAccountId,
      date: `2026-${m}-08`,
      description: `NOTION LABS`,
      amount: -40,
      categoryId: null,
    })
    // Meals 1-2x per month
    txns.push({
      clientId,
      accountId: bankAccountId,
      date: `2026-${m}-12`,
      description: `STARBUCKS NEW YORK`,
      amount: -28.5,
      categoryId: null,
    })
    txns.push({
      clientId,
      accountId: bankAccountId,
      date: `2026-${m}-22`,
      description: `UBER EATS NEW YORK`,
      amount: -62.4,
      categoryId: null,
    })
    // Bank fee
    txns.push({
      clientId,
      accountId: bankAccountId,
      date: `2026-${m}-28`,
      description: `MONTHLY MAINTENANCE FEE`,
      amount: -12,
      categoryId: null,
    })
  }
  return txns
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  await connectDB()
  await ensureAccountIndexes()
  await ensureJournalEntriesIndexes()
  await ensureCoaPresetTemplateIndexes()
  await ensureReconciliationIndexes()
  await ensurePeriodCloseIndexes()
  await ensureRecurringIndexes()

  const db = getDB()
  console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

  // ──────── Setup: ensure fresh client ────────
  step("Setup")
  let client = await db.collection("clients").findOne({ name: CLIENT_NAME })
  if (client) {
    // Wipe everything for this client to start fresh.
    await Promise.all([
      db.collection("journal_entries").deleteMany({ clientId: String(client._id) }),
      db.collection("coa_accounts").deleteMany({ clientId: String(client._id) }),
      db.collection("reconciliations").deleteMany({ clientId: String(client._id) }),
      db.collection("period_closes").deleteMany({ clientId: String(client._id) }),
      db.collection("recurring_journal_entries").deleteMany({ clientId: String(client._id) }),
    ])
    await db
      .collection("clients")
      .updateOne({ _id: client._id }, { $set: { closedThroughDate: null } })
    info("Reset existing client", String(client._id))
  } else {
    // Find any officeId to attach the client to (no FK enforcement).
    const anyOffice = await db.collection("offices").findOne({})
    const officeId = anyOffice ? String(anyOffice._id) : new ObjectId().toString()
    const result = await db.collection("clients").insertOne({
      officeId,
      name: CLIENT_NAME,
      businessType: "service",
      description: "Auto-generated E2E smoke test client",
      mainActivity: "Consulting",
      state: "NY",
      owners: [],
      tagIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    client = { _id: result.insertedId, name: CLIENT_NAME }
    info("Created new client", String(client._id))
  }
  const clientId = String(client._id)

  // ──────── 1. Apply CoA preset ────────
  step("1. Chart of Accounts — apply service_business preset")
  try {
    const presetResult = await applyCoaPresetService({ clientId, presetId: "service_business" })
    pass(`Preset applied (${presetResult.insertedCount} accounts inserted)`)
  } catch (err) {
    fail("Preset apply", err.message)
  }
  const accountsAfterPreset = await db
    .collection("coa_accounts")
    .find({ clientId })
    .toArray()
  if (accountsAfterPreset.length >= 8) {
    pass(`coa_accounts count = ${accountsAfterPreset.length}`)
  } else {
    fail(`Expected ≥8 accounts, got ${accountsAfterPreset.length}`)
  }

  // Pre-create the suspense (will be created by import anyway, but proactive).
  const suspenseId = await getOrCreateSuspenseAccountId(clientId)
  info("Suspense account id", suspenseId)

  // Pick the bank account from the preset.
  const bankAccount = accountsAfterPreset.find(
    (a) => a.name === "Business Checking" && a.accountType === "asset_current",
  )
  if (!bankAccount) {
    fail("Could not find Business Checking account from preset")
    await closeDB()
    return
  }
  const bankAccountId = String(bankAccount._id)
  info("Bank account", `${bankAccount.name} (${bankAccountId})`)

  // ──────── 2. Bulk import transactions ────────
  step("2. Import — bulk CSV-like transactions")
  const transactions = generateTransactions(bankAccountId, clientId)
  info("Generated transactions", transactions.length)
  try {
    const { insertedCount } = await insertTransactionsInBatches(transactions)
    if (insertedCount === transactions.length) {
      pass(`Inserted ${insertedCount} journal entries`)
    } else {
      fail(`Expected ${transactions.length} inserts, got ${insertedCount}`)
    }
  } catch (err) {
    fail("Bulk import", err.message)
  }

  // ──────── 3. Verify journal entries + suspense legs ────────
  step("3. Verify journal entry shape")
  const entryCount = await db.collection("journal_entries").countDocuments({ clientId })
  const uncategorizedCount = await db
    .collection("journal_entries")
    .countDocuments({ clientId, "legs.accountId": suspenseId })
  if (entryCount === transactions.length) {
    pass(`journal_entries count matches imports (${entryCount})`)
  } else {
    fail(`journal_entries count mismatch (${entryCount} vs ${transactions.length})`)
  }
  if (uncategorizedCount === transactions.length) {
    pass(`All ${uncategorizedCount} entries start uncategorized (suspense leg)`)
  } else {
    fail(`Expected all ${transactions.length} uncategorized, got ${uncategorizedCount}`)
  }

  // ──────── 4. Categorize a few transactions manually ────────
  step("4. Manual categorization (5 transactions)")
  const incomeAccount = accountsAfterPreset.find((a) => a.name === "Service Revenue")
  const rentAccount = accountsAfterPreset.find((a) => a.name === "Office Expenses")
  const softwareAccount = accountsAfterPreset.find(
    (a) => a.name === "Software & Subscriptions",
  )
  const mealsAccount = accountsAfterPreset.find((a) => a.name === "Meals & Travel")
  const bankFeesAccount = accountsAfterPreset.find((a) => a.name === "Bank Fees")

  // Categorize ALL imported transactions by description keyword. We
  // need full coverage so P&L / Balance Sheet have realistic numbers.
  const sampleEntries = await db
    .collection("journal_entries")
    .find({ clientId })
    .sort({ date: 1 })
    .toArray()
  let categorized = 0
  let uncategorizedSkipped = 0
  for (const entry of sampleEntries) {
    let targetId = null
    const desc = (entry.description || "").toUpperCase()
    if (desc.includes("STRIPE")) targetId = String(incomeAccount?._id || "")
    else if (desc.includes("WEWORK")) targetId = String(rentAccount?._id || "")
    else if (desc.includes("GOOGLE") || desc.includes("NOTION"))
      targetId = String(softwareAccount?._id || "")
    else if (desc.includes("STARBUCKS") || desc.includes("UBER"))
      targetId = String(mealsAccount?._id || "")
    else if (desc.includes("MAINTENANCE FEE")) targetId = String(bankFeesAccount?._id || "")
    if (!targetId) {
      uncategorizedSkipped += 1
      continue
    }
    try {
      const updated = await updateTransactionById(String(entry._id), { categoryId: targetId })
      if (updated) categorized += 1
    } catch (err) {
      fail(`updateTransactionById on ${entry._id}`, err.message)
    }
  }
  if (categorized > 0) pass(`Categorized ${categorized} entries (${uncategorizedSkipped} unmatched)`)
  else fail(`Categorized 0 entries`)

  // ──────── 5. Manual journal entry (depreciation) ────────
  step("5. Manual journal entry (multi-leg)")
  try {
    const created = await createJournalEntry({
      clientId,
      date: "2026-03-31",
      description: "Q1 depreciation adjustment",
      legs: [
        // We don't have a Depreciation Expense in the service preset, so
        // use Office Expenses as the debit side just for this smoke run.
        {
          accountId: String(rentAccount._id),
          debit: 500,
          credit: 0,
          description: "Depreciation",
        },
        {
          accountId: bankAccountId,
          debit: 0,
          credit: 500,
          description: "Accum depreciation (proxy)",
        },
      ],
      source: "manual",
    })
    if (created?._id) pass("createJournalEntry worked")
    else fail("createJournalEntry returned no id")
  } catch (err) {
    fail("createJournalEntry", err.message)
  }

  // ──────── 6. Bank reconciliation ────────
  step("6. Reconciliation")
  // Compute the bank balance as of 2026-03-31 (all Q1 entries' bank legs).
  const q1Entries = await db
    .collection("journal_entries")
    .find({ clientId, date: { $regex: /^2026-0[1-3]/ } })
    .toArray()
  let bankNet = 0
  for (const entry of q1Entries) {
    for (const leg of entry.legs || []) {
      if (String(leg.accountId) !== bankAccountId) continue
      bankNet += Number(leg.debit || 0) - Number(leg.credit || 0)
    }
  }
  bankNet = round2(bankNet)
  info("Expected Q1 bank balance", `$${bankNet}`)

  let reconciliation
  try {
    reconciliation = await startReconciliationService({
      clientId,
      accountId: bankAccountId,
      statementDate: "2026-03-31",
      statementEndingBalance: bankNet,
      openingBalance: 0,
    })
    pass("startReconciliation")
  } catch (err) {
    fail("startReconciliation", err.message)
  }

  if (reconciliation) {
    let worksheet
    try {
      worksheet = await getWorksheetService({ reconciliationId: String(reconciliation._id) })
      pass(`Worksheet loaded — ${worksheet.items.length} legs`)
    } catch (err) {
      fail("getWorksheet", err.message)
    }
    // Mark every leg as cleared since our "statement" includes them all.
    const legRefs = (worksheet?.items || []).map((it) => ({
      entryId: it.entryId,
      legIndex: it.legIndex,
    }))
    try {
      const completed = await completeReconciliationService({
        reconciliationId: String(reconciliation._id),
        legRefs,
        completedBy: "e2e-test",
      })
      if (completed?.status === "completed") pass("Reconciliation completed (difference = 0)")
      else fail("Reconciliation not completed", JSON.stringify(completed))
    } catch (err) {
      fail("completeReconciliation", err.message)
    }
  }

  // ──────── 7. Period close ────────
  step("7. Period close")
  try {
    await closePeriodService({
      clientId,
      throughDate: "2026-03-31",
      note: "Q1 close — automated test",
      createdBy: "e2e-test",
    })
    pass("Period closed through 2026-03-31")
  } catch (err) {
    fail("closePeriod", err.message)
  }

  // Try to edit a Q1 entry — should fail.
  const q1Entry = await db
    .collection("journal_entries")
    .findOne({ clientId, date: { $regex: /^2026-02/ } })
  if (q1Entry) {
    try {
      await updateTransactionById(String(q1Entry._id), { description: "should not work" })
      fail("Edit inside closed period was allowed (should be blocked)")
    } catch (err) {
      if (err.code === "PERIOD_CLOSED") {
        pass("PERIOD_CLOSED correctly blocks edits inside the closed range")
      } else {
        fail(`Edit blocked but unexpected error code (${err.code})`, err.message)
      }
    }
  }

  // Try to insert a new transaction dated inside Q1 — should also fail.
  try {
    await insertTransactionsInBatches([
      {
        clientId,
        accountId: bankAccountId,
        date: "2026-02-15",
        description: "should be rejected",
        amount: -100,
      },
    ])
    fail("Bulk import inside closed period was allowed (should be blocked)")
  } catch (err) {
    if (err.code === "PERIOD_CLOSED") pass("PERIOD_CLOSED blocks new imports in closed range")
    else fail(`Import blocked but unexpected error code (${err.code})`, err.message)
  }

  // Reopen so the report validation below sees the full state.
  try {
    await reopenPeriodService({ clientId, createdBy: "e2e-test" })
    pass("Period reopened")
  } catch (err) {
    fail("reopenPeriod", err.message)
  }

  // ──────── 8. Reports — math validation ────────
  step("8. Reports — validate the math")

  // 8.1 Trial Balance: sum(debits) === sum(credits)
  try {
    const tb = await getTrialBalanceReportService({ clientId, asOfDate: "2026-06-30" })
    if (approxEq(tb.totals.debits, tb.totals.credits)) {
      pass(`Trial Balance balances ($${tb.totals.debits} = $${tb.totals.credits})`)
    } else {
      fail(
        `Trial Balance unbalanced: debits=${tb.totals.debits} credits=${tb.totals.credits}`,
      )
    }
  } catch (err) {
    fail("trialBalance", err.message)
  }

  // 8.2 Balance Sheet: Assets = Liabilities + Equity (within $0.01)
  try {
    const bs = await getBalanceSheetReportService({ clientId, asOfDate: "2026-06-30" })
    const totals = bs?.totals || {}
    const diff = round2(totals.assets - totals.liabilitiesPlusEquity)
    if (approxEq(diff, 0)) {
      pass(`Balance Sheet ties (Assets ${totals.assets} = L+E ${totals.liabilitiesPlusEquity})`)
    } else {
      fail(`Balance Sheet difference is ${diff}`)
    }
  } catch (err) {
    fail("balanceSheet", err.message)
  }

  // 8.3 Profit & Loss — KPIs populated
  try {
    const pl = await getProfitLossByClientIdService({
      clientId,
      period: "RANGE",
      fromDate: "2026-01-01",
      toDate: "2026-06-30",
    })
    const findKpi = (id) =>
      (pl?.kpis || []).find((k) => k.id === id)?.value ?? 0
    const revenue = findKpi("revenue")
    const grossProfit = findKpi("gross_profit")
    const netIncome = findKpi("net_income")
    info("Revenue", `$${revenue}`)
    info("Gross profit", `$${grossProfit}`)
    info("Net income", `$${netIncome}`)
    if (Math.abs(revenue) > 0) {
      pass(`P&L revenue is non-zero ($${revenue})`)
    } else {
      fail("P&L revenue is zero — categorization didn't hit income accounts")
    }
  } catch (err) {
    fail("profitLoss", err.message)
  }

  // 8.4 Account Balances — non-zero row count
  try {
    const ab = await getAccountBalancesReportService({ clientId, asOfDate: "2026-06-30" })
    if (Array.isArray(ab?.rows) && ab.rows.length > 0) {
      pass(`Account Balances returned ${ab.rows.length} rows`)
    } else {
      fail("Account Balances returned 0 rows")
    }
  } catch (err) {
    fail("accountBalances", err.message)
  }

  // 8.5 General Ledger — opening + sum debit/credit = closing for a sample account
  try {
    const gl = await getGeneralLedgerReportService({
      clientId,
      accountId: bankAccountId,
      fromDate: "2026-01-01",
      toDate: "2026-06-30",
    })
    const computedClosing = round2(
      gl.openingBalance + (gl.totals.debit - gl.totals.credit),
    )
    // For asset_current the natural side is debit, so the running balance
    // for the bank account is +debit −credit. That's what the GL reports.
    if (approxEq(computedClosing, gl.closingBalance)) {
      pass(`General Ledger ties for bank account (closing $${gl.closingBalance})`)
    } else {
      fail(
        `General Ledger mismatch: computed ${computedClosing} vs reported ${gl.closingBalance}`,
      )
    }
  } catch (err) {
    fail("generalLedger", err.message)
  }

  // ──────── 9. Onboarding state ────────
  step("9. Onboarding panel state")
  try {
    const onb = await getOnboardingStateService({ clientId })
    info("Steps complete", `${onb.doneCount}/${onb.totalCount}`)
    if (onb.steps.find((s) => s.id === "chart_of_accounts")?.done) {
      pass("Onboarding step: chart of accounts marked done")
    } else {
      fail("Onboarding step: chart of accounts should be done")
    }
    if (onb.steps.find((s) => s.id === "first_transactions")?.done) {
      pass("Onboarding step: first transactions marked done")
    } else {
      fail("Onboarding step: first transactions should be done")
    }
  } catch (err) {
    fail("onboarding", err.message)
  }

  // ──────── cleanup ────────
  if (!KEEP) {
    step("Cleanup")
    await Promise.all([
      db.collection("journal_entries").deleteMany({ clientId }),
      db.collection("coa_accounts").deleteMany({ clientId }),
      db.collection("reconciliations").deleteMany({ clientId }),
      db.collection("period_closes").deleteMany({ clientId }),
      db.collection("recurring_journal_entries").deleteMany({ clientId }),
    ])
    await db
      .collection("clients")
      .updateOne({ _id: new ObjectId(clientId) }, { $set: { closedThroughDate: null } })
    info("Cleaned up all data for the test client", clientId)
  } else {
    console.log(`\n--keep flag is set — leaving client ${clientId} (${CLIENT_NAME}) intact.`)
  }

  // ──────── summary ────────
  console.log(`\n──────────── SUMMARY ────────────`)
  console.log(`Passed: ${PASSES.length}`)
  console.log(`Failed: ${FAILS.length}`)
  if (FAILS.length > 0) {
    console.log(`\nFailures:`)
    FAILS.forEach((f, i) => console.log(`  ${i + 1}. ${f.label}\n     ${f.error}`))
  } else {
    console.log(`\nAll green. 🎉`)
  }

  await closeDB()
  process.exit(FAILS.length === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error("\n!!! Unhandled error:", err)
  try {
    await closeDB()
  } catch {
    /* ignore */
  }
  process.exit(2)
})
