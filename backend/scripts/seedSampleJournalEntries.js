/* eslint-disable no-console */
// Seeds a few realistic balanced journal entries against the test
// client so the user can exercise the Transactions UI and Reports
// (P&L, Balance Sheet, Account Balances, Trial Balance) without
// having to type each one by hand.
//
// Idempotent: matches existing entries by (date + description) before
// inserting so re-running is a no-op.

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const ENTRIES = [
  { date: "2026-05-01", description: "STRIPE PAYOUT - APRIL", bankSide: "debit", amount: 4250, contraName: "Service Revenue" },
  { date: "2026-05-02", description: "GOOGLE ADS PAYMENT", bankSide: "credit", amount: 480, contraName: "Advertising & Marketing" },
  { date: "2026-05-03", description: "WEWORK OFFICE RENT MAY", bankSide: "credit", amount: 890, contraName: "Office Rent" },
  { date: "2026-05-04", description: "AMAZON WEB SERVICES", bankSide: "credit", amount: 210, contraName: "Software & Subscriptions" },
  { date: "2026-05-05", description: "FIGMA PROFESSIONAL", bankSide: "credit", amount: 45, contraName: "Software & Subscriptions" },
  { date: "2026-05-06", description: "ADP PAYROLL RUN", bankSide: "credit", amount: 8500, contraName: "Payroll & Wages" },
  { date: "2026-05-07", description: "ANTHEM HEALTH INSURANCE", bankSide: "credit", amount: 1200, contraName: "Employee Benefits" },
  { date: "2026-05-08", description: "SHOPIFY PAYOUT APRIL", bankSide: "debit", amount: 980, contraName: "Product Sales" },
  { date: "2026-05-09", description: "HOME DEPOT SUPPLIES", bankSide: "credit", amount: 240, contraName: "Materials & Supplies" },
  { date: "2026-05-10", description: "IRS EFTPS PAYMENT Q1", bankSide: "credit", amount: 2500, contraName: "Federal Income Tax" },
  { date: "2026-05-11", description: "INTEREST EARNED", bankSide: "debit", amount: 12.45, contraName: "Interest Income" },
  { date: "2026-05-12", description: "BANK FEE", bankSide: "credit", amount: 12, contraName: "Bank Fees" },
  { date: "2026-05-13", description: "DELTA AIRLINES TICKET", bankSide: "credit", amount: 560, contraName: "Travel" },
  { date: "2026-05-14", description: "UBER EATS - TEAM LUNCH", bankSide: "credit", amount: 95, contraName: "Meals & Entertainment" },
]

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)

  // Accepts --clientId=<id> to target a specific client; otherwise
  // uses the same client seedRichCoA picks (first one with P&L accounts).
  const clientIdArg = process.argv.find((arg) => arg.startsWith("--clientId="))
  let clientId = clientIdArg ? clientIdArg.split("=")[1] : null
  if (!clientId) {
    const sampleAccount = await db
      .collection("coa_accounts")
      .findOne({ accountType: { $in: ["income", "operating_expense"] } })
    if (!sampleAccount) {
      console.error("No P&L accounts found. Run seedRichCoA.js first.")
      process.exit(1)
    }
    clientId = sampleAccount.clientId
  }
  console.log(`Seeding journal entries for clientId=${clientId}\n`)

  // Cash side: pick the first asset_current account (Chase Business Checking, PayPal, etc.)
  const bankAccount = await db
    .collection("coa_accounts")
    .findOne({ clientId, accountType: "asset_current" })
  if (!bankAccount) {
    console.error("No asset_current account on this client — can't seed.")
    process.exit(1)
  }
  console.log(`Using bank account: "${bankAccount.name}" (${bankAccount._id})\n`)

  const allAccounts = await db.collection("coa_accounts").find({ clientId }).toArray()
  const accountByName = new Map(allAccounts.map((a) => [a.name, a]))

  let inserted = 0
  let skipped = 0
  let missing = 0

  for (const entry of ENTRIES) {
    const contra = accountByName.get(entry.contraName)
    if (!contra) {
      console.warn(`  ! No account named "${entry.contraName}" — skipping`)
      missing += 1
      continue
    }

    const existing = await db.collection("journal_entries").findOne({
      clientId,
      date: entry.date,
      description: entry.description,
    })
    if (existing) {
      skipped += 1
      continue
    }

    const bankLeg = {
      accountId: String(bankAccount._id),
      debit: entry.bankSide === "debit" ? entry.amount : 0,
      credit: entry.bankSide === "credit" ? entry.amount : 0,
      side: entry.bankSide,
      description: "",
    }
    const contraLeg = {
      accountId: String(contra._id),
      debit: entry.bankSide === "debit" ? 0 : entry.amount,
      credit: entry.bankSide === "debit" ? entry.amount : 0,
      side: entry.bankSide === "debit" ? "credit" : "debit",
      description: "",
    }

    await db.collection("journal_entries").insertOne({
      _id: new ObjectId(),
      clientId,
      date: entry.date,
      description: entry.description,
      legs: [bankLeg, contraLeg],
      totalDebits: entry.amount,
      totalCredits: entry.amount,
      source: "seed",
      externalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    inserted += 1
    console.log(`  + ${entry.date} ${entry.description} ($${entry.amount} ${entry.bankSide === "debit" ? "in" : "out"})`)
  }

  console.log(`\nDone. inserted=${inserted}, skipped=${skipped}, missing=${missing}`)
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
