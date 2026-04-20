import {
  syncClientCategoriesByTagsService,
  syncOfficeClientsByTagsService,
} from "../services/categorySync.service.js"

const pendingOfficeIds = new Set()
const pendingClientKeys = new Set()
const queue = []

let isWorkerRunning = false

function normalizeOfficeId(officeId) {
  return String(officeId || "").trim()
}

function normalizeClientId(clientId) {
  return String(clientId || "").trim()
}

function getClientQueueKey(officeId, clientId) {
  const safeOfficeId = normalizeOfficeId(officeId)
  const safeClientId = normalizeClientId(clientId)
  if (!safeOfficeId || !safeClientId) return ""
  return `${safeOfficeId}:${safeClientId}`
}

function hasPendingOfficeSync(officeId) {
  const safeOfficeId = normalizeOfficeId(officeId)
  if (!safeOfficeId) return false
  return pendingOfficeIds.has(safeOfficeId)
}

function pruneClientQueueForOffice(officeId) {
  const safeOfficeId = normalizeOfficeId(officeId)
  if (!safeOfficeId) return

  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const item = queue[index]
    if (item?.type === "client" && normalizeOfficeId(item.officeId) === safeOfficeId) {
      queue.splice(index, 1)
    }
  }

  for (const key of pendingClientKeys) {
    if (key.startsWith(`${safeOfficeId}:`)) {
      pendingClientKeys.delete(key)
    }
  }
}

async function processQueueTick() {
  if (isWorkerRunning) return
  isWorkerRunning = true

  try {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) continue

      if (job.type === "office") {
        const officeId = normalizeOfficeId(job.officeId)
        if (!officeId) continue

        try {
          await syncOfficeClientsByTagsService(officeId)
        } catch (error) {
          console.error("Background office category sync failed", {
            officeId,
            message: error?.message || "Unknown error",
          })
        } finally {
          pendingOfficeIds.delete(officeId)
        }

        continue
      }

      if (job.type === "client") {
        const officeId = normalizeOfficeId(job.officeId)
        const clientId = normalizeClientId(job.clientId)
        const key = getClientQueueKey(officeId, clientId)
        if (!officeId || !clientId || !key) continue

        try {
          if (!hasPendingOfficeSync(officeId)) {
            await syncClientCategoriesByTagsService({ officeId, clientId })
          }
        } catch (error) {
          console.error("Background client category sync failed", {
            officeId,
            clientId,
            message: error?.message || "Unknown error",
          })
        } finally {
          pendingClientKeys.delete(key)
        }
      }
    }
  } finally {
    isWorkerRunning = false
  }
}

function scheduleQueueProcessing() {
  setImmediate(() => {
    processQueueTick().catch((error) => {
      console.error("Category sync worker tick failed", {
        message: error?.message || "Unknown error",
      })
    })
  })
}

export function enqueueClientCategorySync(input = {}) {
  const officeId = normalizeOfficeId(input?.officeId)
  const clientId = normalizeClientId(input?.clientId)
  const key = getClientQueueKey(officeId, clientId)

  if (!officeId || !clientId || !key) return false
  if (hasPendingOfficeSync(officeId)) return false
  if (pendingClientKeys.has(key)) return false

  pendingClientKeys.add(key)
  queue.push({
    type: "client",
    officeId,
    clientId,
  })
  scheduleQueueProcessing()
  return true
}

export function enqueueOfficeCategorySync(officeId) {
  const safeOfficeId = normalizeOfficeId(officeId)
  if (!safeOfficeId) return false
  if (pendingOfficeIds.has(safeOfficeId)) return false

  pendingOfficeIds.add(safeOfficeId)
  pruneClientQueueForOffice(safeOfficeId)
  queue.push({
    type: "office",
    officeId: safeOfficeId,
  })
  scheduleQueueProcessing()
  return true
}

export async function startCategorySyncWorker() {
  scheduleQueueProcessing()
}
