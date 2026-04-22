import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME
const clientId = String(process.env.CLIENT_ID || "").trim()
const limit = Math.max(1, Number(process.env.LIMIT || 6))

if (!uri) throw new Error("MONGODB_URI is not defined in .env")
if (!dbName) throw new Error("MONGODB_DB_NAME is not defined in .env")

const mongoClient = new MongoClient(uri)

try {
  await mongoClient.connect()
  const db = mongoClient.db(dbName)
  const collection = db.collection("transactions")

  const filter = {
    $and: [
      clientId ? { clientId } : {},
      {
        $or: [
          { llmProcessed: false },
          { llmProcessed: { $exists: false } },
          { llmStatus: "not_processed" },
          { llmStatus: { $exists: false } },
        ],
      },
    ],
  }

  const rows = await collection
    .find(filter, { projection: { _id: 1 } })
    .sort({ date: -1, _id: -1 })
    .limit(limit)
    .toArray()

  if (rows.length === 0) {
    console.log("No transactions found to mark as LLM processed")
    process.exit(0)
  }

  const statuses = ["suggested", "empty", "error"]
  const operations = rows.map((row, index) => ({
    updateOne: {
      filter: { _id: new ObjectId(row._id) },
      update: {
        $set: {
          llmProcessed: true,
          llmStatus: statuses[index % statuses.length],
          llmProcessedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    },
  }))

  const result = await collection.bulkWrite(operations, { ordered: false })

  console.log(`Marked ${result.modifiedCount} transaction(s) as LLM processed`)
} finally {
  await mongoClient.close()
}
