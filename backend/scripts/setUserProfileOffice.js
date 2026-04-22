import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return ""
  return process.argv[index + 1] || ""
}

function isStrictObjectId(value) {
  if (!ObjectId.isValid(value)) return false
  return new ObjectId(value).toString() === value
}

const emailArg = getArg("--email").trim().toLowerCase()
const officeIdArg = getArg("--officeId").trim()
const roleArg = (getArg("--role").trim().toLowerCase() || "staff")
const statusArg = (getArg("--status").trim().toLowerCase() || "active")
const nameArg = getArg("--name").trim()

if (!emailArg || !officeIdArg) {
  console.error("Usage: node scripts/setUserProfileOffice.js --email <email> --officeId <officeId> [--role owner|manager|staff|viewer] [--status active|inactive] [--name \"User Name\"]")
  process.exit(1)
}

if (!isStrictObjectId(officeIdArg)) {
  console.error("Invalid officeId ObjectId")
  process.exit(1)
}

if (statusArg !== "active" && statusArg !== "inactive") {
  console.error("Invalid status. Use active or inactive")
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

  const office = await db.collection("offices").findOne({
    _id: new ObjectId(officeIdArg),
  })

  if (!office) {
    console.error(`Office not found for id: ${officeIdArg}`)
    process.exit(1)
  }

  const now = new Date()
  const fallbackName = emailArg.split("@")[0]
  const safeName = nameArg || fallbackName

  const result = await db.collection("user_profile").findOneAndUpdate(
    { email: emailArg },
    {
      $set: {
        officeId: officeIdArg,
        role: roleArg,
        status: statusArg,
        name: safeName,
        updatedAt: now,
      },
      $setOnInsert: {
        email: emailArg,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  )

  console.log("Profile linked to office successfully")
  console.log({
    profileId: result?._id,
    email: result?.email,
    officeId: result?.officeId,
    role: result?.role,
    status: result?.status,
    name: result?.name,
  })
} catch (error) {
  console.error("Failed to link profile to office")
  console.error(error.message)
  process.exit(1)
} finally {
  await client.close()
}
