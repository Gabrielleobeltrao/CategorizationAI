/* eslint-disable no-console */
// Seeds a basic set of categories on the single client owned by the
// office of a given user (identified by email). Uses the LEGACY
// `categories` collection format because this script targets the
// production database which still runs the pre-migration schema.
//
// Usage:
//   MONGODB_URI=... MONGODB_DB_NAME=... \
//     node scripts/seedCategoriesByEmail.js --email=woox13@gmail.com [--dry-run]

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const CATEGORIES = [
  // Income
  { name: "Service Revenue", type: "income", description: "Payments received from clients for services rendered. Stripe payouts, client checks, ACH deposits." },
  { name: "Product Sales", type: "income", description: "Revenue from selling physical or digital products. Shopify, Amazon, Etsy payouts." },

  // Cost of Goods Sold
  { name: "Materials & Supplies", type: "cost_of_goods_sold", description: "Raw materials, supplies, inventory directly tied to delivering the product or service. Home Depot, suppliers." },

  // Operating Expenses
  { name: "Software & Subscriptions", type: "operating_expense", description: "SaaS tools and cloud services. AWS, Google Workspace, Slack, Notion, Figma, GitHub, Adobe." },
  { name: "Advertising & Marketing", type: "operating_expense", description: "Paid ads: Google Ads, Facebook Ads, LinkedIn Ads, TikTok, sponsored content." },
  { name: "Office Rent", type: "operating_expense", description: "Monthly office or co-working lease. WeWork, Regus, landlord rent." },
  { name: "Utilities", type: "operating_expense", description: "Electricity, water, internet, phone. Comcast, Verizon, AT&T, ConEd." },
  { name: "Meals & Entertainment", type: "operating_expense", description: "Business meals with clients or team. Uber Eats, DoorDash, Starbucks, restaurants." },
  { name: "Travel", type: "operating_expense", description: "Business travel: airlines, hotels, rideshare. United, Delta, Marriott, Uber, Lyft." },
  { name: "Fuel & Vehicle", type: "operating_expense", description: "Gas, vehicle maintenance, parking, tolls. Shell, BP, Exxon, EZ-Pass." },
  { name: "Payroll & Wages", type: "operating_expense", description: "Employee salaries, wages, payroll taxes. Gusto, ADP, Rippling." },
  { name: "Office Supplies", type: "operating_expense", description: "Pens, paper, printer ink, desk supplies. Staples, Office Depot." },
  { name: "Insurance", type: "operating_expense", description: "Business insurance: general liability, professional, cyber, property." },
  { name: "Professional Services", type: "operating_expense", description: "Legal, accounting, consulting. Lawyers, CPAs, bookkeepers." },
]

function parseArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split("=").slice(1).join("=") : null
}

async function main() {
  const email = parseArg("email")
  const isDryRun = process.argv.includes("--dry-run")

  if (!email) {
    console.error("Usage: node scripts/seedCategoriesByEmail.js --email=<email> [--dry-run]")
    process.exit(1)
  }
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME) {
    console.error("Set MONGODB_URI and MONGODB_DB_NAME (production credentials)")
    process.exit(1)
  }

  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  console.log(`Connected to ${process.env.MONGODB_DB_NAME} (dry-run: ${isDryRun})`)

  const profile = await db.collection("user_profile").findOne({ email: email.toLowerCase() })
  if (!profile) {
    console.error(`No user_profile found for email "${email}"`)
    process.exit(1)
  }
  console.log(`user_profile: ${profile._id}  officeId=${profile.officeId}`)

  const clients = await db
    .collection("clients")
    .find({ officeId: String(profile.officeId) })
    .toArray()
  if (clients.length === 0) {
    console.error(`No clients in office ${profile.officeId}`)
    process.exit(1)
  }
  if (clients.length > 1) {
    console.warn(
      `Office has ${clients.length} clients — picking the first one:\n` +
        clients.map((c) => `  ${c._id}  ${c.name}`).join("\n"),
    )
  }
  const targetClient = clients[0]
  console.log(`Target client: ${targetClient._id}  "${targetClient.name}"\n`)

  const targetClientId = String(targetClient._id)
  let inserted = 0
  let skipped = 0

  for (const def of CATEGORIES) {
    const existing = await db.collection("categories").findOne({
      clientId: targetClientId,
      name: def.name,
    })
    if (existing) {
      skipped += 1
      continue
    }

    const doc = {
      _id: new ObjectId(),
      clientId: targetClientId,
      name: def.name,
      type: def.type,
      description: def.description,
      tagIds: [],
      templateCategoryId: null,
      isTemplateSynced: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    if (!isDryRun) {
      await db.collection("categories").insertOne(doc)
    }
    inserted += 1
    console.log(`  + ${def.type.padEnd(22)} | ${def.name}`)
  }

  console.log(`\nDone. inserted=${inserted}, skipped=${skipped}${isDryRun ? " (dry run — nothing written)" : ""}`)
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
