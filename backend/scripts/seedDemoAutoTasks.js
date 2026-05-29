// Runs the auto-task reconciler for every client on the demo office so
// the worklist (= regular Tasks list + a small "Auto" chip) is populated
// without having to wait for the next transaction mutation.

import "dotenv/config"
import { connectDB, closeDB } from "../src/db.js"
import { getDB } from "../src/db.js"
import { reconcileAutoTasksForClient } from "../src/services/worklistAutoTasks.service.js"

const DEMO_EMAIL = "demo@categorizationai.com"

async function main() {
    await connectDB()
    const db = getDB()
    console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

    const ownerProfile = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
    if (!ownerProfile?.officeId) {
        console.error(`No user_profile for ${DEMO_EMAIL}.`)
        process.exit(1)
    }
    const officeId = String(ownerProfile.officeId)
    console.log(`Demo office: ${officeId}`)

    const clients = await db.collection("clients").find({ officeId }).toArray()
    console.log(`Reconciling ${clients.length} clients...\n`)

    let totalCreated = 0
    let totalUpdated = 0
    let totalClosed = 0

    for (const client of clients) {
        const result = await reconcileAutoTasksForClient(client)
        console.log(
            `  ${client.name}: +${result.created} created · ${result.updated} updated · ${result.closed} closed`,
        )
        totalCreated += result.created
        totalUpdated += result.updated
        totalClosed += result.closed
    }

    console.log(`\nTotals: +${totalCreated} created · ${totalUpdated} updated · ${totalClosed} closed`)
    await closeDB()
}

main().catch(async (err) => {
    console.error("FAILED:", err?.message || err)
    await closeDB().catch(() => null)
    process.exit(1)
})
