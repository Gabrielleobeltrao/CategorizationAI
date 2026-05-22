/* eslint-disable no-console */
// Smoke test for the rewritten categorizeTransaction prompt.
// Pulls real P&L accounts from coa_accounts and runs synthetic
// transactions through the AI, then prints results + a manual scorecard.

import "dotenv/config"
import { MongoClient } from "mongodb"
import categorizeTransaction from "../src/lib/ai/categorizeTransaction.js"

const SYNTHETIC_TRANSACTIONS = [
  // === Crystal-clear matches (should land at >0.85 confidence) ===
  { id: "t1", description: "GOOGLE ADS PAYMENT 5544", amount: -480 },
  { id: "t2", description: "FACEBOOK ADS 13441", amount: -220 },
  { id: "t3", description: "AMAZON WEB SERVICES BILL", amount: -210 },
  { id: "t4", description: "FIGMA PROFESSIONAL", amount: -45 },
  { id: "t5", description: "WEWORK OFFICE RENT MARCH", amount: -890 },
  { id: "t6", description: "COMCAST INTERNET BILL", amount: -150 },
  { id: "t7", description: "UBER EATS DOWNTOWN", amount: -38.5 },
  { id: "t8", description: "STARBUCKS #4321", amount: -8.75 },
  { id: "t9", description: "DELTA AIRLINES TICKET", amount: -560 },
  { id: "t10", description: "MARRIOTT HOTEL CHICAGO", amount: -340 },
  { id: "t11", description: "SHELL OIL #4422", amount: -65.1 },
  { id: "t12", description: "EZ-PASS NJ TURNPIKE", amount: -12 },
  { id: "t13", description: "ADP PAYROLL RUN", amount: -8500 },
  { id: "t14", description: "ANTHEM HEALTH INSURANCE", amount: -1200 },
  { id: "t15", description: "STAPLES OFFICE SUPPLIES", amount: -85 },
  { id: "t16", description: "HARTFORD BUSINESS INSURANCE", amount: -420 },
  { id: "t17", description: "STRIPE PAYOUT", amount: 4250 },
  { id: "t18", description: "ACH FROM JOHN SMITH - CONSULTING", amount: 3500 },
  { id: "t19", description: "SHOPIFY PAYOUT - APRIL", amount: 980 },
  { id: "t20", description: "INTEREST EARNED 0.04%", amount: 4.12 },
  { id: "t21", description: "WIRE FEE OUTGOING", amount: -25 },
  { id: "t22", description: "BANK OF AMERICA MONTHLY MAINTENANCE FEE", amount: -12 },
  { id: "t23", description: "INTEREST ON LOAN AB1234", amount: -180 },
  { id: "t24", description: "IRS EFTPS PAYMENT Q1", amount: -2500 },
  { id: "t25", description: "CA FTB ESTIMATED TAX", amount: -480 },
  { id: "t26", description: "USPS POSTAGE LABEL", amount: -18.5 },
  { id: "t27", description: "FEDEX SHIPPING TO CLIENT", amount: -45 },
  { id: "t28", description: "HOME DEPOT SUPPLIES", amount: -240 },
  { id: "t29", description: "CONTRACTOR PAYMENT - JANE", amount: -2200 },

  // === Ambiguous / merchant-only (should pick best fit or null) ===
  { id: "t30", description: "AMAZON", amount: -150 },   // could be supplies or AWS
  { id: "t31", description: "TARGET", amount: -90 },    // hard — supplies? meals? office?

  // === Should refuse (P&L doesn't apply) ===
  { id: "t32", description: "TRANSFER FROM SAVINGS", amount: 1000 },
  { id: "t33", description: "XFER TO PAYROLL CLEARING", amount: -8500 },

  // === Direction stress (refund treated as other_income) ===
  { id: "t34", description: "REFUND FROM FIGMA", amount: 45 },
  { id: "t35", description: "AWS CREDIT REBATE", amount: 100 },
]

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)

  // Pick any client that has accounts (random) for the test.
  const sampleAccount = await db
    .collection("coa_accounts")
    .findOne({ accountType: { $in: ["income", "operating_expense", "cost_of_goods_sold"] } })

  if (!sampleAccount) {
    console.error("No P&L accounts found — run the migration first.")
    process.exit(1)
  }

  const clientId = sampleAccount.clientId
  console.log(`Using clientId=${clientId}\n`)

  const accounts = await db
    .collection("coa_accounts")
    .find({
      clientId,
      accountType: {
        $in: [
          "income",
          "cost_of_goods_sold",
          "operating_expense",
          "other_income",
          "other_expense",
          "tax_expense",
        ],
      },
    })
    .toArray()

  console.log(`Found ${accounts.length} P&L accounts in CoA:\n`)
  for (const a of accounts) {
    const desc = a.description ? ` | "${a.description}"` : ""
    console.log(`  ${a.accountType.padEnd(22)} | ${a.name}${desc}`)
  }
  console.log()

  const aiInputAccounts = accounts.map((a) => ({
    id: String(a._id),
    name: a.name,
    accountType: a.accountType,
    description: a.description || "",
  }))

  const business = {
    name: "Test Client",
    businessType: "service business",
    mainActivity: "general operations",
    description: "",
  }

  console.log(`Running ${SYNTHETIC_TRANSACTIONS.length} transactions through the AI…\n`)
  const t0 = Date.now()
  const results = await categorizeTransaction(aiInputAccounts, SYNTHETIC_TRANSACTIONS, business, {
    batchSize: 20,
  })
  const elapsed = Date.now() - t0
  console.log(`Done in ${elapsed}ms\n`)

  const accountById = new Map(aiInputAccounts.map((a) => [a.id, a]))

  console.log("=".repeat(110))
  console.log("Transaction".padEnd(40), "→".padEnd(3), "Suggested account".padEnd(40), "Conf.".padEnd(7), "Amb.")
  console.log("=".repeat(110))
  for (let i = 0; i < SYNTHETIC_TRANSACTIONS.length; i += 1) {
    const tx = SYNTHETIC_TRANSACTIONS[i]
    const result = results[i]
    const acc = result?.accountId ? accountById.get(result.accountId) : null
    const accLabel = acc ? `${acc.name} (${acc.accountType})` : "—"
    const txLabel = `${tx.description.slice(0, 28)} $${tx.amount}`
    console.log(
      txLabel.padEnd(40),
      "→".padEnd(3),
      accLabel.padEnd(40),
      `${(result?.confidence ?? 0).toFixed(2)}`.padEnd(7),
      result?.ambiguous ? "yes" : "no",
    )
  }

  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
