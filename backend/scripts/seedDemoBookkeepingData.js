// Populates the Bookkeeping Overview dashboard for the Demo Account
// office. The Overview page reads from the LEGACY `transactions`
// collection (not journal_entries) plus `categorization_jobs`, so we
// seed those directly with realistic spread:
//
//   - ~120 transactions per client spread across the last 60 days
//   - mix of categorized vs uncategorized
//   - mix of llmStatus (suggested / none) with llmProcessedAt set
//   - varied createdAt + categorizedAt to populate trend buckets
//   - 6 categorization_jobs (queued / running / done / failed)
//
// Idempotent on a per-client basis: aborts if the client already has
// >= 50 legacy transactions seeded, so re-running won't pile up rows.

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"
const TRANSACTIONS_PER_CLIENT = 120

const VENDORS = [
  { description: "STRIPE PAYOUT", amount: () => +(Math.random() * 4500 + 1500).toFixed(2), sign: +1, contraName: "Service Revenue" },
  { description: "SHOPIFY PAYOUT", amount: () => +(Math.random() * 800 + 200).toFixed(2), sign: +1, contraName: "Product Sales" },
  { description: "GOOGLE ADS", amount: () => +(Math.random() * 400 + 60).toFixed(2), sign: -1, contraName: "Advertising & Marketing" },
  { description: "FACEBOOK ADS", amount: () => +(Math.random() * 350 + 80).toFixed(2), sign: -1, contraName: "Advertising & Marketing" },
  { description: "WEWORK RENT", amount: () => 890, sign: -1, contraName: "Office Rent" },
  { description: "AWS HOSTING", amount: () => +(Math.random() * 220 + 80).toFixed(2), sign: -1, contraName: "Software & Subscriptions" },
  { description: "FIGMA PROFESSIONAL", amount: () => 45, sign: -1, contraName: "Software & Subscriptions" },
  { description: "NOTION TEAM", amount: () => 32, sign: -1, contraName: "Software & Subscriptions" },
  { description: "ADP PAYROLL RUN", amount: () => +(Math.random() * 3000 + 6000).toFixed(2), sign: -1, contraName: "Payroll & Wages" },
  { description: "ANTHEM HEALTH INSURANCE", amount: () => 1200, sign: -1, contraName: "Employee Benefits" },
  { description: "HOME DEPOT SUPPLIES", amount: () => +(Math.random() * 250 + 30).toFixed(2), sign: -1, contraName: "Materials & Supplies" },
  { description: "AMAZON BUSINESS", amount: () => +(Math.random() * 180 + 20).toFixed(2), sign: -1, contraName: "Office Supplies" },
  { description: "UBER EATS - TEAM LUNCH", amount: () => +(Math.random() * 90 + 25).toFixed(2), sign: -1, contraName: "Meals & Entertainment" },
  { description: "STARBUCKS", amount: () => +(Math.random() * 15 + 5).toFixed(2), sign: -1, contraName: "Meals & Entertainment" },
  { description: "DELTA AIRLINES TICKET", amount: () => +(Math.random() * 500 + 200).toFixed(2), sign: -1, contraName: "Travel" },
  { description: "UBER RIDE", amount: () => +(Math.random() * 40 + 10).toFixed(2), sign: -1, contraName: "Travel" },
  { description: "MARRIOTT HOTEL", amount: () => +(Math.random() * 400 + 150).toFixed(2), sign: -1, contraName: "Travel" },
  { description: "BANK FEE", amount: () => 12, sign: -1, contraName: "Bank Fees" },
  { description: "INTEREST EARNED", amount: () => +(Math.random() * 30 + 1).toFixed(2), sign: +1, contraName: "Interest Income" },
  { description: "ZELLE FROM CLIENT", amount: () => +(Math.random() * 2500 + 500).toFixed(2), sign: +1, contraName: "Service Revenue" },
]

const UNCATEG_DESCRIPTIONS = [
  "PURCHASE CHECKCARD UNKNOWN",
  "POS DEBIT TST*",
  "CHECKCARD MERCHANT_REF",
  "MOBILE DEPOSIT",
  "ATM WITHDRAWAL",
]

function randomDate(daysBack) {
  const now = Date.now()
  return new Date(now - Math.random() * daysBack * 86400000)
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function ensureLatestCount(db, clientId, threshold) {
  const count = await db.collection("transactions").countDocuments({
    clientId,
    source: "demo-seed",
  })
  return count >= threshold
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

  const ownerProfile = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
  if (!ownerProfile?.officeId) {
    console.error(`No user_profile for ${DEMO_EMAIL}. Run createDemoAccount.js first.`)
    process.exit(1)
  }
  const officeId = String(ownerProfile.officeId)
  console.log(`Demo office: ${officeId}`)

  const clients = await db.collection("clients").find({ officeId }).toArray()
  if (clients.length === 0) {
    console.error("No clients in office.")
    process.exit(1)
  }
  console.log(`Clients: ${clients.length}`)

  // Use the demo owner + coworker profiles as createdBy candidates.
  const profiles = await db.collection("user_profile").find({ officeId }).toArray()
  const createdByCandidates = profiles.map((p) => String(p._id))

  for (const c of clients) {
    const clientId = String(c._id)

    if (await ensureLatestCount(db, clientId, 50)) {
      console.log(`  ~ ${c.name}: already has demo-seed transactions, skipping`)
      continue
    }

    const accounts = await db.collection("coa_accounts").find({ clientId }).toArray()
    const bank = accounts.find((a) => a.name === "Chase Business Checking")
    const accountByName = new Map(accounts.map((a) => [a.name, a]))
    if (!bank) {
      console.warn(`  ! ${c.name}: no bank account, skip`)
      continue
    }

    const docs = []
    for (let i = 0; i < TRANSACTIONS_PER_CLIENT; i += 1) {
      const isUncategorized = Math.random() < 0.18
      const vendor = isUncategorized
        ? { description: pick(UNCATEG_DESCRIPTIONS), amount: () => +(Math.random() * 200 + 10).toFixed(2), sign: Math.random() < 0.5 ? +1 : -1, contraName: null }
        : pick(VENDORS)

      const contra = vendor.contraName ? accountByName.get(vendor.contraName) : null
      const createdAt = randomDate(60)
      // categorizedAt happens between createdAt and now for ~80% of categorized rows
      const isCategorized = !isUncategorized && Math.random() < 0.85
      const wasCategorizedByAI = isCategorized && Math.random() < 0.55
      const categorizedAt = isCategorized
        ? new Date(createdAt.getTime() + Math.random() * Math.max(1, Date.now() - createdAt.getTime()))
        : null
      const llmStatus = isUncategorized
        ? "none"
        : wasCategorizedByAI
          ? "suggested"
          : (Math.random() < 0.3 ? "suggested" : "none")
      const llmProcessedAt = llmStatus === "suggested"
        ? (categorizedAt || new Date(createdAt.getTime() + Math.random() * 3600000))
        : null

      const amountAbs = vendor.amount()
      const amount = vendor.sign * amountAbs

      docs.push({
        clientId,
        accountId: String(bank._id),
        accountName: bank.name,
        date: createdAt.toISOString().slice(0, 10),
        description: vendor.description,
        amount,
        categoryId: contra && isCategorized ? String(contra._id) : null,
        category: contra && isCategorized ? contra.name : null,
        isSplit: false,
        splits: [],
        llmProcessed: llmStatus === "suggested",
        llmStatus,
        llmProcessedAt,
        llmConfidence: llmStatus === "suggested" ? +(0.6 + Math.random() * 0.39).toFixed(2) : null,
        llmAmbiguous: false,
        llmCategorySuggestionId: contra && llmStatus === "suggested" ? String(contra._id) : null,
        llmCategorySuggestionName: contra && llmStatus === "suggested" ? contra.name : null,
        categorizedAt,
        categorizedSource: wasCategorizedByAI ? "llm" : (isCategorized ? "manual" : null),
        searchText: `${vendor.description.toLowerCase()} ${bank.name.toLowerCase()}`,
        iconType: "manual",
        source: "demo-seed",
        createdBy: pick(createdByCandidates),
        createdAt,
        updatedAt: categorizedAt || createdAt,
      })
    }

    await db.collection("transactions").insertMany(docs)
    console.log(`  + ${c.name}: inserted ${docs.length} legacy transactions`)
  }

  // Categorization jobs — visible in "Live Jobs Queue" and "Recent activity".
  const jobsExisting = await db.collection("categorization_jobs").countDocuments({
    clientId: { $in: clients.map((c) => String(c._id)) },
    source: "demo-seed",
  })
  if (jobsExisting > 0) {
    console.log(`  ~ categorization_jobs: ${jobsExisting} already exist, skipping`)
  } else {
    const now = new Date()
    const jobs = [
      { status: "running", processed: 32, total: 100, hoursAgo: 0.2, error: null },
      { status: "queued", processed: 0, total: 250, hoursAgo: 0.05, error: null },
      { status: "done", processed: 180, total: 180, hoursAgo: 8, error: null },
      { status: "done", processed: 95, total: 95, hoursAgo: 22, error: null },
      { status: "failed", processed: 12, total: 80, hoursAgo: 30, error: "Rate limit on LLM provider" },
      { status: "done", processed: 60, total: 60, hoursAgo: 60, error: null },
    ]
    const jobsToInsert = jobs.map((j, idx) => {
      const c = clients[idx % clients.length]
      const updatedAt = new Date(now.getTime() - j.hoursAgo * 3600000)
      const createdAt = new Date(updatedAt.getTime() - j.total * 1500)
      return {
        type: "categorize_all_llm",
        status: j.status,
        stage: j.status === "running" ? "categorizing" : j.status,
        clientId: String(c._id),
        mode: "all",
        transactionIds: [],
        requestedCount: j.total,
        createdBy: pick(createdByCandidates),
        total: j.total,
        processed: j.processed,
        progressPct: Math.round((j.processed / Math.max(1, j.total)) * 100),
        errorMessage: j.error,
        result: j.status === "done" ? { autoApplied: Math.floor(j.processed * 0.7), needsReview: Math.floor(j.processed * 0.3) } : null,
        source: "demo-seed",
        createdAt,
        updatedAt,
        startedAt: j.status === "queued" ? null : new Date(createdAt.getTime() + 5000),
        completedAt: j.status === "done" || j.status === "failed" ? updatedAt : null,
      }
    })
    await db.collection("categorization_jobs").insertMany(jobsToInsert)
    console.log(`  + categorization_jobs: ${jobsToInsert.length} inserted`)
  }

  console.log("\nDone.")
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
