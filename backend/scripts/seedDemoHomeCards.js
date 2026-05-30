// Populates the two Home page widgets that need synthetic suspense /
// reconciliation data on the demo office:
//
//   Pending Categorization → counts journal_entries that carry a leg
//   pointing at the client's suspense account (isSuspense: true).
//
//   Reconciliation Health  → counts bank legs (asset_current / etc.)
//   that have not been added to clearedLegs on the entry.
//
// For each demo client we:
//   1. Upsert a "Uncategorized · Suspense" account flagged isSuspense
//   2. Insert N entries with bank+suspense legs (the entries that show
//      up under "Pending Categorization") — varied counts so clients
//      sort differently on the card
//   3. Insert M entries on the bank account WITHOUT marking them in
//      clearedLegs so they appear under "Reconciliation Health"
//
// Idempotent on the suspense account (by isSuspense+clientId). Entries
// are de-duped by (clientId, date, description) to keep re-runs no-op.

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"

const SUSPENSE_NAME = "Uncategorized · Suspense"

// How many entries per client to seed for each card. Varied so the
// "Top across office" view has a meaningful sort order.
const PROFILE = [
    { match: /sunset/i,    suspense: 14, uncleared: 9 },
    { match: /aurora/i,    suspense:  6, uncleared: 4 },
    { match: /blue ridge/i, suspense:  3, uncleared: 2 },
    { match: /granite/i,   suspense:  8, uncleared: 5 },
    { match: /northwind/i, suspense:  0, uncleared: 0 },
    { match: /hudson/i,    suspense:  2, uncleared: 1 },
]

const VENDORS = [
    "WALMART #1842", "CVS PHARMACY", "SQUARE *MERCHANT", "ACH DEPOSIT",
    "VENMO PAYMENT", "STRIPE TRANSFER", "WIRE OUT 3491", "POS DEBIT TST",
    "ZELLE PAYMENT", "MOBILE DEPOSIT", "ATM WITHDRAWAL", "CHECK 1024",
    "PAYPAL TRANSFER", "INTUIT QUICKBKS",
]

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function spreadDate(daysBack) {
    const now = Date.now()
    const at = new Date(now - Math.floor(Math.random() * daysBack) * 86400000)
    return at.toISOString().slice(0, 10)
}

async function ensureSuspense(db, clientId) {
    const existing = await db.collection("coa_accounts").findOne({
        clientId: String(clientId),
        isSuspense: true,
    })
    if (existing) return existing
    const doc = {
        clientId: String(clientId),
        name: SUSPENSE_NAME,
        accountType: "asset_current",
        description: "Holds the contra side of transactions that haven't been categorized yet.",
        isActive: true,
        isSuspense: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    }
    const r = await db.collection("coa_accounts").insertOne(doc)
    return { ...doc, _id: r.insertedId }
}

async function getBankAccount(db, clientId) {
    return db.collection("coa_accounts").findOne({
        clientId: String(clientId),
        name: /chase|bank|checking/i,
        isSuspense: { $ne: true },
    })
}

async function insertJournalEntry(db, { clientId, date, description, bankAccountId, contraAccountId, amount, source }) {
    const existing = await db.collection("journal_entries").findOne({
        clientId: String(clientId),
        date,
        description,
    })
    if (existing) return null
    const moneyIn = amount > 0
    const magnitude = Math.abs(amount)
    const bankLeg = {
        accountId: String(bankAccountId),
        debit:  moneyIn ? magnitude : 0,
        credit: moneyIn ? 0 : magnitude,
        side:   moneyIn ? "debit" : "credit",
        description: "",
    }
    const contraLeg = {
        accountId: String(contraAccountId),
        debit:  moneyIn ? 0 : magnitude,
        credit: moneyIn ? magnitude : 0,
        side:   moneyIn ? "credit" : "debit",
        description: "",
    }
    const now = new Date()
    const doc = {
        _id: new ObjectId(),
        clientId: String(clientId),
        date,
        description,
        legs: [bankLeg, contraLeg],
        totalDebits: magnitude,
        totalCredits: magnitude,
        source,
        externalId: null,
        // clearedLegs intentionally absent so the bank leg counts as
        // uncleared for the reconciliation widget.
        createdAt: now,
        updatedAt: now,
    }
    await db.collection("journal_entries").insertOne(doc)
    return doc
}

async function seedForClient(db, client, profile) {
    const bank = await getBankAccount(db, client._id)
    if (!bank) {
        return { client: client.name, suspense: 0, uncleared: 0, skipped: "no bank account" }
    }
    const suspense = await ensureSuspense(db, client._id)

    let suspenseCount = 0
    let unclearedOnly = 0

    // Suspense entries — show up in BOTH widgets (suspense leg = pending
    // categorization, bank leg without clearedLegs = uncleared).
    for (let i = 0; i < profile.suspense; i += 1) {
        const desc = `${pick(VENDORS)} #${1000 + i}`
        const amt = +(Math.random() * 480 - 240).toFixed(2)
        const inserted = await insertJournalEntry(db, {
            clientId: client._id,
            date: spreadDate(60),
            description: desc,
            bankAccountId: bank._id,
            contraAccountId: suspense._id,
            amount: amt === 0 ? 25 : amt,
            source: "demo-home-cards-suspense",
        })
        if (inserted) suspenseCount += 1
    }

    // Reconciliation-only entries — bank + categorized contra (revenue
    // account), no clearedLegs → counts toward Reconciliation Health but
    // NOT Pending Categorization.
    const incomeContra = await db.collection("coa_accounts").findOne({
        clientId: String(client._id),
        accountType: "income",
        isActive: { $ne: false },
    })
    const expenseContra = await db.collection("coa_accounts").findOne({
        clientId: String(client._id),
        accountType: "operating_expense",
        isActive: { $ne: false },
    })

    for (let i = 0; i < profile.uncleared; i += 1) {
        const useIncome = Math.random() < 0.5 && incomeContra
        const contra = useIncome ? incomeContra : expenseContra
        if (!contra) continue
        const desc = `${pick(VENDORS)} OP-${2000 + i}`
        const sign = useIncome ? 1 : -1
        const amt = sign * +(Math.random() * 900 + 80).toFixed(2)
        const inserted = await insertJournalEntry(db, {
            clientId: client._id,
            date: spreadDate(30),
            description: desc,
            bankAccountId: bank._id,
            contraAccountId: contra._id,
            amount: amt,
            source: "demo-home-cards-uncleared",
        })
        if (inserted) unclearedOnly += 1
    }

    return { client: client.name, suspense: suspenseCount, uncleared: unclearedOnly }
}

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    const db = client.db(process.env.MONGODB_DB_NAME)
    console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

    const ownerProfile = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
    if (!ownerProfile?.officeId) {
        console.error(`No user_profile for ${DEMO_EMAIL}.`)
        process.exit(1)
    }
    const officeId = String(ownerProfile.officeId)
    console.log(`Demo office: ${officeId}\n`)

    const clients = await db.collection("clients").find({ officeId }).toArray()
    for (const c of clients) {
        const profile = PROFILE.find((p) => p.match.test(String(c.name || ""))) ||
            { suspense: 4, uncleared: 3 }
        if (profile.suspense === 0 && profile.uncleared === 0) {
            console.log(`  ~ ${c.name}: skipped (kept clean for variety)`)
            continue
        }
        const r = await seedForClient(db, c, profile)
        if (r.skipped) {
            console.log(`  ~ ${r.client}: ${r.skipped}`)
        } else {
            console.log(`  + ${r.client}: ${r.suspense} suspense + ${r.uncleared} uncleared`)
        }
    }

    console.log("\nDone. Reload Home to see the cards populate.")
    await client.close()
}

main().catch((err) => {
    console.error("FAILED:", err?.message || err)
    process.exit(1)
})
