/* eslint-disable no-console */
// Moves the bookkeeping account docs out of the shared `account`
// collection (used by Better Auth) into a dedicated `coa_accounts`
// collection. Bookkeeping docs are identified by having a `clientId`
// field; Better Auth credentials don't have one and stay in `account`.
//
// Idempotent: re-running after success is a no-op because the source
// query no longer finds any docs.

import "dotenv/config"
import { MongoClient } from "mongodb"

const DRY_RUN = process.argv.includes("--dry-run")
const MONGO_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB_NAME

if (!MONGO_URI || !DB_NAME) {
  console.error("Missing MONGODB_URI or MONGODB_DB_NAME")
  process.exit(1)
}

const client = new MongoClient(MONGO_URI)

async function main() {
  await client.connect()
  const db = client.db(DB_NAME)
  console.log(`Connected to ${DB_NAME} (dry-run: ${DRY_RUN})`)

  const bookkeepingFilter = { clientId: { $exists: true } }

  const sourceCount = await db.collection("account").countDocuments(bookkeepingFilter)
  console.log(`Bookkeeping docs in account: ${sourceCount}`)

  const targetCount = await db
    .collection("coa_accounts")
    .countDocuments()
    .catch(() => 0)
  console.log(`Existing docs in coa_accounts: ${targetCount}`)

  if (sourceCount === 0) {
    console.log("Nothing to move — done")
    return
  }

  if (DRY_RUN) {
    console.log(`DRY RUN: would move ${sourceCount} docs and delete them from account`)
    return
  }

  const docs = await db.collection("account").find(bookkeepingFilter).toArray()
  if (docs.length > 0) {
    await db.collection("coa_accounts").insertMany(docs, { ordered: false }).catch((err) => {
      // Duplicate key on re-run is OK — already moved
      if (err?.code !== 11000) throw err
      console.log("Some docs already in coa_accounts (duplicate keys ignored)")
    })
    console.log(`Inserted ${docs.length} docs into coa_accounts`)
  }

  const deleteResult = await db.collection("account").deleteMany(bookkeepingFilter)
  console.log(`Deleted ${deleteResult.deletedCount} bookkeeping docs from account`)

  await Promise.all([
    db.collection("coa_accounts").createIndex({ clientId: 1, createdAt: -1 }),
    db.collection("coa_accounts").createIndex({ clientId: 1, accountType: 1 }),
    db.collection("coa_accounts").createIndex({ clientId: 1, isActive: 1 }),
  ])
  console.log("Indexes ensured on coa_accounts")

  console.log("Done")
}

main()
  .catch((err) => {
    console.error("Rename failed:", err)
    process.exitCode = 1
  })
  .finally(() => client.close())
