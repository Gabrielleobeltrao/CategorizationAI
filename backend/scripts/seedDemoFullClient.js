// Creates a brand-new demo client ("Cedar & Sage Apothecary") with
// enough realistic data to exercise every block on the per-client
// Dashboard:
//
//   - Client header info (business type, main activity, state, address)
//   - KPI cards (cash balance + MTD revenue / net income / gross profit)
//   - Action items (uncategorized count, uncleared accounts)
//   - Tasks section (manual + will be joined by auto-generated ones)
//   - Notes card
//   - Recent transactions (last ~8 entries with cleared flags)
//   - Account balances (multiple asset_current accounts)
//   - Operational status (will compute on next read)
//
// Idempotent: if the client already exists by name, the script exits
// without rewriting anything.

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"
const CLIENT_NAME = "Cedar & Sage Apothecary"

// Chart of accounts tailored for a retail wellness business.
const COA = [
    // === Assets (current) ===
    { name: "Chase Business Checking", accountType: "asset_current", description: "Primary operating account." },
    { name: "Square Payments Reserve", accountType: "asset_current", description: "Funds held by Square pending payout." },
    { name: "Cash Drawer", accountType: "asset_current", description: "Daily till float." },
    { name: "Accounts Receivable", accountType: "asset_current", description: "Wholesale invoices outstanding." },

    // === Assets (non-current) ===
    { name: "Shop Fixtures & Equipment", accountType: "asset_noncurrent", description: "Display shelving, counters, POS hardware." },

    // === Liabilities ===
    { name: "Amex Business Card", accountType: "liability_current", description: "Owner expense card; reconciled monthly." },
    { name: "Sales Tax Payable", accountType: "liability_current", description: "State + Multnomah sales tax collected." },

    // === Equity ===
    { name: "Owner's Capital", accountType: "equity", description: "Initial owner contribution and reinvestments." },
    { name: "Owner Distributions", accountType: "equity", description: "Owner draws / distributions." },

    // === Income ===
    { name: "Retail Sales — In Store", accountType: "income", description: "Walk-in retail revenue (Square POS)." },
    { name: "Retail Sales — Online", accountType: "income", description: "Shopify and Etsy revenue." },
    { name: "Wholesale Revenue", accountType: "income", description: "Boutique and spa wholesale orders." },

    // === COGS ===
    { name: "Inventory Purchases", accountType: "cost_of_goods_sold", description: "Herbs, oils, jars, labels, packaging." },
    { name: "Co-packing & Labor", accountType: "cost_of_goods_sold", description: "Contract manufacturing for private-label tinctures." },
    { name: "Shipping & Fulfillment", accountType: "cost_of_goods_sold", description: "USPS / UPS outbound on online orders." },

    // === Operating Expenses ===
    { name: "Shop Rent", accountType: "operating_expense", description: "SE Division St lease." },
    { name: "Utilities", accountType: "operating_expense", description: "Electricity, water, internet (Comcast Business)." },
    { name: "Software & Subscriptions", accountType: "operating_expense", description: "Shopify, Square, Notion, Mailchimp, QuickBooks." },
    { name: "Advertising & Marketing", accountType: "operating_expense", description: "Instagram Ads, local print, sponsored events." },
    { name: "Payroll & Wages", accountType: "operating_expense", description: "1 full-time herbalist + 2 part-time staff." },
    { name: "Employee Benefits", accountType: "operating_expense", description: "Anthem health insurance + commuter stipend." },
    { name: "Bank Fees", accountType: "operating_expense", description: "Stripe / Square processing + monthly bank fees." },
    { name: "Travel & Conferences", accountType: "operating_expense", description: "Herbalist conferences, supplier visits." },
    { name: "Insurance", accountType: "operating_expense", description: "Hiscox general liability + product liability." },
]

// Realistic journal entries spread over the last ~90 days. `daysAgo`
// is randomized within a window so the dataset feels organic. `cleared`
// flags whether the bank leg should appear in clearedLegs (~80% true so
// ~20% feed Reconciliation Health).
const TRANSACTION_TEMPLATES = [
    // Recurring revenue (multiple per month)
    { description: "SQUARE PAYOUT", contraName: "Retail Sales — In Store", side: "in", baseAmount: 2100, jitter: 600, count: 9, cleared: 0.85 },
    { description: "SHOPIFY PAYOUT", contraName: "Retail Sales — Online", side: "in", baseAmount: 1400, jitter: 500, count: 8, cleared: 0.85 },
    { description: "WHOLESALE INVOICE PAID — BLOOM SPA", contraName: "Wholesale Revenue", side: "in", baseAmount: 940, jitter: 200, count: 3, cleared: 1.0 },
    { description: "WHOLESALE INVOICE PAID — STILLWATER YOGA", contraName: "Wholesale Revenue", side: "in", baseAmount: 620, jitter: 120, count: 2, cleared: 1.0 },

    // COGS
    { description: "MOUNTAIN ROSE HERBS", contraName: "Inventory Purchases", side: "out", baseAmount: 480, jitter: 220, count: 7, cleared: 0.85 },
    { description: "STARWEST BOTANICALS", contraName: "Inventory Purchases", side: "out", baseAmount: 360, jitter: 180, count: 4, cleared: 1.0 },
    { description: "OBERK PACKAGING", contraName: "Inventory Purchases", side: "out", baseAmount: 290, jitter: 150, count: 3, cleared: 1.0 },
    { description: "CASCADE COPACK CO.", contraName: "Co-packing & Labor", side: "out", baseAmount: 1240, jitter: 320, count: 2, cleared: 1.0 },
    { description: "USPS — RETAIL SHIPPING", contraName: "Shipping & Fulfillment", side: "out", baseAmount: 86, jitter: 40, count: 11, cleared: 0.95 },
    { description: "UPS — WHOLESALE OUTBOUND", contraName: "Shipping & Fulfillment", side: "out", baseAmount: 134, jitter: 50, count: 3, cleared: 1.0 },

    // Operating expenses
    { description: "WEWORK SE DIVISION RENT", contraName: "Shop Rent", side: "out", baseAmount: 2850, jitter: 0, count: 3, cleared: 1.0 },
    { description: "PORTLAND GENERAL ELECTRIC", contraName: "Utilities", side: "out", baseAmount: 168, jitter: 30, count: 3, cleared: 1.0 },
    { description: "COMCAST BUSINESS", contraName: "Utilities", side: "out", baseAmount: 95, jitter: 0, count: 3, cleared: 1.0 },
    { description: "SHOPIFY MONTHLY", contraName: "Software & Subscriptions", side: "out", baseAmount: 79, jitter: 0, count: 3, cleared: 1.0 },
    { description: "SQUARE SUBSCRIPTION", contraName: "Software & Subscriptions", side: "out", baseAmount: 60, jitter: 0, count: 3, cleared: 1.0 },
    { description: "MAILCHIMP", contraName: "Software & Subscriptions", side: "out", baseAmount: 35, jitter: 0, count: 3, cleared: 1.0 },
    { description: "QUICKBOOKS ONLINE", contraName: "Software & Subscriptions", side: "out", baseAmount: 90, jitter: 0, count: 3, cleared: 1.0 },
    { description: "INSTAGRAM ADS — META", contraName: "Advertising & Marketing", side: "out", baseAmount: 220, jitter: 80, count: 4, cleared: 1.0 },
    { description: "WILLAMETTE WEEK SPONSORED POST", contraName: "Advertising & Marketing", side: "out", baseAmount: 380, jitter: 0, count: 1, cleared: 1.0 },
    { description: "GUSTO PAYROLL", contraName: "Payroll & Wages", side: "out", baseAmount: 6840, jitter: 0, count: 6, cleared: 1.0 },
    { description: "ANTHEM HEALTH INSURANCE", contraName: "Employee Benefits", side: "out", baseAmount: 1240, jitter: 0, count: 3, cleared: 1.0 },
    { description: "TRIMET HOP PASS — STAFF", contraName: "Employee Benefits", side: "out", baseAmount: 92, jitter: 0, count: 3, cleared: 1.0 },
    { description: "SQUARE PROCESSING FEES", contraName: "Bank Fees", side: "out", baseAmount: 184, jitter: 60, count: 3, cleared: 1.0 },
    { description: "CHASE MONTHLY SERVICE FEE", contraName: "Bank Fees", side: "out", baseAmount: 18, jitter: 0, count: 3, cleared: 1.0 },
    { description: "HISCOX BUSINESS INSURANCE", contraName: "Insurance", side: "out", baseAmount: 312, jitter: 0, count: 3, cleared: 1.0 },
    { description: "AMERICAN HERBALISTS GUILD CONF.", contraName: "Travel & Conferences", side: "out", baseAmount: 1240, jitter: 0, count: 1, cleared: 1.0 },

    // A few uncategorized — drop the contraName so we send the contra
    // leg to the suspense account. Sprinkles "Pending categorization"
    // and "Recent transactions · Uncategorized" badges.
    { description: "VENMO RECEIVED — IRIS CHEN", contraName: null, side: "in", baseAmount: 1500, jitter: 0, count: 1, cleared: 0 },
    { description: "ZELLE FROM JM REISS", contraName: null, side: "in", baseAmount: 480, jitter: 0, count: 1, cleared: 0 },
    { description: "POS DEBIT TST*UNKNOWN", contraName: null, side: "out", baseAmount: 64, jitter: 30, count: 3, cleared: 0 },
    { description: "ACH DEBIT — UNKNOWN VENDOR", contraName: null, side: "out", baseAmount: 240, jitter: 80, count: 2, cleared: 0 },
]

// Realistic open / in-progress tasks for the client.
const TASK_TEMPLATES = [
    {
        title: "Close April books for Cedar & Sage",
        description: "Reconcile Chase Business Checking, lock the period, send P&L draft to Iris by EOM.",
        priority: "high",
        status: "in_progress",
        dueOffsetDays: 2,
    },
    {
        title: "Classify Venmo deposit — $1,500 from Iris",
        description: "Looks like owner capital reinvestment; confirm with Iris before booking to equity.",
        priority: "medium",
        status: "open",
        dueOffsetDays: 5,
    },
    {
        title: "Request W-9 from Cascade Copack Co.",
        description: "YTD spend past 1099 threshold — pull a current W-9 before year-end.",
        priority: "low",
        status: "open",
        dueOffsetDays: 21,
    },
    {
        title: "Q1 sales tax filing — submitted",
        description: "Filed and paid via state portal — confirmation #OR-2026-Q1-4821.",
        priority: "medium",
        status: "done",
        dueOffsetDays: -8,
    },
]

const NOTES = [
    {
        body: "Owner prefers Friday afternoon check-ins. Send P&L preview via email before scheduling the call.",
    },
    {
        body: "Wholesale revenue should be tracked separately from in-store sales — Iris uses it for partner reporting.",
    },
    {
        body: "Cash Drawer reconciles to $400 at open every morning. Anything above goes to the safe pending deposit.",
    },
]

function randomInRange(base, jitter) {
    const v = base + (Math.random() * 2 - 1) * jitter
    return Math.round(v * 100) / 100
}

function pickDaysAgo(maxDays) {
    return Math.floor(Math.random() * maxDays) + 1
}

function isoDate(d) {
    return d.toISOString().slice(0, 10)
}

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    const db = client.db(process.env.MONGODB_DB_NAME)
    console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

    const ownerProfile = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
    if (!ownerProfile?.officeId) {
        console.error(`No user_profile for ${DEMO_EMAIL}`)
        process.exit(1)
    }
    const officeId = String(ownerProfile.officeId)
    const ownerProfileId = String(ownerProfile._id)
    console.log(`Demo office: ${officeId}`)

    const existing = await db.collection("clients").findOne({ officeId, name: CLIENT_NAME })
    if (existing) {
        console.log(`~ Client "${CLIENT_NAME}" already exists (${existing._id}). Skipping.`)
        await client.close()
        return
    }

    // 1. Client doc
    const owners = [
        { name: "Iris Chen", email: "iris@cedarsage.co", phone: "(503) 555-0182" },
    ]
    const ownerSearch = owners
        .flatMap((o) => [o.name, o.email, o.phone])
        .filter(Boolean)
        .join(" ")
    const now = new Date()
    const clientDoc = {
        officeId,
        name: CLIENT_NAME,
        businessType: "1120-S",
        description: "Independent apothecary and wellness retail with private-label tinctures and a small online store.",
        mainActivity: "Wellness retail",
        state: "Oregon",
        address: "1428 SE Division St, Portland, OR 97202",
        owners,
        ownerEmail: "",
        ownerPhone: "",
        ownerSearch,
        notes: NOTES.map((n, idx) => ({
            id: new ObjectId().toString(),
            body: n.body,
            createdBy: ownerProfileId,
            createdByName: ownerProfile.name || "Demo Owner",
            createdAt: new Date(now.getTime() - (NOTES.length - idx) * 86400000),
            updatedAt: new Date(now.getTime() - (NOTES.length - idx) * 86400000),
        })),
        createdBy: ownerProfileId,
        createdAt: new Date(now.getTime() - 75 * 86400000),
        updatedAt: now,
    }
    const insertedClient = await db.collection("clients").insertOne(clientDoc)
    const clientId = String(insertedClient.insertedId)
    console.log(`+ Client created: ${CLIENT_NAME} (${clientId})`)

    // 2. Chart of accounts
    const accountIdByName = new Map()
    for (const acc of COA) {
        const doc = {
            clientId,
            name: acc.name,
            accountType: acc.accountType,
            description: acc.description,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        }
        const r = await db.collection("coa_accounts").insertOne(doc)
        accountIdByName.set(acc.name, String(r.insertedId))
    }
    // Suspense account — needed for any uncategorized entries.
    const suspenseRes = await db.collection("coa_accounts").insertOne({
        clientId,
        name: "Uncategorized · Suspense",
        accountType: "asset_current",
        description: "Holds the contra side of transactions that haven't been categorized yet.",
        isActive: true,
        isSuspense: true,
        createdAt: now,
        updatedAt: now,
    })
    const suspenseId = String(suspenseRes.insertedId)
    console.log(`+ Chart of accounts: ${COA.length} accounts + suspense`)

    // 3. Journal entries (bank leg vs categorized contra OR vs suspense)
    const bankAccountId = accountIdByName.get("Chase Business Checking")
    if (!bankAccountId) throw new Error("Chase Business Checking not in CoA")

    let totalEntries = 0
    let totalUnclearedBank = 0
    let totalSuspense = 0

    for (const template of TRANSACTION_TEMPLATES) {
        for (let i = 0; i < template.count; i += 1) {
            const daysAgo = pickDaysAgo(85)
            const date = isoDate(new Date(now.getTime() - daysAgo * 86400000))
            const amount = randomInRange(template.baseAmount, template.jitter)
            if (amount <= 0) continue

            const moneyIn = template.side === "in"
            const contraName = template.contraName
            const contraId = contraName ? accountIdByName.get(contraName) : suspenseId
            if (!contraId) {
                console.warn(`! Missing contra "${contraName}" — skipping ${template.description}`)
                continue
            }

            const bankLeg = {
                accountId: bankAccountId,
                debit: moneyIn ? amount : 0,
                credit: moneyIn ? 0 : amount,
                side: moneyIn ? "debit" : "credit",
                description: "",
            }
            const contraLeg = {
                accountId: contraId,
                debit: moneyIn ? 0 : amount,
                credit: moneyIn ? amount : 0,
                side: moneyIn ? "credit" : "debit",
                description: "",
            }

            const wasCleared = Math.random() < template.cleared && contraName !== null
            const clearedLegs = wasCleared
                ? [{ legIndex: 0, clearedAt: new Date(), clearedBy: ownerProfileId }]
                : []

            const entryDoc = {
                _id: new ObjectId(),
                clientId,
                date,
                description: template.description,
                legs: [bankLeg, contraLeg],
                totalDebits: amount,
                totalCredits: amount,
                clearedLegs,
                source: "demo-full-client",
                externalId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
            await db.collection("journal_entries").insertOne(entryDoc)
            totalEntries += 1
            if (!wasCleared) totalUnclearedBank += 1
            if (contraName === null) totalSuspense += 1
        }
    }
    console.log(`+ Journal entries: ${totalEntries} (uncleared bank legs: ${totalUnclearedBank}, suspense: ${totalSuspense})`)

    // 4. Tasks linked to this client
    let taskInserted = 0
    for (const t of TASK_TEMPLATES) {
        const dueDate = new Date(now.getTime() + t.dueOffsetDays * 86400000)
        const isDone = t.status === "done"
        const doneAt = isDone ? new Date(now.getTime() - 5 * 86400000) : null
        const statusHistory = [{ status: "open", at: new Date(now.getTime() - 14 * 86400000), by: ownerProfileId }]
        if (t.status === "in_progress") {
            statusHistory.push({ status: "in_progress", at: new Date(now.getTime() - 6 * 86400000), by: ownerProfileId })
        }
        if (isDone) {
            statusHistory.push({ status: "in_progress", at: new Date(now.getTime() - 10 * 86400000), by: ownerProfileId })
            statusHistory.push({ status: "done", at: doneAt, by: ownerProfileId })
        }
        await db.collection("tasks").insertOne({
            officeId,
            clientIds: [clientId],
            assigneeIds: [ownerProfileId],
            clientId,
            assigneeId: ownerProfileId,
            dueDate: isoDate(dueDate),
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            doneAt,
            statusHistory,
            comments: [],
            collectionId: null,
            createdBy: ownerProfileId,
            createdAt: new Date(now.getTime() - 14 * 86400000),
            updatedAt: now,
        })
        taskInserted += 1
    }
    console.log(`+ Tasks: ${taskInserted}`)

    console.log(`\nDone. Open the demo as ${DEMO_EMAIL} and visit ${CLIENT_NAME}'s Dashboard.`)
    await client.close()
}

main().catch((err) => {
    console.error("FAILED:", err?.message || err)
    process.exit(1)
})
