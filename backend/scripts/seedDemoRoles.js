// Seeds 3 custom roles on the demo office + assigns existing coworkers
// (Maria / João / Ana) to specific roles so the Employees page + Roles
// page show variety beyond the default "manager / staff / viewer" set.
//
// Idempotent: roles are upserted by `key`. Profile assignments are only
// applied if the existing role is one of the defaults.

import "dotenv/config"
import { MongoClient } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"

// Custom roles in addition to the base owner/manager/staff/viewer.
// Permissions mirror the PERMISSION_DEFINITIONS taxonomy in
// backend/src/config/roles.js — use wildcards (`tasks:*`) where the role
// covers a whole module.
const CUSTOM_ROLES = [
  {
    key: "controller",
    label: "Controller",
    description: "Bookkeeping operations + closing rights, no team management.",
    permissions: [
      "offices:read",
      "clients:read",
      "clients:create",
      "clients:update",
      "clientsOwnerInfo:read",
      "clientsOwnerInfo:update",
      "clientsNotes:create",
      "accounts:*",
      "transactions:*",
      "profitLoss:read",
      "userProfiles:read",
      "roles:read",
      "tasks:*",
      "board:*",
      "chat:read",
      "chat:send",
      "overview:*",
      "activityLog:read",
    ],
  },
  {
    key: "client_specialist",
    label: "Client Specialist",
    description: "Owns categorization and day-to-day client comms. No accounts setup.",
    permissions: [
      "offices:read",
      "clients:read",
      "clients:update",
      "clientsOwnerInfo:read",
      "clientsOwnerInfo:update",
      "clientsNotes:create",
      "accounts:read",
      "transactions:read",
      "transactions:update",
      "profitLoss:read",
      "userProfiles:read",
      "roles:read",
      "tasks:*",
      "board:read",
      "chat:read",
      "chat:send",
      "overview:readOwn",
    ],
  },
  {
    key: "reviewer",
    label: "Reviewer (read-only)",
    description: "Read-only across bookkeeping + reports. Cannot edit anything.",
    permissions: [
      "offices:read",
      "clients:read",
      "clientsOwnerInfo:read",
      "accounts:read",
      "transactions:read",
      "profitLoss:read",
      "userProfiles:read",
      "roles:read",
      "tasks:read",
      "board:read",
      "chat:read",
      "overview:readOwn",
    ],
  },
]

const ROLE_ASSIGNMENTS = [
  { match: /maria/i, role: "controller" },
  { match: /joao|joão/i, role: "client_specialist" },
  { match: /ana/i, role: "reviewer" },
]

async function upsertRole(db, officeId, ownerProfileId, def) {
  const now = new Date()
  const result = await db.collection("custom_roles").findOneAndUpdate(
    { officeId, key: def.key },
    {
      $set: {
        officeId,
        key: def.key,
        label: def.label,
        description: def.description,
        permissions: def.permissions,
        isSystem: false,
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdBy: String(ownerProfileId),
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  )
  return result?.value || result
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

  const ownerProfile = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
  if (!ownerProfile?.officeId) {
    console.error(`No user_profile for ${DEMO_EMAIL}. Run createDemoAccount.js first.`)
    process.exit(1)
  }
  const officeId = String(ownerProfile.officeId)
  console.log(`Demo office: ${officeId}`)

  console.log("\n=== Custom roles ===")
  for (const def of CUSTOM_ROLES) {
    await upsertRole(db, officeId, ownerProfile._id, def)
    console.log(`  + ${def.label} (${def.key}) — ${def.permissions.length} permissions`)
  }

  console.log("\n=== Role assignments ===")
  const profiles = await db.collection("user_profile").find({ officeId }).toArray()
  for (const a of ROLE_ASSIGNMENTS) {
    const target = profiles.find((p) => a.match.test(String(p.email || "") + " " + String(p.name || "")))
    if (!target) {
      console.log(`  ~ ${a.role}: no matching profile (skipped)`)
      continue
    }
    // Only override when the current role is one of the defaults so we
    // don't stomp on intentional manual assignments.
    const currentRole = String(target.role || "")
    const isDefaultRole = ["manager", "staff", "viewer"].includes(currentRole)
    if (!isDefaultRole) {
      console.log(`  ~ ${target.name || target.email}: already has custom role "${currentRole}" (kept)`)
      continue
    }
    await db.collection("user_profile").updateOne(
      { _id: target._id },
      { $set: { role: a.role, updatedAt: new Date() } },
    )
    console.log(`  + ${target.name || target.email}: ${currentRole} → ${a.role}`)
  }

  console.log("\nDone.")
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
