// Backfills the credential `account` record for the demo user, since
// the standalone signUpEmail call left it missing. Uses better-auth's
// hashPassword so the hash format matches what the login flow expects.

import "dotenv/config"
import { ObjectId } from "mongodb"
import { hashPassword } from "better-auth/crypto"
import { connectDB, closeDB, getDB } from "../src/db.js"

const EMAIL = "demo@categorizationai.com"
const PASSWORD = "demo12345"

const db = await connectDB()

const user = await getDB().collection("user").findOne({ email: EMAIL })
if (!user?._id) {
  console.error(`No auth user found for ${EMAIL}`)
  process.exit(1)
}

const existing = await getDB().collection("account").findOne({
  providerId: "credential",
  userId: user._id,
})

if (existing?._id) {
  console.log("Credential account already exists, updating password only.")
  await getDB().collection("account").updateOne(
    { _id: existing._id },
    { $set: { password: await hashPassword(PASSWORD), updatedAt: new Date() } }
  )
} else {
  console.log("Creating credential account record...")
  const passwordHash = await hashPassword(PASSWORD)
  await getDB().collection("account").insertOne({
    accountId: String(user._id),
    providerId: "credential",
    userId: user._id,
    password: passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

console.log("Done.")
await closeDB()
