const { MongoClient } = require("mongodb")

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME

if (!uri) throw new Error("MONGODB_URI is not defined in .env")
if (!dbName) throw new Error("MONGODB_DB_NAME is not defined in .env")

let client
let db

async function connectDB() {
  if (db) return db

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(dbName)

  console.log("MongoDB connected")
  return db
}

function getDB() {
  if (!db) throw new Error("Database not connected. Call connectDB() first.")
  return db
}

async function closeDB() {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

module.exports = { connectDB, getDB, closeDB }