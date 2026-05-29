// Spreads the demo office's clients across different operational
// statuses so the pipeline pills + Overview card + popover all show
// variety in the demo. The 3 baseline demo clients get one manual
// status each (mix of paused / completed) and we add a handful of
// extra "stub" clients that sit at the other end of the funnel.
//
// Idempotent: clients are upserted by name, status records by
// (officeId, clientId).

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"

const EXTRA_CLIENTS = [
  // Onboarding — brand new, no transactions imported yet.
  {
    name: "Northwind Trading Co.",
    businessType: "1120",
    description: "Import/export consultancy. Books just opened.",
    mainActivity: "Trading & consultancy",
    state: "Washington",
    address: "500 Pine St, Seattle, WA 98101",
    owners: [{ name: "Lin Park", email: "lin@northwindtrading.co", phone: "(206) 555-0103" }],
    daysAgo: 2,
    seedTransactions: 0,
  },
  {
    name: "Hudson Yoga Studio",
    businessType: "1040-SchC",
    description: "Boutique yoga studio with retail apparel.",
    mainActivity: "Fitness & wellness",
    state: "New York",
    address: "245 W 14th St, New York, NY 10011",
    owners: [{ name: "Emily Reyes", email: "emily@hudsonyoga.com", phone: "(212) 555-0188" }],
    daysAgo: 5,
    seedTransactions: 0,
  },
  // Waiting documents — has some transactions but not every month.
  {
    name: "Granite Peak Outfitters",
    businessType: "1065",
    description: "Outdoor gear and guide service in the Rockies.",
    mainActivity: "Retail & guiding",
    state: "Colorado",
    address: "82 Aspen Way, Boulder, CO 80302",
    owners: [{ name: "Dale Henson", email: "dale@granitepeak.co", phone: "(303) 555-0142" }],
    daysAgo: 38,
    seedTransactions: "partial", // 3 of 12 months
  },
]

// For the original 3 demo clients, force these manual statuses so the
// pipeline shows variety even though the auto-rule would pick the same
// status for all of them.
const MANUAL_OVERRIDES = [
  { match: /aurora digital/i, status: "completed", reason: "Q1 books reviewed and signed off by owner.", daysAgo: 11 },
  { match: /blue ridge/i, status: "paused", reason: "Owner on extended leave — work paused until June.", daysAgo: 25 },
]

function randomDate(daysBack) {
  const now = Date.now()
  return new Date(now - Math.random() * daysBack * 86400000)
}

async function ensureClient(db, officeId, ownerProfileId, c) {
  const existing = await db.collection("clients").findOne({ officeId, name: c.name })
  if (existing) {
    console.log(`  ~ ${c.name}: already exists`)
    return existing
  }
  const ownerSearch = c.owners
    .flatMap((o) => [o.name, o.email, o.phone])
    .filter(Boolean)
    .join(" ")
  const doc = {
    officeId,
    name: c.name,
    businessType: c.businessType,
    description: c.description,
    mainActivity: c.mainActivity,
    state: c.state,
    address: c.address,
    owners: c.owners,
    ownerEmail: "",
    ownerPhone: "",
    ownerSearch,
    createdBy: String(ownerProfileId),
    createdAt: new Date(Date.now() - (c.daysAgo || 0) * 86400000),
    updatedAt: new Date(),
  }
  const result = await db.collection("clients").insertOne(doc)
  console.log(`  + ${c.name}: created (${result.insertedId})`)
  return { ...doc, _id: result.insertedId }
}

async function ensureMinimalCoA(db, clientId) {
  const existing = await db.collection("coa_accounts").findOne({ clientId })
  if (existing) return
  const accounts = [
    { name: "Chase Business Checking", accountType: "asset_current", description: "Primary operating account." },
    { name: "Service Revenue", accountType: "income", description: "Customer payments." },
    { name: "Office Rent", accountType: "operating_expense", description: "Monthly office lease." },
  ]
  for (const acc of accounts) {
    await db.collection("coa_accounts").insertOne({
      clientId,
      name: acc.name,
      accountType: acc.accountType,
      description: acc.description,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}

async function seedPartialTransactions(db, clientId) {
  // Insert ~6 legacy transactions in 3 months only — leaves 9 months
  // uncovered → rules pick "waiting_documents".
  const year = new Date().getUTCFullYear()
  const months = ["01", "02", "03"]
  const inserts = []
  for (const month of months) {
    for (let i = 0; i < 2; i += 1) {
      const day = String(5 + i * 8).padStart(2, "0")
      inserts.push({
        clientId: String(clientId),
        accountId: "demo-acct",
        accountName: "Chase Business Checking",
        date: `${year}-${month}-${day}`,
        description: "DEMO IMPORTED ROW",
        amount: 450 + Math.random() * 1000,
        categoryId: null,
        category: null,
        isSplit: false,
        splits: [],
        llmProcessed: false,
        llmStatus: "none",
        llmProcessedAt: null,
        categorizedAt: null,
        categorizedSource: null,
        searchText: "demo imported row",
        iconType: "manual",
        source: "demo-seed",
        createdBy: "demo",
        createdAt: new Date(`${year}-${month}-${day}T12:00:00Z`),
        updatedAt: new Date(`${year}-${month}-${day}T12:00:00Z`),
      })
    }
  }
  await db.collection("transactions").insertMany(inserts)
}

async function setManualStatus(db, officeId, clientId, override, ownerProfileId) {
  const now = new Date()
  const setAt = new Date(now.getTime() - override.daysAgo * 86400000)
  await db.collection("client_operational_status").findOneAndUpdate(
    { clientId: String(clientId) },
    {
      $set: {
        officeId: String(officeId),
        clientId: String(clientId),
        manualStatus: override.status,
        manualReason: override.reason,
        manualSetAt: setAt,
        manualSetBy: String(ownerProfileId),
        // Keep any computed status untouched (it'll be there from a
        // previous read, or null). Effective status = manual when set.
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  )
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

  // 1. Add the extra clients (Onboarding / Waiting documents flavors).
  console.log("\n=== Extra clients ===")
  for (const c of EXTRA_CLIENTS) {
    const created = await ensureClient(db, officeId, ownerProfile._id, c)
    await ensureMinimalCoA(db, String(created._id))
    if (c.seedTransactions === "partial") {
      const had = await db.collection("transactions").countDocuments({ clientId: String(created._id) })
      if (had === 0) {
        await seedPartialTransactions(db, String(created._id))
        console.log(`    seeded partial-year transactions on ${c.name}`)
      }
    }
  }

  // 2. Manually override status on the original 3 clients.
  console.log("\n=== Manual status overrides ===")
  const allClients = await db.collection("clients").find({ officeId }).toArray()
  for (const override of MANUAL_OVERRIDES) {
    const target = allClients.find((c) => override.match.test(String(c.name || "")))
    if (!target) continue
    await setManualStatus(db, officeId, target._id, override, ownerProfile._id)
    console.log(`  + ${target.name} → ${override.status} (${override.daysAgo}d ago)`)
  }

  console.log("\nDone. Open Clients with the demo account to see the spread.")
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
