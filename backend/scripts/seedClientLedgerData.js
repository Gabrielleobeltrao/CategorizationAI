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

async function ensureAccount(collection, clientId, name, type) {
  const existing = await collection.findOne({ clientId, name })
  if (existing) return existing

  const now = new Date()
  const doc = {
    clientId,
    name,
    type,
    createdAt: now,
    updatedAt: now,
  }

  const result = await collection.insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

async function ensureCategory(collection, clientId, name, type, description) {
  const existing = await collection.findOne({ clientId, name })
  if (existing) return existing

  const now = new Date()
  const doc = {
    clientId,
    name,
    type,
    description,
    createdAt: now,
    updatedAt: now,
  }

  const result = await collection.insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

async function ensureTransaction(collection, payload) {
  const existing = await collection.findOne({
    clientId: payload.clientId,
    date: payload.date,
    description: payload.description,
    amount: payload.amount,
  })
  if (existing) return false

  await collection.insertOne(payload)
  return true
}

const defaultClientId = "69c080088634751b58b6bcde"
const clientIdArg = (getArg("--clientId").trim() || defaultClientId)

if (!isStrictObjectId(clientIdArg)) {
  console.error("Invalid clientId ObjectId")
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

  const clientsCollection = db.collection("clients")
  const accountsCollection = db.collection("account")
  const categoriesCollection = db.collection("categories")
  const transactionsCollection = db.collection("transactions")

  const targetClient = await clientsCollection.findOne({
    _id: new ObjectId(clientIdArg),
  })

  if (!targetClient) {
    console.error(`Client not found for id: ${clientIdArg}`)
    process.exit(1)
  }

  const accountsSeed = [
    { key: "checking", name: "Chase Business Checking", type: "checking" },
    { key: "credit", name: "Amex Business Card", type: "credit" },
    { key: "payroll", name: "BofA Payroll", type: "checking" },
    { key: "wallet", name: "PayPal Balance", type: "wallet" },
  ]

  const categoriesSeed = [
    {
      key: "supplies",
      name: "Supplies",
      type: "cost_of_goods_sold",
      description: "Materials and supplies for operations",
    },
    {
      key: "advertising",
      name: "Advertising",
      type: "operating_expenses",
      description: "Ads and promotion expenses",
    },
    {
      key: "software",
      name: "Software",
      type: "operating_expenses",
      description: "SaaS and software subscriptions",
    },
    {
      key: "meals",
      name: "Meals",
      type: "operating_expenses",
      description: "Business meals and entertainment",
    },
    {
      key: "rent",
      name: "Rent",
      type: "operating_expenses",
      description: "Office rent and utilities",
    },
    {
      key: "bank_fees",
      name: "Bank Fees",
      type: "operating_expenses",
      description: "Bank and payment processor fees",
    },
  ]

  const accountsMap = {}
  for (const item of accountsSeed) {
    const accountDoc = await ensureAccount(
      accountsCollection,
      clientIdArg,
      item.name,
      item.type
    )
    accountsMap[item.key] = accountDoc
  }

  const categoriesMap = {}
  for (const item of categoriesSeed) {
    const categoryDoc = await ensureCategory(
      categoriesCollection,
      clientIdArg,
      item.name,
      item.type,
      item.description
    )
    categoriesMap[item.key] = categoryDoc
  }

  const rawTransactions = [
    { date: "2026-03-01", description: "THE HOME DEPOT PURCHASE", amount: 80.4, account: "checking", category: "supplies" },
    { date: "2026-03-03", description: "GOOGLE ADS", amount: 13.5, account: "checking", category: "advertising" },
    { date: "2026-03-05", description: "NOTION SUBSCRIPTION", amount: 24.0, account: "credit", category: "software" },
    { date: "2026-03-07", description: "OFFICE DEPOT", amount: 62.9, account: "credit", category: "supplies" },
    { date: "2026-03-09", description: "TEAM LUNCH", amount: 145.75, account: "checking", category: "meals" },
    { date: "2026-03-11", description: "MONTHLY RENT", amount: 2400.0, account: "checking", category: "rent" },
    { date: "2026-03-13", description: "STRIPE PROCESSING FEES", amount: 88.3, account: "wallet", category: "bank_fees" },
    { date: "2026-03-15", description: "FACEBOOK ADS", amount: 120.0, account: "credit", category: "advertising" },
    { date: "2026-03-18", description: "ADOBE CREATIVE CLOUD", amount: 59.99, account: "credit", category: "software" },
    { date: "2026-03-21", description: "LOWE'S PURCHASE", amount: 210.18, account: "checking", category: "supplies" },
    { date: "2026-03-23", description: "AMAZON BUSINESS", amount: 94.26, account: "credit", category: "supplies" },
    { date: "2026-03-25", description: "CLIENT DINNER", amount: 178.0, account: "checking", category: "meals" },
    { date: "2026-03-27", description: "PAYROLL TAX PAYMENT", amount: 1320.0, account: "payroll", category: "bank_fees" },
    { date: "2026-03-28", description: "BING ADS", amount: 47.8, account: "credit", category: "advertising" },
    { date: "2026-03-30", description: "SLACK SUBSCRIPTION", amount: 32.0, account: "credit", category: "software" },
  ]

  let insertedTransactions = 0
  const now = new Date()

  for (const item of rawTransactions) {
    const accountDoc = accountsMap[item.account]
    const categoryDoc = categoriesMap[item.category]

    const didInsert = await ensureTransaction(transactionsCollection, {
      clientId: clientIdArg,
      accountId: accountDoc?._id ? String(accountDoc._id) : null,
      accountName: accountDoc?.name || null,
      date: item.date,
      description: item.description,
      amount: item.amount,
      categoryId: categoryDoc?._id ? String(categoryDoc._id) : null,
      category: categoryDoc?.name || null,
      createdAt: now,
      updatedAt: now,
    })

    if (didInsert) insertedTransactions += 1
  }

  console.log("Seed finished")
  console.log({
    clientId: clientIdArg,
    accounts: Object.keys(accountsMap).length,
    categories: Object.keys(categoriesMap).length,
    insertedTransactions,
  })
} catch (error) {
  console.error("Failed to seed client ledger data")
  console.error(error.message)
  process.exit(1)
} finally {
  await client.close()
}
