// Auto-generated tasks driven by operational signals.
//
// Idea: instead of showing the user an abstract status ("Categorizing"),
// surface concrete tasks ("Categorize 23 transactions for Aurora") in the
// regular Tasks UI. The signal service computes the set of tasks that
// *should* exist for a client given its current data, and reconciles
// against the existing tasks collection:
//
//   - Missing → create as `open`
//   - Existing and still relevant → update title / description in place
//   - Existing but no longer relevant → auto-close (status = done with a
//     statusHistory entry tagged `signal-resolved`)
//   - Existing AND already user-marked `done` → leave alone (don't
//     resurrect tasks the user has dismissed)
//
// All auto-generated tasks carry `source: "operational-signal"` and a
// `signalKey` in the form `{clientId}:{type}` so the upsert is idempotent.

import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import { getClientYearOperationalSignals } from "../repositories/transactions.repository.js"

const SOURCE = "operational-signal"
const TASKS_COLLECTION = "tasks"

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function getCurrentYear() {
    return new Date().getUTCFullYear()
}

// Given a client document + raw signals, returns the list of tasks that
// SHOULD exist for that client right now. Pure function — no DB writes.
function buildExpectedTasks({ client, signals, year }) {
    const expected = []
    const clientName = String(client?.name || "Client").trim() || "Client"

    if (!signals) return expected

    const { totalCount, monthsInYear, uncategorizedInYear } = signals

    // Signal 1: no transactions imported yet.
    if (totalCount === 0) {
        expected.push({
            signalKey: "import-initial",
            title: `Import initial transactions for ${clientName}`,
            description: `${clientName} has no transactions imported yet for ${year}. Upload a CSV or connect the bank to get started.`,
            priority: "high",
        })
        return expected
    }

    // Signal 2: months missing in the current year → waiting documents.
    if (monthsInYear && monthsInYear.length > 0 && monthsInYear.length < 12) {
        const present = new Set(monthsInYear.map((m) => String(m).padStart(2, "0")))
        const missing = []
        for (let i = 1; i <= 12; i += 1) {
            const m = String(i).padStart(2, "0")
            if (!present.has(m)) missing.push(MONTH_NAMES[i - 1])
        }
        // Only flag months up to the current month (no point chasing
        // December docs in March).
        const currentMonth = new Date().getUTCMonth() + 1 // 1..12
        const stillMeaningful = missing.filter((label) => {
            const idx = MONTH_NAMES.indexOf(label) + 1
            return idx <= currentMonth
        })
        if (stillMeaningful.length > 0) {
            const monthList = stillMeaningful.join(", ")
            expected.push({
                signalKey: "request-missing-months",
                title: `Request ${stillMeaningful.length === 1 ? stillMeaningful[0] : `${stillMeaningful.length} months`} of statements from ${clientName}`,
                description: `${clientName} is missing transaction data for ${monthList} ${year}. Reach out to the client to request the bank statements.`,
                priority: "high",
            })
        }
    }

    // Signal 3: uncategorized transactions in the current year.
    if (uncategorizedInYear > 0) {
        const count = Number(uncategorizedInYear)
        expected.push({
            signalKey: "categorize-pending",
            title: `Categorize ${count} transaction${count === 1 ? "" : "s"} for ${clientName}`,
            description: `${clientName} has ${count} uncategorized transaction${count === 1 ? "" : "s"} for ${year}. Run the AI categorizer or assign categories manually.`,
            priority: count > 50 ? "high" : "medium",
        })
    }

    return expected
}

function nowIso() {
    return new Date()
}

async function readExistingSignalTasks(officeId, clientId) {
    const db = getDB()
    return db.collection(TASKS_COLLECTION)
        .find({
            officeId: String(officeId),
            clientId: String(clientId),
            source: SOURCE,
        })
        .toArray()
}

async function createSignalTask({ officeId, clientId, expected }) {
    const db = getDB()
    const now = nowIso()
    const doc = {
        officeId: String(officeId),
        clientIds: [String(clientId)],
        assigneeIds: [],
        clientId: String(clientId),
        assigneeId: null,
        dueDate: null,
        title: expected.title,
        description: expected.description,
        status: "open",
        priority: expected.priority || "medium",
        doneAt: null,
        statusHistory: [{ status: "open", at: now, by: "system:signal" }],
        comments: [],
        collectionId: null,
        createdBy: "system:signal",
        source: SOURCE,
        signalKey: `${clientId}:${expected.signalKey}`,
        signalUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
    }
    await db.collection(TASKS_COLLECTION).insertOne(doc)
}

async function updateSignalTaskInPlace(taskId, expected) {
    const db = getDB()
    const now = nowIso()
    await db.collection(TASKS_COLLECTION).updateOne(
        { _id: new ObjectId(taskId) },
        {
            $set: {
                title: expected.title,
                description: expected.description,
                priority: expected.priority || "medium",
                signalUpdatedAt: now,
                updatedAt: now,
            },
        },
    )
}

async function autoCloseSignalTask(taskId) {
    const db = getDB()
    const now = nowIso()
    await db.collection(TASKS_COLLECTION).updateOne(
        { _id: new ObjectId(taskId) },
        {
            $set: {
                status: "done",
                doneAt: now,
                signalResolvedAt: now,
                updatedAt: now,
            },
            $push: {
                statusHistory: { status: "done", at: now, by: "system:signal-resolved" },
            },
        },
    )
}

// Public: reconcile auto-tasks for a single client. Best-effort — errors
// are caught and logged so this never blocks the status recompute path.
export async function reconcileAutoTasksForClient(client) {
    if (!client?._id || !client?.officeId) return { created: 0, updated: 0, closed: 0 }
    try {
        const year = getCurrentYear()
        const signals = await getClientYearOperationalSignals(String(client._id), year)
        const expected = buildExpectedTasks({ client, signals, year })
        const existing = await readExistingSignalTasks(client.officeId, client._id)

        // Key by signalKey suffix (after the `clientId:` prefix) so the
        // diff is symmetric between expected and stored.
        const expectedByKey = new Map(expected.map((e) => [e.signalKey, e]))
        const existingByKey = new Map()
        for (const task of existing) {
            const key = String(task?.signalKey || "").split(":").slice(1).join(":")
            if (key) existingByKey.set(key, task)
        }

        let created = 0
        let updated = 0
        let closed = 0

        // Create or update
        for (const [key, expectedItem] of expectedByKey) {
            const existingTask = existingByKey.get(key)
            if (!existingTask) {
                await createSignalTask({
                    officeId: client.officeId,
                    clientId: client._id,
                    expected: expectedItem,
                })
                created += 1
                continue
            }
            // Already done by the user — don't resurrect.
            if (String(existingTask.status || "") === "done") continue
            await updateSignalTaskInPlace(existingTask._id, expectedItem)
            updated += 1
        }

        // Auto-close anything stored but no longer expected
        for (const [key, task] of existingByKey) {
            if (expectedByKey.has(key)) continue
            if (String(task.status || "") === "done") continue
            await autoCloseSignalTask(task._id)
            closed += 1
        }

        return { created, updated, closed }
    } catch (err) {
        console.warn(`[worklistAutoTasks] reconcile failed for client ${client?._id}: ${err?.message || err}`)
        return { created: 0, updated: 0, closed: 0, error: String(err?.message || err) }
    }
}
