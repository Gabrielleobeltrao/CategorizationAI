import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return ""
  return process.argv[index + 1] || ""
}

function parseBoolFlag(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase()
  if (value === "true" || value === "1" || value === "yes" || value === "on") return true
  if (value === "false" || value === "0" || value === "no" || value === "off") return false
  return null
}

function isStrictObjectId(value) {
  if (!ObjectId.isValid(value)) return false
  return new ObjectId(value).toString() === value
}

const officeIdArg = getArg("--officeId").trim()
const crmArg = getArg("--crm")

if (!officeIdArg || crmArg === "") {
  console.error("Usage: node scripts/setOfficeFeatures.js --officeId <officeId> --crm <true|false>")
  process.exit(1)
}

if (!isStrictObjectId(officeIdArg)) {
  console.error("Invalid officeId ObjectId")
  process.exit(1)
}

const crmValue = parseBoolFlag(crmArg)
if (crmValue === null) {
  console.error("--crm must be true or false")
  process.exit(1)
}

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME

if (!uri || !dbName) {
  console.error("Missing MONGODB_URI or MONGODB_DB_NAME in backend/.env")
  process.exit(1)
}

const client = new MongoClient(uri)

try {
  await client.connect()
  const db = client.db(dbName)

  const result = await db.collection("offices").findOneAndUpdate(
    { _id: new ObjectId(officeIdArg) },
    { $set: { "features.crm": crmValue, updatedAt: new Date() } },
    { returnDocument: "after" }
  )

  const office = result?.value || result
  if (!office?._id) {
    console.error(`Office ${officeIdArg} not found`)
    process.exit(1)
  }

  console.log(`Office ${officeIdArg} features:`, office.features || { crm: crmValue })
} catch (error) {
  console.error("Failed to set office features:", error?.message || error)
  process.exit(1)
} finally {
  await client.close()
}
