// Populates the Demo Account office with rich showcase data:
//   - turns on all CRM features
//   - creates 3 demo clients with full info (address, owners, business type)
//   - seeds each client with a rich Chart of Accounts
//   - seeds journal entries spanning the last few months
//   - creates a couple of demo tasks (CRM)
//
// Chat data is seeded by re-using the existing seedChatDemo.js script:
//   MONGODB_DB_NAME=categorizationai_prod \
//     node scripts/seedChatDemo.js --email=demo@categorizationai.com
//
// Idempotent: skips offices/clients/accounts/entries already present.

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"

const CLIENTS = [
  {
    name: "Blue Ridge Construction LLC",
    businessType: "1065",
    description: "Residential and light commercial construction. Subcontracts framing and electrical work.",
    mainActivity: "Construction",
    state: "Florida",
    address: "1820 NE 5th Ave, Boca Raton, FL 33431",
    owners: [
      { name: "Marcus Hill", email: "marcus@blueridgefl.com", phone: "(561) 555-0142" },
      { name: "Carla Hill", email: "carla@blueridgefl.com", phone: "(561) 555-0143" },
    ],
  },
  {
    name: "Aurora Digital Studio",
    businessType: "1120-S",
    description: "Boutique design + branding studio. Web, identity, and motion work for SaaS startups.",
    mainActivity: "Creative services",
    state: "New York",
    address: "210 W 22nd St, Suite 4B, New York, NY 10011",
    owners: [
      { name: "Priya Shah", email: "priya@auroradigital.co", phone: "(212) 555-0177" },
    ],
  },
  {
    name: "Sunset Cafe & Roasters",
    businessType: "1040-SchC",
    description: "Single-location specialty coffee shop with house-roasted beans and a light breakfast menu.",
    mainActivity: "Food & beverage",
    state: "California",
    address: "4015 Sunset Blvd, Los Angeles, CA 90029",
    owners: [
      { name: "Jordan Park", email: "jordan@sunsetcafe.la", phone: "(323) 555-0118" },
    ],
  },
]

const COA = [
  // Assets
  { name: "Chase Business Checking", accountType: "asset_current", description: "Primary operating account." },
  { name: "Cash on Hand", accountType: "asset_current", description: "Petty cash." },
  // Liabilities
  { name: "Amex Business Card", accountType: "liability_current", description: "Business credit card." },
  // Equity
  { name: "Owner's Capital", accountType: "equity", description: "Owner contributions." },
  // Income
  { name: "Service Revenue", accountType: "income", description: "Customer payments for services." },
  { name: "Product Sales", accountType: "income", description: "Revenue from products sold." },
  // COGS
  { name: "Materials & Supplies", accountType: "cost_of_goods_sold", description: "Direct materials." },
  { name: "Contractor Payments", accountType: "cost_of_goods_sold", description: "1099 contractors." },
  // OpEx
  { name: "Software & Subscriptions", accountType: "operating_expense", description: "SaaS tools." },
  { name: "Advertising & Marketing", accountType: "operating_expense", description: "Paid ads." },
  { name: "Office Rent", accountType: "operating_expense", description: "Monthly office lease." },
  { name: "Utilities", accountType: "operating_expense", description: "Electricity, internet, phone." },
  { name: "Meals & Entertainment", accountType: "operating_expense", description: "Business meals." },
  { name: "Travel", accountType: "operating_expense", description: "Business travel." },
  { name: "Payroll & Wages", accountType: "operating_expense", description: "Employee salaries." },
  { name: "Employee Benefits", accountType: "operating_expense", description: "Health insurance, 401k." },
  { name: "Professional Services", accountType: "operating_expense", description: "Legal, accounting, consulting." },
  // Other
  { name: "Interest Income", accountType: "other_income", description: "Interest earned." },
  { name: "Bank Fees", accountType: "other_expense", description: "Bank service charges." },
  { name: "Federal Income Tax", accountType: "tax_expense", description: "IRS payments." },
]

function buildEntriesFor(monthOffset) {
  // Returns 8 entries dated in the given month (offset relative to today).
  const today = new Date()
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth() + monthOffset
  const date = (day) => {
    const d = new Date(Date.UTC(y, m, day))
    return d.toISOString().slice(0, 10)
  }
  return [
    { date: date(2), description: "STRIPE PAYOUT", bankSide: "debit", amount: 4250, contraName: "Service Revenue" },
    { date: date(4), description: "GOOGLE ADS", bankSide: "credit", amount: 480, contraName: "Advertising & Marketing" },
    { date: date(5), description: "WEWORK RENT", bankSide: "credit", amount: 890, contraName: "Office Rent" },
    { date: date(7), description: "AWS HOSTING", bankSide: "credit", amount: 210, contraName: "Software & Subscriptions" },
    { date: date(10), description: "ADP PAYROLL", bankSide: "credit", amount: 8500, contraName: "Payroll & Wages" },
    { date: date(12), description: "SHOPIFY PAYOUT", bankSide: "debit", amount: 980, contraName: "Product Sales" },
    { date: date(15), description: "HOME DEPOT SUPPLIES", bankSide: "credit", amount: 240, contraName: "Materials & Supplies" },
    { date: date(20), description: "BANK FEE", bankSide: "credit", amount: 12, contraName: "Bank Fees" },
  ]
}

const TASKS = [
  { title: "Review April reconciliation", priority: "high", dueOffsetDays: 2, status: "in_progress" },
  { title: "Send Q1 financials to client", priority: "medium", dueOffsetDays: 5, status: "open" },
  { title: "Confirm 1099 vendor list", priority: "low", dueOffsetDays: 14, status: "open" },
  { title: "Reconcile Amex statement", priority: "medium", dueOffsetDays: -3, status: "done" },
]

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

  // 1) Find demo office (via the demo user_profile email).
  const profile = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
  if (!profile?.officeId) {
    console.error(`No user_profile for ${DEMO_EMAIL}. Run createDemoAccount.js first.`)
    process.exit(1)
  }
  const officeId = String(profile.officeId)
  console.log(`Demo office: ${officeId}`)

  // 2) Turn on all CRM features.
  console.log("Enabling CRM features...")
  await db.collection("offices").updateOne(
    { _id: new ObjectId(officeId) },
    {
      $set: {
        "features.crm": true,
        "features.crmTasks": true,
        "features.crmChat": true,
        "features.crmOperationalStatus": true,
        "features.bookkeepingLlm": true,
        updatedAt: new Date(),
      },
    },
  )

  // 3) Create clients.
  const clientIds = []
  for (const c of CLIENTS) {
    const existing = await db.collection("clients").findOne({ officeId, name: c.name })
    if (existing) {
      console.log(`  ~ client "${c.name}" already exists (${existing._id})`)
      clientIds.push(String(existing._id))
      continue
    }
    const ownerSearch = c.owners
      .flatMap((o) => [o.name, o.email, o.phone])
      .map((v) => String(v || "").trim())
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
      createdBy: String(profile._id),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const result = await db.collection("clients").insertOne(doc)
    console.log(`  + client "${c.name}" (${result.insertedId})`)
    clientIds.push(String(result.insertedId))
  }

  // 4) Seed CoA per client.
  for (const clientId of clientIds) {
    let inserted = 0
    for (const acc of COA) {
      const existing = await db.collection("coa_accounts").findOne({ clientId, name: acc.name })
      if (existing) continue
      await db.collection("coa_accounts").insertOne({
        clientId,
        name: acc.name,
        accountType: acc.accountType,
        description: acc.description,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      inserted += 1
    }
    console.log(`  + CoA on ${clientId}: ${inserted} accounts inserted`)
  }

  // 5) Seed journal entries — 3 months of activity per client.
  for (const clientId of clientIds) {
    const accounts = await db.collection("coa_accounts").find({ clientId }).toArray()
    const accountByName = new Map(accounts.map((a) => [a.name, a]))
    const bank = accounts.find((a) => a.name === "Chase Business Checking")
    if (!bank) {
      console.warn(`  ! no bank account for ${clientId} — skip entries`)
      continue
    }
    let inserted = 0
    for (const offset of [-2, -1, 0]) {
      for (const e of buildEntriesFor(offset)) {
        const contra = accountByName.get(e.contraName)
        if (!contra) continue
        const exists = await db.collection("journal_entries").findOne({
          clientId,
          date: e.date,
          description: e.description,
        })
        if (exists) continue
        const bankLeg = {
          accountId: String(bank._id),
          debit: e.bankSide === "debit" ? e.amount : 0,
          credit: e.bankSide === "credit" ? e.amount : 0,
          side: e.bankSide,
          description: "",
        }
        const contraLeg = {
          accountId: String(contra._id),
          debit: e.bankSide === "debit" ? 0 : e.amount,
          credit: e.bankSide === "debit" ? e.amount : 0,
          side: e.bankSide === "debit" ? "credit" : "debit",
          description: "",
        }
        await db.collection("journal_entries").insertOne({
          _id: new ObjectId(),
          clientId,
          date: e.date,
          description: e.description,
          legs: [bankLeg, contraLeg],
          totalDebits: e.amount,
          totalCredits: e.amount,
          source: "seed",
          externalId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        inserted += 1
      }
    }
    console.log(`  + journal entries on ${clientId}: ${inserted} inserted`)
  }

  // 6) Seed a few CRM tasks.
  const today = new Date()
  for (const clientId of clientIds) {
    for (const t of TASKS) {
      const exists = await db.collection("tasks").findOne({ officeId, clientId, title: t.title })
      if (exists) continue
      const dueDate = new Date(today)
      dueDate.setUTCDate(dueDate.getUTCDate() + t.dueOffsetDays)
      await db.collection("tasks").insertOne({
        officeId,
        clientIds: [clientId],
        assigneeIds: [String(profile._id)],
        clientId,
        assigneeId: String(profile._id),
        dueDate: dueDate.toISOString().slice(0, 10),
        title: t.title,
        description: "",
        status: t.status,
        priority: t.priority,
        doneAt: t.status === "done" ? new Date() : null,
        statusHistory: [{ status: t.status, at: new Date(), by: String(profile._id) }],
        comments: [],
        collectionId: null,
        createdBy: String(profile._id),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  }
  console.log(`  + tasks seeded on ${clientIds.length} clients`)

  console.log("\nDone. Next: run seedChatDemo.js with --email=demo@categorizationai.com to seed chat.")
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
