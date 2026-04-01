/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useNotification } from "./notification.context"
import {
  createCategorizationJob,
  getCategorizationJobById,
  listCategorizationJobs,
} from "../services/categorizationJobs.service"
import { getClientById } from "../services/clients.service"

const CategorizationJobsContext = createContext(null)

const TERMINAL_STATUSES = new Set(["done", "failed"])
const DISMISSED_JOBS_STORAGE_KEY = "categorization_jobs_dismissed_ids"

function getJobId(job = {}) {
  return String(job?._id || job?.id || job?.jobId || "")
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
            AI Categorization Queue
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

              return (
                <li key={id} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-gray-700">
                      Categorizing {clientName || "Client"}
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
                        {processed} / {total || 0} processed
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

  const refreshJobs = useCallback(async () => {
    try {
      const list = await listCategorizationJobs({ limit: 20 })
      const safeList = (Array.isArray(list) ? list : []).filter(
        (job) => !dismissedJobIdsRef.current.has(getJobId(job))
      )
      setJobs((current) => upsertJobs(current, safeList))
    } catch {
      // silent refresh
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshJobs()
    }, 0)
    return () => clearTimeout(timer)
  }, [refreshJobs])

  useEffect(() => {
    const timer = setInterval(() => {
      refreshJobs()
    }, 5000)
    return () => clearInterval(timer)
  }, [refreshJobs])

  useEffect(() => {
    const active = jobs.filter((job) => !TERMINAL_STATUSES.has(String(job?.status || "")))
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
    }, 1500)

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
      if (status === "done") {
        const totalProcessedCount = Number(job?.result?.totalProcessedCount || job?.processed || 0)
        success(`AI categorization completed: ${totalProcessedCount} transactions processed.`)
        notifiedIdsRef.current.add(id)
      } else if (status === "failed") {
        error(job?.errorMessage || "AI categorization failed.")
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
    refreshJobs,
    dismissJob,
  }), [jobs, startCategorizationJob, refreshJobs, dismissJob])

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
