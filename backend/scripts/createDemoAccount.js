// One-shot: creates a demo Office + owner user in the database pointed
// at by backend/.env. Intended to be run manually:
//   node scripts/createDemoAccount.js
//
// Safe to re-run: aborts if the email already exists in either the
// better-auth `user` collection or the `user_profile` collection.

import "dotenv/config"
import { connectDB, closeDB, getDB } from "../src/db.js"
import { createAuth } from "../src/lib/auth.js"
import { createOffice } from "../src/repositories/office.repository.js"
import {
  createUserProfile,
  getAuthUserByEmail,
  getUserProfileByEmail,
} from "../src/repositories/userProfile.repository.js"

const DEMO_EMAIL = "demo@categorizationai.com"
const DEMO_PASSWORD = "demo12345"
const DEMO_NAME = "Demo Owner"
const OFFICE_NAME = "Demo Account"

async function main() {
  const db = await connectDB()
  const auth = createAuth(db)

  const existingProfile = await getUserProfileByEmail(DEMO_EMAIL)
  if (existingProfile?._id) {
    console.error(`Aborting: user_profile already exists for ${DEMO_EMAIL}`)
    process.exit(1)
  }

  const existingAuthUser = await getAuthUserByEmail(DEMO_EMAIL)
  if (existingAuthUser?._id) {
    console.error(`Aborting: better-auth user already exists for ${DEMO_EMAIL}`)
    process.exit(1)
  }

  console.log(`Creating office "${OFFICE_NAME}"...`)
  const office = await createOffice({ name: OFFICE_NAME })
  console.log(`  office._id = ${office._id}`)

  console.log(`Creating auth user ${DEMO_EMAIL}...`)
  await auth.api.signUpEmail({
    body: {
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    },
  })

  const authUser = await getDB().collection("user").findOne({ email: DEMO_EMAIL })
  if (!authUser?._id) {
    throw new Error("Auth user was not created")
  }
  console.log(`  authUser._id = ${authUser._id}`)

  console.log("Creating user_profile as owner...")
  const profile = await createUserProfile({
    name: DEMO_NAME,
    email: DEMO_EMAIL,
    officeId: String(office._id),
    role: "owner",
    status: "active",
    authUserId: String(authUser._id),
  })
  console.log(`  profile._id = ${profile._id}`)

  console.log("\nDone.")
  console.log("--------------------------------------------")
  console.log(`Email:    ${DEMO_EMAIL}`)
  console.log(`Password: ${DEMO_PASSWORD}`)
  console.log(`Office:   ${OFFICE_NAME} (${office._id})`)
  console.log("--------------------------------------------")
}

main()
  .catch((err) => {
    console.error("Failed:", err?.message || err)
    process.exit(1)
  })
  .finally(async () => {
    await closeDB().catch(() => null)
  })
