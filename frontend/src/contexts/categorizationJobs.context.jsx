/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useNotification } from "./notification.context"
import {
  createCategorizationJob,
  getCategorizationJobById,
  listCategorizationJobs,
} from "../services/categorizationJobs.service"
import { getClientById } from "../services/clients.service"
import { createTransactionsBatch } from "../services/transactions.service"
import { emitDashboardRefresh } from "../utils/dashboardRefresh"

const CategorizationJobsContext = createContext(null)

const TERMINAL_STATUSES = new Set(["done", "failed"])
const DISMISSED_JOBS_STORAGE_KEY = "categorization_jobs_dismissed_ids"
const PRIVATE_BETA_REVIEW_EVENT = "app:private-beta-review-required"
const TRANSACTIONS_UPLOAD_CHUNK_SIZE = 400
const TRANSACTIONS_IMPORT_DONE_EVENT = "app:transactions-import-job-done"
const JOBS_IDLE_REFRESH_MS = 60000
const JOBS_ACTIVE_REFRESH_MS = 2500

function isDocumentVisible() {
  if (typeof document === "undefined") return true
  return document.visibilityState !== "hidden"
}

function getJobId(job = {}) {
  return String(job?._id || job?.id || job?.jobId || "")
}

function getJobType(job = {}) {
  return String(job?.type || "categorize_all_llm").trim().toLowerCase()
}

function getStatusLabel(status = "") {
  if (status === "queued") return "Queued"
  if (status === "running") return "Running"
  if (status === "done") return "Done"
  if (status === "failed") return "Failed"
  return "Unknown"
}

function readDismissedJobIdsFromStorage() {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(DISMISSED_JOBS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((id) => String(id || "").trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

function writeDismissedJobIdsToStorage(idsSet = new Set()) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      DISMISSED_JOBS_STORAGE_KEY,
      JSON.stringify(Array.from(idsSet))
    )
  } catch {
    // ignore storage errors
  }
}

function getJobTitle(job = {}, clientName = "") {
  const type = getJobType(job)
  if (type === "import_transactions") {
    return `Importing transactions for ${clientName || "Client"}`
  }
  return `Categorizing ${clientName || "Client"}`
}

function upsertJobs(currentJobs, incomingJobs) {
  const next = [...currentJobs]

  incomingJobs.forEach((incoming) => {
    const id = getJobId(incoming)
    if (!id) return
    const index = next.findIndex((item) => getJobId(item) === id)
    if (index === -1) {
      next.unshift(incoming)
      return
    }
    next[index] = {
      ...next[index],
      ...incoming,
    }
  })

  return next
    .sort((a, b) => {
      const aDate = new Date(a?.createdAt || 0).getTime()
      const bDate = new Date(b?.createdAt || 0).getTime()
      return bDate - aDate
    })
    .slice(0, 20)
}

function CategorizationJobsQueue({ jobs = [], clientNameById = {}, onDismissJob }) {
  if (!jobs.length) return null

  return (
    <div className="fixed right-4 top-4 z-[1000] w-[340px] max-w-[calc(100vw-24px)]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-100 px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Background Jobs
          </h3>
        </div>
        <div className="max-h-[48vh] overflow-y-auto p-2">
          <ul className="space-y-2">
            {jobs.map((job) => {
              const id = getJobId(job)
              const status = String(job?.status || "")
              const total = Number(job?.total || 0)
              const processed = Number(job?.processed || 0)
              const pct = Number(job?.progressPct || 0)
              const clientId = String(job?.clientId || "").trim()
              const clientName = String(clientNameById[clientId] || "").trim()
              const isTerminal = TERMINAL_STATUSES.has(status)
              const type = getJobType(job)

              return (
                <li key={id} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-gray-700">
                      {getJobTitle(job, clientName)}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : status === "failed"
                            ? "bg-rose-100 text-rose-700"
                            : status === "running"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {getStatusLabel(status)}
                    </span>
                  </div>

                  {isTerminal ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                        onClick={() => onDismissJob?.(id)}
                      >
                        Fechar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 text-[11px] text-gray-600">
                        {type === "import_transactions"
                          ? `${processed} / ${total || 0} rows uploaded`
                          : `${processed} / ${total || 0} processed`}
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-200">
                        <div
                          className={`h-1.5 rounded-full ${
                            status === "failed" ? "bg-rose-500" : "bg-gray-900"
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                        />
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function CategorizationJobsProvider({ children }) {
  const { success, error } = useNotification()
  const [jobs, setJobs] = useState([])
  const [clientNameById, setClientNameById] = useState({})
  const notifiedIdsRef = useRef(new Set())
  const loadingClientIdsRef = useRef(new Set())
  const dismissedJobIdsRef = useRef(readDismissedJobIdsFromStorage())
  const isRefreshingJobsRef = useRef(false)

  const refreshJobs = useCallback(async () => {
    if (isRefreshingJobsRef.current || !isDocumentVisible()) return
    isRefreshingJobsRef.current = true
    try {
      const list = await listCategorizationJobs({ limit: 20 })
      const safeList = (Array.isArray(list) ? list : []).filter(
        (job) => !dismissedJobIdsRef.current.has(getJobId(job))
      )
      setJobs((current) => upsertJobs(current, safeList))
    } catch {
      // silent refresh
    } finally {
      isRefreshingJobsRef.current = false
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshJobs()
    }, 0)
    return () => clearTimeout(timer)
  }, [refreshJobs])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (isDocumentVisible()) refreshJobs()
    }
    const timer = setInterval(refreshWhenVisible, JOBS_IDLE_REFRESH_MS)

    window.addEventListener("focus", refreshWhenVisible)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refreshWhenVisible)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [refreshJobs])

  useEffect(() => {
    const active = jobs.filter((job) => {
      const status = String(job?.status || "")
      const type = getJobType(job)
      return type !== "import_transactions" && !TERMINAL_STATUSES.has(status)
    })
    if (active.length === 0) return undefined

    let cancelled = false
    const timer = setInterval(async () => {
      if (cancelled) return
      const ids = active.map((job) => getJobId(job)).filter(Boolean)
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getCategorizationJobById(id)
          } catch {
            return null
          }
        })
      )
      if (cancelled) return
      const safeResults = results.filter(
        (job) => job && !dismissedJobIdsRef.current.has(getJobId(job))
      )
      setJobs((current) => upsertJobs(current, safeResults))
    }, JOBS_ACTIVE_REFRESH_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [jobs])

  useEffect(() => {
    jobs.forEach((job) => {
      const id = getJobId(job)
      if (!id || notifiedIdsRef.current.has(id)) return

      const status = String(job?.status || "")
      const type = getJobType(job)
      if (status === "done" && type === "categorize_all_llm") {
        const totalProcessedCount = Number(job?.result?.totalProcessedCount || job?.processed || 0)
        success(`AI categorization completed: ${totalProcessedCount} transactions processed.`)
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(PRIVATE_BETA_REVIEW_EVENT, {
              detail: {
                source: "llm-categorization",
                jobId: id,
                clientId: String(job?.clientId || "").trim(),
              },
            })
          )
        }
        emitDashboardRefresh("categorization-job-done")
        notifiedIdsRef.current.add(id)
      } else if (status === "failed" && type === "categorize_all_llm") {
        error(job?.errorMessage || "AI categorization failed.")
        emitDashboardRefresh("categorization-job-failed")
        notifiedIdsRef.current.add(id)
      } else if (status === "done" && type === "import_transactions") {
        const insertedCount = Number(job?.result?.insertedCount || 0)
        const totalRows = Number(job?.result?.totalRows || job?.total || 0)
        const skippedRows = Number(job?.result?.skippedRows || Math.max(totalRows - insertedCount, 0))
        const filesCount = Number(job?.result?.filesCount || 1)

        success(
          `${insertedCount} transactions imported from ${filesCount} file(s). ${skippedRows} skipped out of ${totalRows} row(s).`
        )
        emitDashboardRefresh("transactions-imported")
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(TRANSACTIONS_IMPORT_DONE_EVENT, {
              detail: {
                jobId: id,
                clientId: String(job?.clientId || "").trim(),
              },
            })
          )
        }
        notifiedIdsRef.current.add(id)
      } else if (status === "failed" && type === "import_transactions") {
        error(job?.errorMessage || "Transactions import failed.")
        emitDashboardRefresh("transactions-import-failed")
        notifiedIdsRef.current.add(id)
      }
    })
  }, [jobs, success, error])

  useEffect(() => {
    const missingClientIds = [...new Set(
      jobs
        .map((job) => String(job?.clientId || "").trim())
        .filter(Boolean)
        .filter((clientId) => !clientNameById[clientId] && !loadingClientIdsRef.current.has(clientId))
    )]

    if (missingClientIds.length === 0) return

    missingClientIds.forEach((clientId) => loadingClientIdsRef.current.add(clientId))

    Promise.all(
      missingClientIds.map(async (clientId) => {
        try {
          const client = await getClientById(clientId)
          return { clientId, clientName: String(client?.name || "").trim() || clientId }
        } catch {
          return { clientId, clientName: clientId }
        }
      })
    )
      .then((results) => {
        setClientNameById((current) => {
          const next = { ...current }
          results.forEach(({ clientId, clientName }) => {
            next[clientId] = clientName
          })
          return next
        })
      })
      .finally(() => {
        missingClientIds.forEach((clientId) => loadingClientIdsRef.current.delete(clientId))
      })
  }, [jobs, clientNameById])

  const startCategorizationJob = useCallback(async (payload) => {
    const result = await createCategorizationJob(payload)
    const jobId = String(result?.jobId || "")
    if (!jobId) throw new Error("Invalid job response")
    dismissedJobIdsRef.current.delete(jobId)
    writeDismissedJobIdsToStorage(dismissedJobIdsRef.current)

    setJobs((current) =>
      upsertJobs(current, [{
        _id: jobId,
        status: "queued",
        stage: "queued",
        clientId: payload?.clientId || "",
        total: 0,
        processed: 0,
        progressPct: 0,
        createdAt: new Date().toISOString(),
      }])
    )

    try {
      const fullJob = await getCategorizationJobById(jobId)
      setJobs((current) => upsertJobs(current, [fullJob]))
    } catch {
      // keep queued placeholder
    }

    return { jobId }
  }, [])

  const startTransactionsImportJob = useCallback(async ({ clientId, transactions, summary }) => {
    const safeClientId = String(clientId || "").trim()
    const safeTransactions = Array.isArray(transactions) ? transactions : []

    if (!safeClientId) throw new Error("clientId is required")
    if (safeTransactions.length === 0) throw new Error("No transactions to import")

    const total = safeTransactions.length
    const totalChunks = Math.ceil(total / TRANSACTIONS_UPLOAD_CHUNK_SIZE)
    const totalRows = Number(summary?.totals?.totalRows || total)
    const filesCount = Number(summary?.totals?.files || 1)
    const skippedRows = Number(summary?.totals?.skippedRows || Math.max(totalRows - total, 0))
    const jobId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const createdAt = new Date().toISOString()

    dismissedJobIdsRef.current.delete(jobId)
    writeDismissedJobIdsToStorage(dismissedJobIdsRef.current)

    setJobs((current) =>
      upsertJobs(current, [{
        _id: jobId,
        type: "import_transactions",
        status: "queued",
        stage: "queued",
        clientId: safeClientId,
        total,
        processed: 0,
        progressPct: 0,
        createdAt,
      }])
    )

    setTimeout(async () => {
      let insertedCount = 0

      try {
        setJobs((current) =>
          upsertJobs(current, [{
            _id: jobId,
            type: "import_transactions",
            status: "running",
            stage: "uploading",
            clientId: safeClientId,
            total,
            processed: 0,
            progressPct: 0,
            createdAt,
          }])
        )

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const start = chunkIndex * TRANSACTIONS_UPLOAD_CHUNK_SIZE
          const end = start + TRANSACTIONS_UPLOAD_CHUNK_SIZE
          const chunk = safeTransactions.slice(start, end)
          const result = await createTransactionsBatch(chunk, { silentLoading: true })
          insertedCount += Number(result?.insertedCount || 0)

          const processed = Math.min(end, total)
          const progressPct = total > 0
            ? Math.max(0, Math.min(100, Math.round((processed / total) * 100)))
            : 0

          setJobs((current) =>
            upsertJobs(current, [{
              _id: jobId,
              type: "import_transactions",
              status: "running",
              stage: "uploading",
              clientId: safeClientId,
              total,
              processed,
              progressPct,
              createdAt,
            }])
          )
        }

        setJobs((current) =>
          upsertJobs(current, [{
            _id: jobId,
            type: "import_transactions",
            status: "done",
            stage: "done",
            clientId: safeClientId,
            total,
            processed: total,
            progressPct: 100,
            createdAt,
            completedAt: new Date().toISOString(),
            result: {
              insertedCount,
              totalRows,
              skippedRows,
              filesCount,
            },
          }])
        )
      } catch (jobError) {
        setJobs((current) =>
          upsertJobs(current, [{
            _id: jobId,
            type: "import_transactions",
            status: "failed",
            stage: "failed",
            clientId: safeClientId,
            total,
            processed: insertedCount,
            progressPct: total > 0
              ? Math.max(0, Math.min(100, Math.round((insertedCount / total) * 100)))
              : 0,
            createdAt,
            completedAt: new Date().toISOString(),
            errorMessage: jobError?.message || "Transactions import failed",
          }])
        )
      }
    }, 0)

    return { jobId }
  }, [])

  const dismissJob = useCallback((jobId) => {
    const target = String(jobId || "").trim()
    if (!target) return
    dismissedJobIdsRef.current.add(target)
    writeDismissedJobIdsToStorage(dismissedJobIdsRef.current)
    setJobs((current) => current.filter((job) => getJobId(job) !== target))
  }, [])

  const value = useMemo(() => ({
    jobs,
    startCategorizationJob,
    startTransactionsImportJob,
    refreshJobs,
    dismissJob,
  }), [jobs, startCategorizationJob, startTransactionsImportJob, refreshJobs, dismissJob])

  return (
    <CategorizationJobsContext.Provider value={value}>
      {children}
      <CategorizationJobsQueue jobs={jobs} clientNameById={clientNameById} onDismissJob={dismissJob} />
    </CategorizationJobsContext.Provider>
  )
}

export function useCategorizationJobs() {
  const context = useContext(CategorizationJobsContext)
  if (!context) {
    throw new Error("useCategorizationJobs must be used inside CategorizationJobsProvider")
  }
  return context
}
