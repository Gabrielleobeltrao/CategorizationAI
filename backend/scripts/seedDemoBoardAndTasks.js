// Adds a richer board + more tasks to the Demo Account office:
//   - creates 4 board columns (Backlog / This Week / In Review / Done Archive)
//   - generates ~50 tasks spread across the last 60 days
//   - mixes statuses, priorities, assignees, clients, and columns
//   - varies createdAt and doneAt so the CRM dashboard charts populate
//
// Idempotent on board columns (by name). Tasks are de-duped by title +
// clientId, so re-running adds nothing new.

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"

const COLUMNS = [
  { name: "Backlog" },
  { name: "This Week" },
  { name: "In Review" },
  { name: "Done Archive" },
]

const TASK_TEMPLATES = [
  { title: "Reconcile April bank statement", priority: "high", weight: { open: 0.2, in_progress: 0.5, done: 0.3 } },
  { title: "Categorize uncleared transactions", priority: "high", weight: { open: 0.3, in_progress: 0.4, done: 0.3 } },
  { title: "Send Q1 P&L to client", priority: "medium", weight: { open: 0.2, in_progress: 0.3, done: 0.5 } },
  { title: "Collect missing receipts", priority: "medium", weight: { open: 0.5, in_progress: 0.3, done: 0.2 } },
  { title: "Reconcile Amex statement", priority: "high", weight: { open: 0.1, in_progress: 0.3, done: 0.6 } },
  { title: "1099 vendor list confirmation", priority: "low", weight: { open: 0.4, in_progress: 0.3, done: 0.3 } },
  { title: "Close out previous month", priority: "high", weight: { open: 0.1, in_progress: 0.2, done: 0.7 } },
  { title: "Review payroll register", priority: "medium", weight: { open: 0.2, in_progress: 0.4, done: 0.4 } },
  { title: "Match Stripe payouts", priority: "medium", weight: { open: 0.3, in_progress: 0.4, done: 0.3 } },
  { title: "Set up new Chart of Accounts", priority: "low", weight: { open: 0.6, in_progress: 0.2, done: 0.2 } },
  { title: "Send year-end tax package", priority: "high", weight: { open: 0.3, in_progress: 0.4, done: 0.3 } },
  { title: "Request bank statements", priority: "medium", weight: { open: 0.4, in_progress: 0.3, done: 0.3 } },
  { title: "Verify owner draws", priority: "low", weight: { open: 0.5, in_progress: 0.3, done: 0.2 } },
  { title: "Update vendor W-9 forms", priority: "low", weight: { open: 0.5, in_progress: 0.2, done: 0.3 } },
  { title: "Process expense reimbursements", priority: "medium", weight: { open: 0.3, in_progress: 0.4, done: 0.3 } },
  { title: "Reclassify miscategorized rows", priority: "medium", weight: { open: 0.4, in_progress: 0.3, done: 0.3 } },
  { title: "Generate trial balance", priority: "low", weight: { open: 0.3, in_progress: 0.3, done: 0.4 } },
  { title: "Reach out about missing invoices", priority: "medium", weight: { open: 0.5, in_progress: 0.3, done: 0.2 } },
  { title: "Run sales tax report", priority: "medium", weight: { open: 0.3, in_progress: 0.4, done: 0.3 } },
  { title: "Prep client review meeting", priority: "high", weight: { open: 0.4, in_progress: 0.4, done: 0.2 } },
]

function pickWeighted(weights) {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[entries.length - 1][0]
}

function randomDateInRange(daysBack, untilDaysAgo = 0) {
  // Returns a Date that is between `untilDaysAgo` and `daysBack` ago.
  const now = Date.now()
  const minAgo = untilDaysAgo * 86400000
  const maxAgo = daysBack * 86400000
  const offset = minAgo + Math.random() * (maxAgo - minAgo)
  return new Date(now - offset)
}

async function ensureColumn(db, officeId, name, position, createdBy) {
  const existing = await db.collection("board_collections").findOne({ officeId, name })
  if (existing) return existing
  const doc = {
    officeId,
    name,
    position,
    createdBy: String(createdBy || ""),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const result = await db.collection("board_collections").insertOne(doc)
  return { ...doc, _id: result.insertedId }
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

  // Collect assignees: owner + every co-worker profile in this office.
  const coworkers = await db.collection("user_profile").find({ officeId }).toArray()
  const assigneeIds = coworkers.map((p) => String(p._id))
  console.log(`Assignees in office: ${assigneeIds.length}`)

  // Collect clients in this office.
  const clients = await db.collection("clients").find({ officeId }).toArray()
  if (clients.length === 0) {
    console.error("No clients in this office. Run seedDemoAccountData.js first.")
    process.exit(1)
  }
  const clientIds = clients.map((c) => String(c._id))
  console.log(`Clients in office: ${clientIds.length}`)

  // 1) Board columns
  const columns = []
  for (let i = 0; i < COLUMNS.length; i += 1) {
    const col = await ensureColumn(db, officeId, COLUMNS[i].name, i + 1, ownerProfile._id)
    columns.push(col)
  }
  console.log(`Board columns: ${columns.map((c) => c.name).join(", ")}`)

  // 2) Tasks — 50 spread out, varied statuses/priorities/dates
  const TARGET_COUNT = 50
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < TARGET_COUNT; i += 1) {
    const template = TASK_TEMPLATES[i % TASK_TEMPLATES.length]
    const status = pickWeighted(template.weight)

    // Pick a primary client (some tasks office-wide → no client)
    const useClient = Math.random() < 0.85
    const primaryClient = useClient ? clientIds[Math.floor(Math.random() * clientIds.length)] : null

    // Pick 1–2 assignees
    const primaryAssignee = assigneeIds[Math.floor(Math.random() * assigneeIds.length)]

    // Dedupe by (title + clientId)
    const dedupeKey = { officeId, title: template.title, clientId: primaryClient }
    const exists = await db.collection("tasks").findOne(dedupeKey)
    if (exists) {
      skipped += 1
      continue
    }

    // Pick a column — done tasks tend toward "Done Archive"; others spread
    let column
    if (status === "done" && Math.random() < 0.6) {
      column = columns.find((c) => c.name === "Done Archive")
    } else if (status === "in_progress" && Math.random() < 0.5) {
      column = columns.find((c) => c.name === "In Review") || columns.find((c) => c.name === "This Week")
    } else {
      column = columns[Math.floor(Math.random() * (columns.length - 1))] // not Done Archive
    }

    // Dates — createdAt anywhere in the last 60 days, doneAt later if done
    const createdAt = randomDateInRange(60, 1)
    let doneAt = null
    let statusHistory = [{ status: "open", at: createdAt, by: primaryAssignee }]
    if (status === "in_progress") {
      const inProgAt = new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime()))
      statusHistory.push({ status: "in_progress", at: inProgAt, by: primaryAssignee })
    } else if (status === "done") {
      const inProgAt = new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime()) * 0.6)
      const doneAtCandidate = new Date(inProgAt.getTime() + Math.random() * (Date.now() - inProgAt.getTime()))
      doneAt = doneAtCandidate
      statusHistory.push({ status: "in_progress", at: inProgAt, by: primaryAssignee })
      statusHistory.push({ status: "done", at: doneAtCandidate, by: primaryAssignee })
    }

    // Due date — open tasks tend to have future due dates; done tasks past.
    const dueOffsetDays = status === "done"
      ? -1 * Math.floor(Math.random() * 30)
      : Math.floor(Math.random() * 21) - 5
    const dueDate = new Date()
    dueDate.setUTCDate(dueDate.getUTCDate() + dueOffsetDays)

    const doc = {
      officeId,
      clientIds: primaryClient ? [primaryClient] : [],
      assigneeIds: [primaryAssignee],
      clientId: primaryClient,
      assigneeId: primaryAssignee,
      dueDate: dueDate.toISOString().slice(0, 10),
      title: template.title,
      description: "",
      status,
      priority: template.priority,
      doneAt,
      statusHistory,
      comments: [],
      collectionId: String(column._id),
      createdBy: String(ownerProfile._id),
      createdAt,
      updatedAt: doneAt || statusHistory[statusHistory.length - 1].at,
    }

    await db.collection("tasks").insertOne(doc)
    inserted += 1
  }

  console.log(`\nDone. inserted=${inserted}, skipped=${skipped} (already existed)`)
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
