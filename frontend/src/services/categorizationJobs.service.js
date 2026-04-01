import { api } from "../lib/api"

export async function createCategorizationJob(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required")
  }

  return api("/api/transactions/categorize-all-llm/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
    silentLoading: true,
  })
}

export async function getCategorizationJobById(jobId) {
  const id = String(jobId || "").trim()
  if (!id) throw new Error("jobId is required")

  return api(`/api/transactions/categorize-all-llm/jobs/${id}`, {
    silentLoading: true,
  })
}

export async function listCategorizationJobs(options = {}) {
  const limit = Number(options.limit || 20)
  const params = new URLSearchParams({
    limit: String(limit),
  })

  return api(`/api/transactions/categorize-all-llm/jobs?${params.toString()}`, {
    silentLoading: true,
  })
}
