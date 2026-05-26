/* eslint-disable no-console */
// Read-only sanity checks against the live database to confirm the
// double-entry migration left the system in the shape we expect.
// Doesn't modify anything.

import "dotenv/config"
import { MongoClient } from "mongodb"
import { ACCOUNT_TYPE_VALUES } from "../src/config/accountTypes.js"

const MONGO_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB_NAME

if (!MONGO_URI || !DB_NAME) {
  console.error("Missing MONGODB_URI or MONGODB_DB_NAME")
  process.exit(1)
}

const client = new MongoClient(MONGO_URI)

function logCheck(name, ok, detail = "") {
  const symbol = ok ? "✓" : "✗"
  console.log(`${symbol} ${name}${detail ? `: ${detail}` : ""}`)
  return ok
}

async function main() {
  await client.connect()
  const db = client.db(DB_NAME)
  console.log(`Connected to ${DB_NAME}\n`)

  let pass = 0
  let fail = 0
  const track = (ok) => (ok ? pass++ : fail++)

  // 1. transactions dropped
  const txCount = await db.collection("transactions").countDocuments().catch(() => 0)
  track(logCheck("transactions collection is empty", txCount === 0, `${txCount} docs`))

  // 2. categories collection dropped
  const collections = await db.listCollections().toArray()
  const hasCatsCollection = collections.some((c) => c.name === "categories")
  if (hasCatsCollection) {
    const catsCount = await db.collection("categories").countDocuments()
    track(logCheck("categories collection drained", catsCount === 0, `${catsCount} docs`))
  } else {
    track(logCheck("categories collection dropped", true))
  }

  // 3. coa_accounts collection populated (bookkeeping accounts moved
  //    out of the shared `account` collection used by Better Auth)
  const coaCount = await db.collection("coa_accounts").countDocuments()
  track(logCheck("coa_accounts collection populated", coaCount > 0, `${coaCount} docs`))

  // 4. No bookkeeping docs left in `account` (Better Auth's collection)
  const strayCount = await db.collection("account").countDocuments({ clientId: { $exists: true } })
  track(logCheck("no bookkeeping docs left in account", strayCount === 0, `${strayCount} found`))

  // 5. Every coa_accounts doc has accountType
  const missingAccountType = await db
    .collection("coa_accounts")
    .countDocuments({ accountType: { $exists: false } })
  track(
    logCheck(
      "every coa_account has accountType",
      missingAccountType === 0,
      `${missingAccountType} missing`,
    ),
  )

  // 6. No legacy `type` or `balanceSheetType` fields
  const stillHasType = await db
    .collection("coa_accounts")
    .countDocuments({ type: { $exists: true } })
  track(logCheck("legacy account.type removed", stillHasType === 0, `${stillHasType} still have it`))

  const stillHasBS = await db
    .collection("coa_accounts")
    .countDocuments({ balanceSheetType: { $exists: true } })
  track(
    logCheck("legacy balanceSheetType removed", stillHasBS === 0, `${stillHasBS} still have it`),
  )

  // 7. accountType values are all canonical
  const distinctTypes = await db.collection("coa_accounts").distinct("accountType")
  const invalid = distinctTypes.filter((t) => t && !ACCOUNT_TYPE_VALUES.includes(t))
  track(
    logCheck(
      "all accountType values are canonical",
      invalid.length === 0,
      invalid.length ? `invalid: ${invalid.join(", ")}` : "",
    ),
  )

  // 8. Distribution by type
  console.log("\nAccount distribution by type:")
  const distribution = await db
    .collection("coa_accounts")
    .aggregate([
      { $group: { _id: "$accountType", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  for (const row of distribution) {
    console.log(`  ${row._id || "(no accountType)"}: ${row.count}`)
  }

  // 9. Sample one P&L account
  const sampleCategory = await db
    .collection("coa_accounts")
    .findOne({ accountType: { $in: ["income", "operating_expense", "cost_of_goods_sold"] } })
  if (sampleCategory) {
    console.log("\nSample P&L account:")
    console.log(`  name: ${sampleCategory.name}`)
    console.log(`  accountType: ${sampleCategory.accountType}`)
    console.log(`  description: ${sampleCategory.description || "(empty)"}`)
    console.log(`  isActive: ${sampleCategory.isActive}`)
  }

  // 10. Sample one Balance Sheet account
  const sampleBank = await db
    .collection("coa_accounts")
    .findOne({ accountType: { $in: ["asset_current", "liability_current"] } })
  if (sampleBank) {
    console.log("\nSample BS account:")
    console.log(`  name: ${sampleBank.name}`)
    console.log(`  accountType: ${sampleBank.accountType}`)
    console.log(`  description: ${sampleBank.description || "(empty)"}`)
    console.log(`  isActive: ${sampleBank.isActive}`)
  }

  // 11. Indexes on coa_accounts
  console.log("\nIndexes on coa_accounts collection:")
  const indexes = await db.collection("coa_accounts").indexes()
  for (const idx of indexes) {
    console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main()
  .catch((err) => {
    console.error("Check failed:", err)
    process.exit(1)
  })
  .finally(() => client.close())
