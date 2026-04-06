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
  const isCurrentMonth =
    parsed.year === now.getUTCFullYear() && parsed.month === now.getUTCMonth() + 1

  const end = isCurrentMonth ? now : monthEnd
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
    const elapsedMs = currentRange.end.getTime() - currentRange.start.getTime()
    const alignedEnd = new Date(previousStart.getTime() + elapsedMs)
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
      label: `Week ${index}`,
      start: bucketStart,
      end: bucketEnd,
      imported: 0,
      categorized: 0,
      aiProcessed: 0,
      aiCategorized: 0,
      pending: 0,
    })

    cursor = new Date(bucketEnd)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    index += 1
  }

  return buckets
}

function buildDailyBuckets(startDate, endDate) {
  const buckets = []
  let cursor = new Date(startDate)

  while (cursor <= endDate) {
    const bucketDate = new Date(cursor)
    buckets.push({
      id: toDateKey(bucketDate),
      label: bucketDate.toLocaleString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
      date: bucketDate,
      imported: 0,
      categorized: 0,
      aiProcessed: 0,
      aiCategorized: 0,
      pending: 0,
    })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return buckets
}

function toUtcDayStart(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return null

  return new Date(
    Date.UTC(
      dateValue.getUTCFullYear(),
      dateValue.getUTCMonth(),
      dateValue.getUTCDate()
    )
  )
}

function getUtcWeekRange(dateValue) {
  const dayStart = toUtcDayStart(dateValue)
  if (!dayStart) return { start: null, end: null }

  const dayOfWeek = dayStart.getUTCDay()
  const start = new Date(dayStart)
  start.setUTCDate(start.getUTCDate() - dayOfWeek)

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)

  return { start, end }
}

function getWeeklyBucketIndex(dateValue, monthStart, bucketsLength) {
  const safeDate = toUtcDayStart(dateValue)
  if (!safeDate) return -1

  const diffDays = Math.floor((safeDate.getTime() - monthStart.getTime()) / 86400000)
  const index = Math.floor(diffDays / 7)

  if (index < 0 || index >= bucketsLength) return -1
  return index
}

function getDailyBucketIndex(dateValue, dayStart, bucketsLength) {
  const safeDate = toUtcDayStart(dateValue)
  if (!safeDate) return -1

  const diffDays = Math.floor((safeDate.getTime() - dayStart.getTime()) / 86400000)
  if (diffDays < 0 || diffDays >= bucketsLength) return -1
  return diffDays
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

function buildCategorizedMonthFilter(clientIdList, start, end) {
  return {
    clientId: { $in: clientIdList },
    $or: [
      {
        categorizedAt: { $gte: start, $lte: end },
      },
      {
        $and: [
          {
            $or: [
              { categorizedAt: null },
              { categorizedAt: { $exists: false } },
            ],
          },
          {
            llmStatus: "suggested",
          },
          {
            llmProcessedAt: { $gte: start, $lte: end },
          },
        ],
      },
    ],
  }
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
        { id: "categorized_month", label: "Transactions Categorized (Month)", value: "0", trend: "0.0% of imported" },
        { id: "ai_processed_month", label: "AI Processed (Month)", value: "0", trend: "0.0% of imported" },
        { id: "ai_categorized_month", label: "Auto-Categorized by AI (Month)", value: "0", trend: "0.0% of AI processed" },
        { id: "pending_now", label: "Pending Categorization (Now)", value: "0", trend: "0.0% of office transactions" },
      ],
      weekKpis: [
        { id: "imported_week", label: "Transactions Imported (Week)", value: "0", trend: "0.0% vs previous week" },
        { id: "categorized_week", label: "Transactions Categorized (Week)", value: "0", trend: "0.0% of imported" },
        { id: "ai_processed_week", label: "AI Processed (Week)", value: "0", trend: "0.0% of imported" },
        { id: "ai_categorized_week", label: "Auto-Categorized by AI (Week)", value: "0", trend: "0.0% of AI processed" },
        { id: "pending_week", label: "Pending Categorization (Week)", value: "0", trend: "0.0% of imported" },
      ],
      weeklyTrend: [],
      dailyTrend: [],
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
    categorizedCurrentCount,
    aiProcessedCurrentCount,
    aiCategorizedCurrentCount,
    importedTrendTransactions,
    aiProcessedTrendTransactions,
    categorizedTrendTransactions,
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
    transactionsCollection.countDocuments(
      buildCategorizedMonthFilter(clientIdList, range.start, range.end)
    ),
    transactionsCollection.countDocuments({
      clientId: { $in: clientIdList },
      llmProcessedAt: { $gte: range.start, $lte: range.end },
    }),
    transactionsCollection.countDocuments({
      clientId: { $in: clientIdList },
      llmStatus: "suggested",
      llmProcessedAt: { $gte: range.start, $lte: range.end },
    }),
    transactionsCollection
      .find(
        {
          clientId: { $in: clientIdList },
          createdAt: { $gte: range.start, $lte: range.monthEnd },
        },
        {
          projection: {
            _id: 1,
            createdAt: 1,
            categoryId: 1,
            category: 1,
            isSplit: 1,
            splits: 1,
          },
        }
      )
      .toArray(),
    transactionsCollection
      .find(
        {
          clientId: { $in: clientIdList },
          llmProcessedAt: { $gte: range.start, $lte: range.monthEnd },
        },
        {
          projection: {
            _id: 1,
            llmProcessedAt: 1,
            llmStatus: 1,
          },
        }
      )
      .toArray(),
    transactionsCollection
      .find(
        buildCategorizedMonthFilter(clientIdList, range.start, range.monthEnd),
        {
          projection: {
            _id: 1,
            categorizedAt: 1,
            llmProcessedAt: 1,
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

  const categorizedCoveragePct =
    importedCurrentCount > 0
      ? (Number(categorizedCurrentCount || 0) / Number(importedCurrentCount || 0)) * 100
      : 0
  const aiSharePct =
    aiProcessedCurrentCount > 0
      ? (Number(aiCategorizedCurrentCount || 0) / Number(aiProcessedCurrentCount || 0)) * 100
      : 0
  const aiProcessedPct =
    importedCurrentCount > 0
      ? (Number(aiProcessedCurrentCount || 0) / Number(importedCurrentCount || 0)) * 100
      : 0
  const pendingNowPct =
    allOfficeTransactionsCount > 0
      ? (pendingNowCount / allOfficeTransactionsCount) * 100
      : 0

  // Operational weekly trend:
  // imported uses createdAt, categorized uses llmProcessedAt,
  // pending shows still-uncategorized transactions by intake week.
  const weeklyBuckets = buildWeeklyBuckets(range.start, range.monthEnd)

  for (const transaction of importedTrendTransactions) {
    const index = getWeeklyBucketIndex(transaction.createdAt, range.start, weeklyBuckets.length)
    if (index === -1) continue

    const bucket = weeklyBuckets[index]
    bucket.imported += 1

    if (isTransactionCategorized(transaction)) {
      continue
    }

    bucket.pending += 1
  }

  for (const transaction of aiProcessedTrendTransactions) {
    const index = getWeeklyBucketIndex(transaction.llmProcessedAt, range.start, weeklyBuckets.length)
    if (index === -1) continue

    const bucket = weeklyBuckets[index]
    bucket.aiProcessed += 1

    if (String(transaction.llmStatus || "").toLowerCase() === "suggested") {
      bucket.aiCategorized += 1
    }
  }

  for (const transaction of categorizedTrendTransactions) {
    const categorizedReferenceDate = transaction.categorizedAt || transaction.llmProcessedAt
    const index = getWeeklyBucketIndex(categorizedReferenceDate, range.start, weeklyBuckets.length)
    if (index === -1) continue

    const bucket = weeklyBuckets[index]
    bucket.categorized += 1
  }

  const currentWeekIndex = Math.max(0, getWeeklyBucketIndex(range.end, range.start, weeklyBuckets.length))
  const fallbackWeekBucket = weeklyBuckets[currentWeekIndex] || weeklyBuckets[weeklyBuckets.length - 1] || {
    label: "Week",
    imported: 0,
    categorized: 0,
    aiProcessed: 0,
    aiCategorized: 0,
    pending: 0,
  }
  const currentCalendarWeekRange = getUtcWeekRange(range.end)
  const currentWeekRangeStart = currentCalendarWeekRange.start || fallbackWeekBucket.start || range.start
  const currentWeekRangeEnd = currentCalendarWeekRange.end || fallbackWeekBucket.end || range.end

  const currentWeekBucket = {
    label: "Week",
    start: currentWeekRangeStart,
    end: currentWeekRangeEnd,
    imported: 0,
    categorized: 0,
    aiProcessed: 0,
    aiCategorized: 0,
    pending: 0,
  }
  const dailyBuckets = buildDailyBuckets(currentWeekRangeStart, currentWeekRangeEnd)

  for (const transaction of importedTrendTransactions) {
    const transactionDay = toUtcDayStart(transaction.createdAt)
    if (
      transactionDay &&
      transactionDay >= currentWeekRangeStart &&
      transactionDay <= currentWeekRangeEnd
    ) {
      currentWeekBucket.imported += 1

      if (!isTransactionCategorized(transaction)) {
        currentWeekBucket.pending += 1
      }
    }

    const index = getDailyBucketIndex(transaction.createdAt, currentWeekRangeStart, dailyBuckets.length)
    if (index !== -1) {
      const bucket = dailyBuckets[index]
      bucket.imported += 1

      if (!isTransactionCategorized(transaction)) {
        bucket.pending += 1
      }
    }
  }

  for (const transaction of aiProcessedTrendTransactions) {
    const processedDay = toUtcDayStart(transaction.llmProcessedAt)
    const isSuggested = String(transaction.llmStatus || "").toLowerCase() === "suggested"

    if (
      processedDay &&
      processedDay >= currentWeekRangeStart &&
      processedDay <= currentWeekRangeEnd
    ) {
      currentWeekBucket.aiProcessed += 1

      if (isSuggested) {
        currentWeekBucket.aiCategorized += 1
      }
    }

    const index = getDailyBucketIndex(transaction.llmProcessedAt, currentWeekRangeStart, dailyBuckets.length)
    if (index !== -1) {
      const bucket = dailyBuckets[index]
      bucket.aiProcessed += 1

      if (isSuggested) {
        bucket.aiCategorized += 1
      }
    }
  }

  for (const transaction of categorizedTrendTransactions) {
    const categorizedReferenceDate = transaction.categorizedAt || transaction.llmProcessedAt
    const categorizedDay = toUtcDayStart(categorizedReferenceDate)
    if (
      categorizedDay &&
      categorizedDay >= currentWeekRangeStart &&
      categorizedDay <= currentWeekRangeEnd
    ) {
      currentWeekBucket.categorized += 1
    }

    const index = getDailyBucketIndex(categorizedReferenceDate, currentWeekRangeStart, dailyBuckets.length)
    if (index !== -1) {
      const bucket = dailyBuckets[index]
      bucket.categorized += 1
    }
  }
  const previousWeekBucket = weeklyBuckets[currentWeekIndex - 1] || {
    imported: 0,
    categorized: 0,
    aiProcessed: 0,
    aiCategorized: 0,
    pending: 0,
  }

  const categorizedWeekPct =
    currentWeekBucket.imported > 0
      ? (Number(currentWeekBucket.categorized || 0) / Number(currentWeekBucket.imported || 0)) * 100
      : 0
  const aiProcessedWeekPct =
    currentWeekBucket.imported > 0
      ? (Number(currentWeekBucket.aiProcessed || 0) / Number(currentWeekBucket.imported || 0)) * 100
      : 0
  const aiCategorizedWeekPct =
    currentWeekBucket.aiProcessed > 0
      ? (Number(currentWeekBucket.aiCategorized || 0) / Number(currentWeekBucket.aiProcessed || 0)) * 100
      : 0
  const pendingWeekPct =
    currentWeekBucket.imported > 0
      ? (Number(currentWeekBucket.pending || 0) / Number(currentWeekBucket.imported || 0)) * 100
      : 0

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
        value: Number(categorizedCurrentCount || 0).toLocaleString("en-US"),
        trend: `${categorizedCoveragePct.toFixed(1)}% of imported`,
      },
      {
        id: "ai_processed_month",
        label: "AI Processed (Month)",
        value: Number(aiProcessedCurrentCount || 0).toLocaleString("en-US"),
        trend: `${aiProcessedPct.toFixed(1)}% of imported`,
      },
      {
        id: "ai_categorized_month",
        label: "Auto-Categorized by AI (Month)",
        value: Number(aiCategorizedCurrentCount || 0).toLocaleString("en-US"),
        trend: `${aiSharePct.toFixed(1)}% of AI processed`,
      },
      {
        id: "pending_now",
        label: "Pending Categorization (Now)",
        value: Number(pendingNowCount || 0).toLocaleString("en-US"),
        trend: `${pendingNowPct.toFixed(1)}% of office transactions`,
      },
    ],
    weekKpis: [
      {
        id: "imported_week",
        label: "Transactions Imported (Week)",
        value: Number(currentWeekBucket.imported || 0).toLocaleString("en-US"),
        trend: `${formatSignedPercent(currentWeekBucket.imported, previousWeekBucket.imported)} vs previous week`,
      },
      {
        id: "categorized_week",
        label: "Transactions Categorized (Week)",
        value: Number(currentWeekBucket.categorized || 0).toLocaleString("en-US"),
        trend: `${categorizedWeekPct.toFixed(1)}% of imported`,
      },
      {
        id: "ai_processed_week",
        label: "AI Processed (Week)",
        value: Number(currentWeekBucket.aiProcessed || 0).toLocaleString("en-US"),
        trend: `${aiProcessedWeekPct.toFixed(1)}% of imported`,
      },
      {
        id: "ai_categorized_week",
        label: "Auto-Categorized by AI (Week)",
        value: Number(currentWeekBucket.aiCategorized || 0).toLocaleString("en-US"),
        trend: `${aiCategorizedWeekPct.toFixed(1)}% of AI processed`,
      },
      {
        id: "pending_week",
        label: "Pending Categorization (Week)",
        value: Number(currentWeekBucket.pending || 0).toLocaleString("en-US"),
        trend: `${pendingWeekPct.toFixed(1)}% of imported`,
      },
    ],
    weeklyTrend: weeklyBuckets.map((bucket) => ({
      week: bucket.label,
      imported: bucket.imported,
      categorized: bucket.categorized,
      aiProcessed: bucket.aiProcessed,
      aiCategorized: bucket.aiCategorized,
      pending: bucket.pending,
    })),
    dailyTrend: dailyBuckets.map((bucket) => ({
      day: bucket.label,
      imported: bucket.imported,
      categorized: bucket.categorized,
      aiProcessed: bucket.aiProcessed,
      aiCategorized: bucket.aiCategorized,
      pending: bucket.pending,
    })),
    jobsQueue,
    recentActivities,
    meta: {
      month: `${range.start.getUTCFullYear()}-${pad2(range.start.getUTCMonth() + 1)}`,
      weeksCount: weeklyBuckets.length,
      currentWeekLabel: currentWeekBucket.label,
      pendingInPeriod: pendingNowCount,
    },
  }
}
