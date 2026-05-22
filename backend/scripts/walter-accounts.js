import "dotenv/config"
import { MongoClient } from "mongodb"
const c = new MongoClient(process.env.MONGODB_URI)
await c.connect()
const db = c.db(process.env.MONGODB_DB_NAME)
const accs = await db.collection("coa_accounts").find({ clientId: "69d012289822964a102a3001" }).sort({ accountType: 1, name: 1 }).toArray()
for (const a of accs) console.log(`${a.accountType.padEnd(22)} | ${a.name}`)
await c.close()
