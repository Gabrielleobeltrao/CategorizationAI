import { getDB } from "../db.js"

function pad2(value) {
  return String(value).padStart(2, "0")
}

function toDateKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function parseMonthInput(monthInput) {
  const safe = String(monthInput || "").trim()
  const validPattern = /^\d{4}-\d{2}$/

  if (!validPattern.test(safe)) {
    const now = new Date()
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    }
  }

  const [yearValue, monthValue] = safe.split("-")
  const year = Number(yearValue)
  const month = Number(monthValue)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const now = new Date()
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    }
  }

  return { year, month }
}

function buildMonthRange(monthInput) {
  const parsed = parseMonthInput(monthInput)
  const start = new Date(Date.UTC(parsed.year, parsed.month - 1, 1))
  const monthEnd = new Date(Date.UTC(parsed.year, parsed.month, 0))
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const isCurrentMonth =
    parsed.year === todayUtc.getUTCFullYear() && parsed.month === todayUtc.getUTCMonth() + 1

  const end = isCurrentMonth && todayUtc < monthEnd ? todayUtc : monthEnd
  const label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

  return {
    start,
    end,
    monthEnd,
    startKey: toDateKey(start),
    endKey: toDateKey(end),
    label,
    isCurrentMonth,
  }
}

function buildPreviousRange(currentRange) {
  const previousStart = new Date(
    Date.UTC(currentRange.start.getUTCFullYear(), currentRange.start.getUTCMonth() - 1, 1)
  )
  const previousMonthEnd = new Date(
    Date.UTC(previousStart.getUTCFullYear(), previousStart.getUTCMonth() + 1, 0)
  )

  let previousEnd = previousMonthEnd
  if (currentRange.isCurrentMonth) {
    const elapsedDays =
      Math.floor((currentRange.end.getTime() - currentRange.start.getTime()) / 86400000) + 1
    const alignedEnd = new Date(previousStart)
    alignedEnd.setUTCDate(alignedEnd.getUTCDate() + elapsedDays - 1)
    previousEnd = alignedEnd > previousMonthEnd ? previousMonthEnd : alignedEnd
  }

  return {
    start: previousStart,
    end: previousEnd,
  }
}

function formatSignedPercent(currentValue, previousValue) {
  const current = Number(currentValue || 0)
  const previous = Number(previousValue || 0)

  if (previous <= 0) {
    if (current <= 0) return "0.0%"
    return "+100.0%"
  }

  const diff = ((current - previous) / previous) * 100
  const rounded = Math.round(diff * 10) / 10
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}%`
}

function isCategoryAssigned(categoryId, categoryName) {
  const safeCategoryId = String(categoryId || "").trim()
  if (safeCategoryId) return true

  const safeCategoryName = String(categoryName || "").trim().toLowerCase()
  if (!safeCategoryName) return false

  return (
    safeCategoryName !== "uncategorized" &&
    safeCategoryName !== "uncategorized income" &&
    safeCategoryName !== "uncategorized expenses"
  )
}

function isTransactionCategorized(transaction = {}) {
  if (Array.isArray(transaction.splits) && transaction.splits.length > 1) {
    return transaction.splits.every((split) =>
      isCategoryAssigned(split?.categoryId, split?.category)
    )
  }

  return isCategoryAssigned(transaction.categoryId, transaction.category)
}

function buildWeeklyBuckets(startDate, endDate) {
  const buckets = []
  let cursor = new Date(startDate)
  let index = 1

  while (cursor <= endDate) {
    const bucketStart = new Date(cursor)
    const bucketEnd = new Date(cursor)
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6)

    if (bucketEnd > endDate) {
      bucketEnd.setTime(endDate.getTime())
    }

    buckets.push({
      id: `w_${index}`,
      label: `W${index}`,
      start: bucketStart,
      end: bucketEnd,
      imported: 0,
      categorized: 0,
      pending: 0,
    })

    cursor = new Date(bucketEnd)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    index += 1
  }

  return buckets
}

function parseTransactionDate(dateString) {
  const safe = String(dateString || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return null

  const [yearValue, monthValue, dayValue] = safe.split("-")
  const parsedDate = new Date(
    Date.UTC(Number(yearValue), Number(monthValue) - 1, Number(dayValue))
  )

  if (Number.isNaN(parsedDate.getTime())) return null
  return parsedDate
}

function formatRelativeTime(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return "-"

  const now = Date.now()
  const diffMs = Math.max(0, now - dateValue.getTime())
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function statusToActivityLabel(status) {
  const safe = String(status || "").toLowerCase()
  if (safe === "failed") return "Categorization failed"
  if (safe === "done" || safe === "completed") return "LLM categorization finished"
  if (safe === "running") return "Categorization running"
  if (safe === "queued") return "Categorization queued"
  return "Categorization update"
}

function toFriendlyJobLabel(idValue) {
  const raw = String(idValue || "").trim()
  if (!raw) return "Job"
  const suffix = raw.slice(-4).toUpperCase()
  return `Job #${suffix}`
}

function formatTransactionsCountLabel(count) {
  const safe = Number(count || 0)
  if (safe === 1) return "1 transaction"
  return `${safe.toLocaleString("en-US")} transactions`
}

function normalizeQueueStatus(jobs = []) {
  if (!Array.isArray(jobs) || jobs.length === 0) return "idle"

  const statuses = jobs.map((job) => String(job?.status || "").toLowerCase())
  if (statuses.includes("running")) return "running"
  if (statuses.includes("queued")) return "queued"

  return statuses[0] || "idle"
}

export async function getOfficeDashboardSnapshot(officeId, options = {}) {
  const db = getDB()
  const range = buildMonthRange(options.month)
  const previousRange = buildPreviousRange(range)
  const retentionCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  const clients = await db
    .collection("clients")
    .find({ officeId }, { projection: { _id: 1, name: 1, createdAt: 1 } })
    .toArray()

  const clientIdList = clients.map((client) => String(client._id))
  const clientNameById = new Map(clients.map((client) => [String(client._id), client.name || "Unknown client"]))

  if (clientIdList.length === 0) {
    return {
      header: {
        periodLabel: range.label,
        lastSyncAt: "-",
        queueStatus: "idle",
      },
      kpis: [
        { id: "imported_month", label: "Transactions Imported (Month)", value: "0", trend: "0.0% vs previous month" },
        { id: "categorized_month", label: "Transactions Categorized (Month)", value: "0", trend: "0.0% coverage" },
        { id: "ai_categorized_month", label: "Auto-Categorized by AI (Month)", value: "0", trend: "0.0% of categorized" },
        { id: "pending_now", label: "Pending Categorization (Now)", value: "0", trend: "0.0% of office transactions" },
      ],
      weeklyTrend: [],
      jobsQueue: [],
      recentActivities: [],
    }
  }

  const transactionsCollection = db.collection("transactions")
  const jobsCollection = db.collection("categorization_jobs")

  const [
    importedCurrentCount,
    importedPreviousCount,
    allOfficeTransactionsCount,
    pendingNowCount,
    transactionsInPeriod,
    jobsRaw,
    latestTransaction,
    latestJob,
    recentImportBatches,
    recentClientsForActivity,
    recentProfilesForActivity,
  ] = await Promise.all([
    transactionsCollection.countDocuments({
      clientId: { $in: clientIdList },
      createdAt: { $gte: range.start, $lte: range.end },
    }),
    transactionsCollection.countDocuments({
      clientId: { $in: clientIdList },
      createdAt: { $gte: previousRange.start, $lte: previousRange.end },
    }),
    transactionsCollection.countDocuments({
      clientId: { $in: clientIdList },
    }),
    transactionsCollection.countDocuments({
      clientId: { $in: clientIdList },
      $or: [
        { categoryId: null },
        { categoryId: "" },
        { category: null },
        { category: "" },
        { category: "Uncategorized" },
        { category: "uncategorized" },
        { category: "Uncategorized income" },
        { category: "uncategorized income" },
        { category: "Uncategorized expenses" },
        { category: "uncategorized expenses" },
      ],
    }),
    transactionsCollection
      .find(
        {
          clientId: { $in: clientIdList },
          date: { $gte: range.startKey, $lte: range.endKey },
        },
        {
          projection: {
            _id: 1,
            clientId: 1,
            date: 1,
            categoryId: 1,
            category: 1,
            isSplit: 1,
            splits: 1,
            llmProcessed: 1,
            createdAt: 1,
            description: 1,
          },
        }
      )
      .toArray(),
    jobsCollection
      .find(
        { clientId: { $in: clientIdList } },
        {
          projection: {
            _id: 1,
            clientId: 1,
            status: 1,
            processed: 1,
            total: 1,
            progressPct: 1,
            updatedAt: 1,
            errorMessage: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(200)
      .toArray(),
    transactionsCollection
      .find({ clientId: { $in: clientIdList } }, { projection: { updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray(),
    jobsCollection
      .find({ clientId: { $in: clientIdList } }, { projection: { updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray(),
    transactionsCollection
      .aggregate([
        {
          $match: {
            clientId: { $in: clientIdList },
            createdAt: { $type: "date" },
          },
        },
        {
          $project: {
            clientId: 1,
            createdAt: 1,
            importBucket: {
              $dateToString: {
                format: "%Y-%m-%dT%H:%M",
                date: "$createdAt",
                timezone: "UTC",
              },
            },
          },
        },
        {
          $group: {
            _id: {
              clientId: "$clientId",
              importBucket: "$importBucket",
            },
            count: { $sum: 1 },
            lastCreatedAt: { $max: "$createdAt" },
          },
        },
        { $sort: { lastCreatedAt: -1 } },
        { $limit: 6 },
      ])
      .toArray(),
    db
      .collection("clients")
      .find({ officeId }, { projection: { name: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(4)
      .toArray(),
    db
      .collection("user_profile")
      .find({ officeId }, { projection: { name: 1, email: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(4)
      .toArray(),
  ])

  const categorizedInPeriod = transactionsInPeriod.filter((transaction) =>
    isTransactionCategorized(transaction)
  )
  const aiCategorizedInPeriod = categorizedInPeriod.filter((transaction) => Boolean(transaction.llmProcessed))
  const pendingInPeriodCount = transactionsInPeriod.length - categorizedInPeriod.length

  const coveragePct =
    transactionsInPeriod.length > 0
      ? (categorizedInPeriod.length / transactionsInPeriod.length) * 100
      : 0
  const aiSharePct =
    categorizedInPeriod.length > 0
      ? (aiCategorizedInPeriod.length / categorizedInPeriod.length) * 100
      : 0
  const pendingNowPct =
    allOfficeTransactionsCount > 0
      ? (pendingNowCount / allOfficeTransactionsCount) * 100
      : 0

  // Weekly trend always renders all month weeks.
  // For current month, future weeks stay at zero and fill over time.
  const weeklyBuckets = buildWeeklyBuckets(range.start, range.monthEnd)
  for (const transaction of transactionsInPeriod) {
    const txDate = parseTransactionDate(transaction.date)
    if (!txDate) continue
    if (txDate < range.start || txDate > range.monthEnd) continue

    const diffDays = Math.floor((txDate.getTime() - range.start.getTime()) / 86400000)
    const index = Math.floor(diffDays / 7)
    if (index < 0 || index >= weeklyBuckets.length) continue

    const bucket = weeklyBuckets[index]
    bucket.imported += 1
    if (isTransactionCategorized(transaction)) {
      bucket.categorized += 1
    } else {
      bucket.pending += 1
    }
  }

  const jobsQueueRaw = jobsRaw.filter((job) => {
    const status = String(job?.status || "").toLowerCase()
    if (status === "running" || status === "queued") return true

    if (status === "done" || status === "completed" || status === "failed" || status === "error") {
      const referenceDate = job?.updatedAt instanceof Date ? job.updatedAt : job?.createdAt
      if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return false
      return referenceDate >= retentionCutoff
    }

    return false
  })

  const queueStatus = normalizeQueueStatus(jobsQueueRaw)
  const jobsQueue = jobsQueueRaw.map((job) => ({
    id: String(job._id),
    label: toFriendlyJobLabel(job._id),
    client: clientNameById.get(String(job.clientId)) || "Unknown client",
    progress: Number(job.progressPct || 0),
    processed: Number(job.processed || 0),
    total: Number(job.total || 0),
    status: String(job.status || "queued").toLowerCase(),
    updatedAt: formatRelativeTime(job.updatedAt),
    error: job.errorMessage || null,
  }))

  const latestSyncDate = [latestTransaction?.[0]?.updatedAt, latestJob?.[0]?.updatedAt]
    .filter((value) => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  const recentActivitiesRaw = []

  for (const item of recentImportBatches) {
    const importClientId = String(item?._id?.clientId || "")
    const importCount = Number(item?.count || 0)
    recentActivitiesRaw.push({
      at: item.lastCreatedAt,
      title: "Transaction imported",
      detail: `${clientNameById.get(importClientId) || "Unknown client"} • ${formatTransactionsCountLabel(importCount)}`,
    })
  }

  for (const job of jobsRaw) {
    recentActivitiesRaw.push({
      at: job.updatedAt || job.createdAt,
      title: statusToActivityLabel(job.status),
      detail: `${toFriendlyJobLabel(job._id)} • ${clientNameById.get(String(job.clientId)) || "Unknown client"} • ${Number(job.processed || 0)}/${Number(job.total || 0)}`,
    })
  }

  for (const client of recentClientsForActivity) {
    recentActivitiesRaw.push({
      at: client.createdAt,
      title: "Client created",
      detail: client.name || "Unnamed client",
    })
  }

  for (const profile of recentProfilesForActivity) {
    const profileName = String(profile?.name || "").trim()
    const profileEmail = String(profile?.email || "").trim()
    recentActivitiesRaw.push({
      at: profile.createdAt,
      title: "Employee created",
      detail: profileName || profileEmail || "Unknown employee",
    })
  }

  const recentActivities = recentActivitiesRaw
    .filter((item) => {
      if (!(item.at instanceof Date) || Number.isNaN(item.at.getTime())) return false
      return item.at >= retentionCutoff
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 120)
    .map((item, index) => ({
      id: `act_${index}_${item.at.getTime()}`,
      time: formatRelativeTime(item.at),
      title: item.title,
      detail: item.detail,
    }))

  return {
    header: {
      periodLabel: range.label,
      lastSyncAt: latestSyncDate
        ? latestSyncDate.toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "-",
      queueStatus,
    },
    kpis: [
      {
        id: "imported_month",
        label: "Transactions Imported (Month)",
        value: Number(importedCurrentCount || 0).toLocaleString("en-US"),
        trend: `${formatSignedPercent(importedCurrentCount, importedPreviousCount)} vs previous month`,
      },
      {
        id: "categorized_month",
        label: "Transactions Categorized (Month)",
        value: Number(categorizedInPeriod.length || 0).toLocaleString("en-US"),
        trend: `${coveragePct.toFixed(1)}% coverage`,
      },
      {
        id: "ai_categorized_month",
        label: "Auto-Categorized by AI (Month)",
        value: Number(aiCategorizedInPeriod.length || 0).toLocaleString("en-US"),
        trend: `${aiSharePct.toFixed(1)}% of categorized`,
      },
      {
        id: "pending_now",
        label: "Pending Categorization (Now)",
        value: Number(pendingNowCount || 0).toLocaleString("en-US"),
        trend: `${pendingNowPct.toFixed(1)}% of office transactions`,
      },
    ],
    weeklyTrend: weeklyBuckets.map((bucket) => ({
      week: bucket.label,
      imported: bucket.imported,
      categorized: bucket.categorized,
      pending: bucket.pending,
    })),
    jobsQueue,
    recentActivities,
    meta: {
      month: `${range.start.getUTCFullYear()}-${pad2(range.start.getUTCMonth() + 1)}`,
      weeksCount: weeklyBuckets.length,
      pendingInPeriod: pendingInPeriodCount,
    },
  }
}
