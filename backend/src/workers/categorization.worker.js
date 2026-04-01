import {
  createCategorizationJob,
  getCategorizationJobById,
  listQueuedCategorizationJobs,
  markRunningCategorizationJobsAsQueued,
  updateCategorizationJobProgress,
} from "../repositories/categorizationJob.repository.js"
import {
  listEligibleTransactionsForLlmByClientId,
  listEligibleTransactionsForLlmByIds,
  listEligibleTransactionsForZelleByClientId,
  listEligibleTransactionsForZelleByIds,
} from "../repositories/transactions.repository.js"
import {
  categorizeTransactionsWithLlmService,
  categorizeZelleTransactionsService,
} from "../services/transactions.service.js"

let isWorkerRunning = false
let pollTimer = null

function getEligiblePromises({ clientId, mode, transactionIds }) {
  if (mode === "selected") {
    return Promise.all([
      listEligibleTransactionsForZelleByIds(clientId, transactionIds),
      listEligibleTransactionsForLlmByIds(clientId, transactionIds),
    ])
  }

  return Promise.all([
    listEligibleTransactionsForZelleByClientId(clientId),
    listEligibleTransactionsForLlmByClientId(clientId),
  ])
}

async function processSingleJob(job) {
  const jobId = String(job._id)
  const input = {
    clientId: String(job.clientId || "").trim(),
    mode: String(job.mode || "all_client"),
    transactionIds: Array.isArray(job.transactionIds) ? job.transactionIds : [],
  }

  const startedAt = new Date()
  await updateCategorizationJobProgress(jobId, {
    status: "running",
    stage: "preparing",
    startedAt,
    errorMessage: null,
  })

  try {
    const [zelleEligible, llmEligible] = await getEligiblePromises(input)
    const total = Number(zelleEligible.length || 0) + Number(llmEligible.length || 0)

    await updateCategorizationJobProgress(jobId, {
      status: "running",
      stage: "zelle",
      total,
      processed: 0,
    })

    const zelle = await categorizeZelleTransactionsService(input)
    const processedAfterZelle = Number(zelle?.processedCount || 0)

    await updateCategorizationJobProgress(jobId, {
      status: "running",
      stage: "llm",
      total,
      processed: processedAfterZelle,
    })

    const llm = await categorizeTransactionsWithLlmService(input)
    const totalProcessedCount = processedAfterZelle + Number(llm?.processedCount || 0)

    await updateCategorizationJobProgress(jobId, {
      status: "done",
      stage: "done",
      total,
      processed: totalProcessedCount,
      completedAt: new Date(),
      result: {
        mode: llm.mode || zelle.mode || input.mode,
        requestedCount: Number(llm.requestedCount || zelle.requestedCount || 0),
        totalProcessedCount,
        zelle,
        llm,
      },
    })
  } catch (error) {
    await updateCategorizationJobProgress(jobId, {
      status: "failed",
      stage: "failed",
      completedAt: new Date(),
      errorMessage: error?.message || "Categorization job failed",
    })
  }
}

async function processQueueTick() {
  if (isWorkerRunning) return
  isWorkerRunning = true

  try {
    const queuedJobs = await listQueuedCategorizationJobs(1)
    if (queuedJobs.length === 0) return
    await processSingleJob(queuedJobs[0])
  } finally {
    isWorkerRunning = false
  }
}

export async function enqueueCategorizationJob(input) {
  const created = await createCategorizationJob(input)
  await processQueueTick()
  return created
}

export async function getCategorizationJobOrThrow(jobId) {
  const job = await getCategorizationJobById(jobId)
  if (!job) throw new Error("categorization job not found")
  return job
}

export async function startCategorizationWorker() {
  await markRunningCategorizationJobsAsQueued()
  await processQueueTick()

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      processQueueTick().catch(() => {})
    }, 1500)
  }
}

