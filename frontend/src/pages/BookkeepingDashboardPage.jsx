import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import {
  getOfficeHomeDashboardFeed,
  getOfficeHomeDashboardCustomRange,
} from "../services/home.service"
import { listClientsByOfficeId } from "../services/clients.service"
import { listEmployeesByOfficeId } from "../services/employees.service"
import PerformanceOverview from "../components/dashboard/PerformanceOverview"
import OverviewScopeFilter from "../components/dashboard/OverviewScopeFilter"

const EMPTY_FEED = { recentActivities: [], jobsQueue: [] }

function normalizeFeed(payload = {}) {
  return {
    recentActivities: Array.isArray(payload.recentActivities) ? payload.recentActivities : [],
    jobsQueue: Array.isArray(payload.jobsQueue) ? payload.jobsQueue : [],
  }
}

function getQueueStatusClass(status) {
  const safe = String(status || "").toLowerCase()
  if (safe === "running") return "bg-sky-100 text-sky-700"
  if (safe === "queued") return "bg-amber-100 text-amber-700"
  if (safe === "failed") return "bg-rose-100 text-rose-700"
  if (safe === "done") return "bg-emerald-100 text-emerald-700"
  return "bg-gray-100 text-gray-700"
}

function BookkeepingDashboardPage() {
  const { profile, office } = useAuth()
  const { error } = useNotification()
  const officeId = String(profile?.officeId || "").trim()
  const officeName = String(office?.name || "").trim()

  const [feed, setFeed] = useState(EMPTY_FEED)
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [scopeMode, setScopeMode] = useState("team")
  const [scopeId, setScopeId] = useState("")
  const [customRange, setCustomRange] = useState(null)
  const [customData, setCustomData] = useState({ kpis: [], trend: [] })
  const [isCustomLoading, setIsCustomLoading] = useState(false)

  const scopeOptions = useMemo(() => {
    if (scopeMode === "client" && scopeId) return { clientId: scopeId }
    if (scopeMode === "user" && scopeId) return { actorId: scopeId }
    return {}
  }, [scopeMode, scopeId])

  useEffect(() => {
    if (!officeId) return undefined
    let active = true

    Promise.all([
      listClientsByOfficeId(officeId, { limit: 500 }).catch(() => null),
      listEmployeesByOfficeId(officeId).catch(() => null),
    ]).then(([clientList, employeeList]) => {
      if (!active) return
      const clientItems = Array.isArray(clientList?.items)
        ? clientList.items
        : Array.isArray(clientList)
          ? clientList
          : []
      const employeeItems = Array.isArray(employeeList?.items)
        ? employeeList.items
        : Array.isArray(employeeList)
          ? employeeList
          : []
      setClients(clientItems)
      setEmployees(employeeItems)
    })

    return () => { active = false }
  }, [officeId])

  useEffect(() => {
    if (!officeId) return undefined
    let active = true

    getOfficeHomeDashboardFeed(officeId, scopeOptions)
      .then((payload) => {
        if (active && payload) setFeed(normalizeFeed(payload))
      })
      .catch((err) => {
        if (active) error(err.message || "Failed to load activity feed")
      })

    return () => { active = false }
  }, [error, officeId, scopeOptions])

  useEffect(() => {
    if (!officeId || !customRange?.from || !customRange?.to) return undefined
    let active = true
    setIsCustomLoading(true)

    getOfficeHomeDashboardCustomRange(officeId, {
      from: customRange.from,
      to: customRange.to,
      ...scopeOptions,
    })
      .then((payload) => {
        if (!active) return
        setCustomData({
          kpis: Array.isArray(payload?.kpis) ? payload.kpis : [],
          trend: Array.isArray(payload?.trend) ? payload.trend : [],
        })
      })
      .catch((err) => {
        if (active) error(err.message || "Failed to load custom range")
      })
      .finally(() => {
        if (active) setIsCustomLoading(false)
      })

    return () => { active = false }
  }, [error, officeId, customRange, scopeOptions])

  return (
    <section className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Bookkeeping Overview</h1>
            <p className="mt-2 text-sm text-gray-500">
              Office-wide accounting metrics and recent activity.
            </p>
          </div>
          <OverviewScopeFilter
            mode={scopeMode}
            scopeId={scopeId}
            onChange={({ mode, scopeId: nextScopeId }) => {
              setScopeMode(mode)
              setScopeId(nextScopeId)
            }}
            clients={clients}
            users={employees}
            officeName={officeName}
          />
        </header>

        <PerformanceOverview
          title="Performance Overview"
          subtitle="Office performance for the selected range"
          kpis={customData.kpis}
          trend={customData.trend}
          range={customRange}
          onRangeChange={setCustomRange}
          isLoading={isCustomLoading}
        />

        <section>
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Live Jobs Queue</h2>
            <p className="text-sm text-gray-500">AI categorization pipeline status</p>

            <div className="mt-4 flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
              {feed.jobsQueue.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No active jobs right now
                </p>
              )}
              {feed.jobsQueue.map((job) => (
                <div key={job.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{job.client}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getQueueStatusClass(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {job.label || "Job"} • {job.processed}/{job.total} • {job.updatedAt}
                  </p>
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-gray-700" style={{ width: `${Math.max(2, job.progress)}%` }} />
                  </div>
                  {job.error && <p className="mt-2 text-xs text-rose-600">{job.error}</p>}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section>
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <p className="text-sm text-gray-500">Latest office operations</p>
            <ul className="mt-4 flex flex-col gap-2">
              {feed.recentActivities.length === 0 && (
                <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No recent activities in the last 3 days
                </li>
              )}
              {feed.recentActivities.slice(0, 8).map((activity) => (
                <li key={activity.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                  {activity.detail && (
                    <p className="mt-1 text-sm text-gray-600">{activity.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </article>
        </section>
      </div>
    </section>
  )
}

export default BookkeepingDashboardPage
