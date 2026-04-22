import { ObjectId } from "mongodb"
import {
  getCategorizationJobOrThrow,
  enqueueCategorizationJob,
} from "../workers/categorization.worker.js"
import { listCategorizationJobsByUser } from "../repositories/categorizationJob.repository.js"

function normalizeInput(input = {}) {
  const clientId = String(input?.clientId || "").trim()
  const mode = String(input?.mode || "all_client").trim().toLowerCase()
  const transactionIds = Array.isArray(input?.transactionIds)
    ? input.transactionIds.map((id) => String(id || "").trim()).filter(Boolean)
    : []

  if (!clientId) throw new Error("clientId is required")
  if (!ObjectId.isValid(clientId)) throw new Error("clientId is invalid")
  if (!["selected", "all_client"].includes(mode)) {
    throw new Error("mode must be one of: selected, all_client")
  }
  if (mode === "selected") {
    if (transactionIds.length === 0) throw new Error("transactionIds is required for selected mode")
    if (transactionIds.some((id) => !ObjectId.isValid(id))) {
      throw new Error("transactionIds has invalid ObjectId values")
    }
  }

  return { clientId, mode, transactionIds }
}

export async function createCategorizationJobService(input, userId) {
  const normalized = normalizeInput(input)
  const createdBy = String(userId || "").trim()
  if (!createdBy) throw new Error("userId is required")

  const job = await enqueueCategorizationJob({
    ...normalized,
    createdBy,
    requestedCount: normalized.mode === "selected" ? normalized.transactionIds.length : 0,
  })

  return {
    jobId: String(job._id),
    status: job.status,
  }
}

export async function getCategorizationJobByIdService(jobId, userId) {
  if (!ObjectId.isValid(String(jobId || ""))) throw new Error("jobId is invalid")

  const job = await getCategorizationJobOrThrow(jobId)
  if (String(job.createdBy || "") !== String(userId || "")) {
    throw new Error("not allowed to access this job")
  }
  return job
}

export async function listCategorizationJobsService(userId, query = {}) {
  const limit = Number(query?.limit || 20)
  return listCategorizationJobsByUser(String(userId || ""), { limit })
}

