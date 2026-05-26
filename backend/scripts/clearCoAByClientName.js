/* eslint-disable no-console */
// Deletes all coa_accounts (the unified Chart of Accounts) for the
// client whose name matches --client, scoped to the office owned by
// the user identified by --email. Run with --dry-run first to preview.
//
// Usage:
//   node scripts/clearCoAByClientName.js \
//     --email=gabrielleoaus@gmail.com \
//     --client="WALTER DA SILVA SOLUTIONS LLC" [--dry-run]

import "dotenv/config"
import { MongoClient } from "mongodb"

function parseArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split("=").slice(1).join("=") : null
}

async function main() {
  const email = parseArg("email")
  const clientName = parseArg("client")
  const isDryRun = process.argv.includes("--dry-run")

  if (!email || !clientName) {
    console.error("Usage: --email=<email> --client=\"<name>\" [--dry-run]")
    process.exit(1)
  }
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME) {
    console.error("Set MONGODB_URI and MONGODB_DB_NAME")
    process.exit(1)
  }

  const mongo = new MongoClient(process.env.MONGODB_URI)
  await mongo.connect()
  const db = mongo.db(process.env.MONGODB_DB_NAME)
  console.log(`Connected to ${process.env.MONGODB_DB_NAME} (dry-run: ${isDryRun})`)

  const profile = await db.collection("user_profile").findOne({ email: email.toLowerCase() })
  if (!profile) {
    console.error(`No user_profile for ${email}`)
    process.exit(1)
  }
  console.log(`user_profile: ${profile._id}  officeId=${profile.officeId}`)

  const client = await db.collection("clients").findOne({
    officeId: String(profile.officeId),
    name: clientName,
  })
  if (!client) {
    const all = await db.collection("clients").find({ officeId: String(profile.officeId) }).toArray()
    console.error(`Client "${clientName}" not found in office ${profile.officeId}.`)
    console.error("Clients in this office:")
    for (const c of all) console.error(`  ${c._id}  ${c.name}`)
    process.exit(1)
  }
  const clientId = String(client._id)
  console.log(`Target client: ${clientId}  "${client.name}"\n`)

  const accounts = await db.collection("coa_accounts").find({ clientId }).toArray()
  console.log(`coa_accounts in client (${accounts.length}):`)
  for (const a of accounts) {
    const flags = a.isSuspense ? " [suspense]" : ""
    console.log(`  ${a._id}  ${String(a.accountType || "").padEnd(20)} ${a.name}${flags}`)
  }

  if (accounts.length === 0) {
    console.log("\nNothing to delete.")
    await mongo.close()
    return
  }

  if (isDryRun) {
    console.log("\n(dry run — nothing written)")
    await mongo.close()
    return
  }

  const result = await db.collection("coa_accounts").deleteMany({ clientId })
  console.log(`\nDeleted ${result.deletedCount} coa_accounts.`)
  await mongo.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
