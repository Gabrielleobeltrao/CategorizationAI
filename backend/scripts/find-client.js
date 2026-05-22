import "dotenv/config"
import { MongoClient } from "mongodb"
const c = new MongoClient(process.env.MONGODB_URI)
await c.connect()
const db = c.db(process.env.MONGODB_DB_NAME)
const clients = await db.collection("clients").find({}, { projection: { name: 1 } }).toArray()
for (const cl of clients) {
  const coa = await db.collection("coa_accounts").countDocuments({ clientId: String(cl._id) })
  const je = await db.collection("journal_entries").countDocuments({ clientId: String(cl._id) })
  console.log(`${cl._id}  ${cl.name}  | coa_accounts=${coa}  je=${je}`)
}
await c.close()
