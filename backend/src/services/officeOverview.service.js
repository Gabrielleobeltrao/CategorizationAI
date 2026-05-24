import { AppError } from "../utils/appError.js"
import { getDB } from "../db.js"
import { countUnreconciled } from "./clientHome.service.js"
import { listClientIdsTouchedByActor } from "../repositories/activityLog.repository.js"

const TOP_LIMIT = 8

function pickClientName(clientsById, clientId) {
  const client = clientsById.get(String(clientId))
  return client?.name || ""
}

export async function getOfficeOverviewService({ officeId, actorId } = {}) {
  if (!officeId) throw new AppError("officeId is required", 400)
  const db = getDB()

  const clients = await db
    .collection("clients")
    .find({ officeId: String(officeId) })
    .project({ name: 1 })
    .toArray()

  const clientIds = clients.map((c) => String(c._id))
  const clientsById = new Map(clients.map((c) => [String(c._id), c]))

  // Suspense accounts (one per client). We don't auto-create here — a client
  // with no journal activity may not have one yet, and that's fine.
  const suspenseAccounts = clientIds.length
    ? await db
        .collection("coa_accounts")
        .find({ clientId: { $in: clientIds }, isSuspense: true })
        .project({ clientId: 1 })
        .toArray()
    : []
  const suspenseIds = suspenseAccounts.map((a) => String(a._id))

  // Pending categorization — group journal_entries with a suspense leg by
  // client. One aggregation across the office.
  const uncategorizedAgg = suspenseIds.length
    ? await db
        .collection("journal_entries")
        .aggregate([
          {
            $match: {
              clientId: { $in: clientIds },
              "legs.accountId": { $in: suspenseIds },
            },
          },
          {
            $group: {
              _id: "$clientId",
              count: { $sum: 1 },
              oldestDate: { $min: "$date" },
            },
          },
        ])
        .toArray()
    : []
  const uncategorizedByClient = new Map(uncategorizedAgg.map((x) => [String(x._id), x]))

  // Tasks — count open + in_progress per office.
  const openTasksCount = await db
    .collection("tasks")
    .countDocuments({
      officeId: String(officeId),
      status: { $in: ["open", "in_progress"] },
    })

  // Reconciliation health — iterate clients (algorithm walks the legs of each
  // journal entry; can't easily group). Acceptable for tens of clients.
  const reconciliationResults = await Promise.all(
    clientIds.map(async (cid) => {
      try {
        const r = await countUnreconciled(cid)
        return { clientId: cid, ...r }
      } catch {
        return { clientId: cid, accountsWithUncleared: 0, totalUnclearedLegs: 0 }
      }
    })
  )

  const totalUncategorized = uncategorizedAgg.reduce((acc, x) => acc + (x.count || 0), 0)
  const totalUnclearedLegs = reconciliationResults.reduce(
    (acc, r) => acc + (r.totalUnclearedLegs || 0),
    0
  )
  const totalReconcAccounts = reconciliationResults.reduce(
    (acc, r) => acc + (r.accountsWithUncleared || 0),
    0
  )

  const pendingCategorizationAll = uncategorizedAgg
    .map((x) => ({
      clientId: String(x._id),
      clientName: pickClientName(clientsById, x._id),
      count: x.count || 0,
      oldestDate: x.oldestDate || null,
    }))
    .sort((a, b) => b.count - a.count)

  const reconciliationHealthAll = reconciliationResults
    .filter((r) => r.totalUnclearedLegs > 0)
    .map((r) => ({
      clientId: String(r.clientId),
      clientName: pickClientName(clientsById, r.clientId),
      unclearedLegs: r.totalUnclearedLegs,
      accountsWithUncleared: r.accountsWithUncleared,
    }))
    .sort((a, b) => b.unclearedLegs - a.unclearedLegs)

  // "Mine" view — clients this actor touched in the last 30 days (from the
  // activity log). Falls back to empty arrays when there's no activity yet.
  const safeActorId = String(actorId || "").trim()
  let myClientIds = []
  if (safeActorId) {
    try {
      myClientIds = await listClientIdsTouchedByActor(safeOfficeId(officeId), safeActorId, {
        limit: 50,
        sinceDays: 30,
      })
    } catch {
      myClientIds = []
    }
  }
  const myClientIdSet = new Set(myClientIds)
  const pendingCategorizationMine = pendingCategorizationAll
    .filter((item) => myClientIdSet.has(item.clientId))
    .slice(0, TOP_LIMIT)
  const reconciliationHealthMine = reconciliationHealthAll
    .filter((item) => myClientIdSet.has(item.clientId))
    .slice(0, TOP_LIMIT)

  return {
    kpis: {
      activeClients: clients.length,
      uncategorizedTotal: totalUncategorized,
      openTasks: openTasksCount,
      unreconciledAccounts: totalReconcAccounts,
      unreconciledLegs: totalUnclearedLegs,
    },
    pendingCategorization: pendingCategorizationAll.slice(0, TOP_LIMIT),
    reconciliationHealth: reconciliationHealthAll.slice(0, TOP_LIMIT),
    pendingCategorizationMine,
    reconciliationHealthMine,
    myRecentClientCount: myClientIds.length,
  }
}

function safeOfficeId(value) {
  return String(value || "").trim()
}
