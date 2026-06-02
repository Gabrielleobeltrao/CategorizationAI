// Sets a starting AI credit balance on the demo office and writes a
// handful of historical debits to the credit_ledger so the future
// usage history widget has something to render.
//
// Idempotent: if the office already shows non-zero balance, the script
// only backfills missing ledger entries — it doesn't double-credit.

import "dotenv/config"
import { ObjectId } from "mongodb"
import { connectDB, closeDB, getDB } from "../src/db.js"
import { DEFAULT_NEW_OFFICE_CREDITS } from "../src/config/credits.js"

const DEMO_EMAIL = "demo@categorizationai.com"

// Backdated debits so the ledger feels lived-in. amounts are realistic
// for a few categorization jobs against gpt-4.1-mini.
const HISTORY = [
    { hoursAgo:  4, tokensIn: 14200, tokensOut: 2_650, model: "gpt-4.1-mini", kind: "llm.categorize" },
    { hoursAgo: 28, tokensIn:  9_400, tokensOut: 1_320, model: "gpt-4.1-mini", kind: "llm.categorize" },
    { hoursAgo: 31, tokensIn: 22_800, tokensOut: 3_410, model: "gpt-4.1-mini", kind: "llm.categorize" },
    { hoursAgo: 52, tokensIn:  5_600, tokensOut:   780, model: "gpt-4.1-mini", kind: "llm.categorize.zelle" },
    { hoursAgo: 75, tokensIn: 11_300, tokensOut: 1_900, model: "gpt-4.1-mini", kind: "llm.categorize" },
    { hoursAgo: 96, tokensIn: 18_400, tokensOut: 2_810, model: "gpt-4.1-mini", kind: "llm.categorize" },
]

function costOf({ tokensIn, tokensOut }) {
    const inputRate = 0.00015
    const outputRate = 0.0006
    return Math.round((tokensIn * inputRate + tokensOut * outputRate) * 10000) / 10000
}

async function main() {
    await connectDB()
    const db = getDB()
    console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

    const ownerProfile = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
    if (!ownerProfile?.officeId) {
        console.error(`No user_profile for ${DEMO_EMAIL}.`)
        process.exit(1)
    }
    const officeId = String(ownerProfile.officeId)
    console.log(`Demo office: ${officeId}`)

    const office = await db.collection("offices").findOne({ _id: new ObjectId(officeId) })
    const currentBalance = Number(office?.credits?.balance) || 0
    const totalDebit = HISTORY.reduce((s, h) => s + costOf(h), 0)

    if (currentBalance === 0) {
        const startingBalance = DEFAULT_NEW_OFFICE_CREDITS
        // Seed: initial grant first, then the debits, so the final
        // balance reflects DEFAULT_NEW_OFFICE_CREDITS minus the
        // historical usage.
        const grantAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        await db.collection("credit_ledger").insertOne({
            officeId,
            at: grantAt,
            direction: "credit",
            amount: startingBalance,
            kind: "initial_grant",
            jobId: null,
            tokensIn: null,
            tokensOut: null,
            model: null,
            meta: { reason: "demo seed" },
        })
        for (const h of HISTORY) {
            await db.collection("credit_ledger").insertOne({
                officeId,
                at: new Date(Date.now() - h.hoursAgo * 3600000),
                direction: "debit",
                amount: costOf(h),
                kind: h.kind,
                jobId: null,
                tokensIn: h.tokensIn,
                tokensOut: h.tokensOut,
                model: h.model,
                meta: { reason: "demo seed" },
            })
        }
        const finalBalance = Math.round((startingBalance - totalDebit) * 10000) / 10000
        await db.collection("offices").updateOne(
            { _id: new ObjectId(officeId) },
            {
                $set: {
                    "credits.balance": finalBalance,
                    "credits.lastToppedUpAt": grantAt,
                    "credits.lastChargedAt": new Date(Date.now() - HISTORY[0].hoursAgo * 3600000),
                },
            },
        )
        console.log(`  + initial grant: ${startingBalance}`)
        console.log(`  + ${HISTORY.length} historical debits: -${totalDebit.toFixed(4)}`)
        console.log(`  → final balance: ${finalBalance}`)
    } else {
        console.log(`  ~ office already has balance ${currentBalance}, skipping seed`)
    }

    console.log("\nDone.")
    await closeDB()
}

main().catch(async (err) => {
    console.error("FAILED:", err?.message || err)
    await closeDB().catch(() => null)
    process.exit(1)
})
