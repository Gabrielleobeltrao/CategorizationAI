/* eslint-disable no-console */
// One-shot migration from single-entry to double-entry bookkeeping.
//
// What it does:
// 1. Drops the `transactions` collection entirely (test data only).
// 2. For every doc in `account`, sets the new `accountType` field (from
//    explicit `balanceSheetType` or inferred from the legacy `type`
//    field). Also sets `description` (empty if missing), `isActive: true`,
//    and removes the now-deprecated `type` and `balanceSheetType` fields.
// 3. For every doc in `categories`, moves it to `account` with
//    accountType = category.type. Keeps category description as the
//    account description.
// 4. Drops the `categories` collection.
//
// Idempotent: re-running on already-migrated data is a no-op.
//
// Usage: node scripts/migrateToDoubleEntry.js [--dry-run]

import "dotenv/config"
import { MongoClient } from "mongodb"
import {
  inferAccountTypeFromLegacyAccount,
  inferAccountTypeFromLegacyCategory,
  isValidAccountType,
} from "../src/config/accountTypes.js"

const DRY_RUN = process.argv.includes("--dry-run")
const MONGO_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB_NAME

if (!MONGO_URI || !DB_NAME) {
  console.error("Missing MONGODB_URI or MONGODB_DB_NAME in env")
  process.exit(1)
}

const client = new MongoClient(MONGO_URI)

async function main() {
  await client.connect()
  const db = client.db(DB_NAME)
  console.log(`Connected to ${DB_NAME} (dry-run: ${DRY_RUN})`)

  // 1. Drop transactions (all test data per user instruction).
  const txCount = await db.collection("transactions").countDocuments()
  console.log(`transactions: ${txCount} docs will be dropped`)
  if (!DRY_RUN && txCount > 0) {
    await db.collection("transactions").drop()
    console.log("  → dropped")
  }

  // 2. Migrate accounts to the unified schema.
  const accounts = await db.collection("account").find({}).toArray()
  let accountsUpdated = 0
  let accountsSkipped = 0
  for (const account of accounts) {
    if (account.accountType && isValidAccountType(account.accountType)) {
      // Already migrated.
      accountsSkipped += 1
      continue
    }

    const accountType = inferAccountTypeFromLegacyAccount({
      balanceSheetType: account.balanceSheetType,
      type: account.type,
    })

    if (!accountType) {
      console.warn(
        `  ! account ${account._id} (${account.name}) has no inferable accountType — leaving as-is`,
      )
      continue
    }

    const set = {
      accountType,
      description: typeof account.description === "string" ? account.description : "",
      isActive: account.isActive !== false,
      updatedAt: new Date(),
    }
    const unset = { type: "", balanceSheetType: "" }

    if (!DRY_RUN) {
      await db.collection("account").updateOne(
        { _id: account._id },
        { $set: set, $unset: unset },
      )
    }
    accountsUpdated += 1
  }
  console.log(`account: ${accountsUpdated} updated, ${accountsSkipped} already migrated`)

  // 3. Move categories → account.
  const hasCategoriesCollection = (await db.listCollections({ name: "categories" }).toArray()).length > 0
  if (hasCategoriesCollection) {
    const categories = await db.collection("categories").find({}).toArray()
    let categoriesMigrated = 0
    let categoriesSkipped = 0

    for (const category of categories) {
      const accountType = inferAccountTypeFromLegacyCategory({ type: category.type })
      if (!accountType) {
        console.warn(
          `  ! category ${category._id} (${category.name}) has unknown type "${category.type}" — skipping`,
        )
        categoriesSkipped += 1
        continue
      }

      const doc = {
        _id: category._id, // preserve id so any straggler reference still resolves
        clientId: category.clientId,
        name: category.name || "",
        accountType,
        description: typeof category.description === "string" ? category.description : "",
        isActive: category.isActive !== false,
        createdAt: category.createdAt || new Date(),
        updatedAt: new Date(),
      }

      if (!DRY_RUN) {
        await db.collection("account").updateOne(
          { _id: category._id },
          { $set: doc },
          { upsert: true },
        )
      }
      categoriesMigrated += 1
    }
    console.log(`categories → account: ${categoriesMigrated} migrated, ${categoriesSkipped} skipped`)

    // 4. Categories collection is left in place for now. Subsequent migration
    //    commits will rewire any remaining readers to the `account` collection
    //    before dropping it. Re-running this script is safe — the upsert above
    //    is idempotent.
  } else {
    console.log("categories: collection not present, skipping")
  }

  // Indexes for the new schema.
  if (!DRY_RUN) {
    await db.collection("account").createIndex({ clientId: 1, accountType: 1 })
    await db.collection("account").createIndex({ clientId: 1, isActive: 1 })
    console.log("indexes ensured on account")
  }

  console.log(DRY_RUN ? "DRY RUN complete (no changes made)" : "Migration complete")
}

main()
  .catch((err) => {
    console.error("Migration failed:", err)
    process.exitCode = 1
  })
  .finally(() => client.close())
