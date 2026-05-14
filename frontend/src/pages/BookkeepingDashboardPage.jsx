import { useEffect, useState } from "react"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import {
  getCachedOfficeHomeDashboard,
  getOfficeHomeDashboard,
} from "../services/home.service"
import PerformanceOverview from "../components/dashboard/PerformanceOverview"

const EMPTY_DASHBOARD = {
  kpis: [],
  weekKpis: [],
  weeklyTrend: [],
  dailyTrend: [],
  recentActivities: [],
  jobsQueue: [],
}

function normalizeKpi(value) {
  if (!value || typeof value !== "object") return null
  return {
    id: String(value.id || value.label || "").trim(),
    label: String(value.label || "").trim(),
    value: value.value ?? "—",
    trend: value.trend || null,
  }
}

function normalizePayload(payload = {}) {
  return {
    kpis: Array.isArray(payload.kpis) ? payload.kpis.map(normalizeKpi).filter(Boolean) : [],
    weekKpis: Array.isArray(payload.weekKpis) ? payload.weekKpis.map(normalizeKpi).filter(Boolean) : [],
    weeklyTrend: Array.isArray(payload.weeklyTrend) ? payload.weeklyTrend : [],
    dailyTrend: Array.isArray(payload.dailyTrend) ? payload.dailyTrend : [],
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
  const { profile } = useAuth()
  const { error } = useNotification()
  const officeId = String(profile?.officeId || "").trim()

  const initialCached = officeId ? getCachedOfficeHomeDashboard(officeId) : null
  const [dashboard, setDashboard] = useState(initialCached ? normalizePayload(initialCached) : EMPTY_DASHBOARD)
  const [isLoading, setIsLoading] = useState(Boolean(officeId))

  useEffect(() => {
    if (!officeId) return undefined
    let active = true

    getOfficeHomeDashboard(officeId, { noCache: !initialCached })
      .then((dashboardPayload) => {
        if (!active) return
        if (dashboardPayload) {
          setDashboard(normalizePayload(dashboardPayload))
        }
      })
      .catch((err) => {
        if (active) error(err.message || "Failed to load bookkeeping dashboard")
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
    // initialCached is captured once at first render; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, officeId])

  return (
    <section className="w-full p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold">Bookkeeping Dashboard</h1>
          <p className="mt-2 text-sm text-gray-500">
            Office-wide accounting metrics and recent activity.
          </p>
        </header>

        {isLoading && dashboard.kpis.length === 0 ? (
          <p className="text-sm text-gray-500">Loading KPIs…</p>
        ) : (
          <PerformanceOverview
            title="Performance Overview"
            subtitleMonth="Office performance for the current month"
            subtitleWeek="Office performance for the current week"
            monthKpis={dashboard.kpis}
            weekKpis={dashboard.weekKpis}
            weeklyTrend={dashboard.weeklyTrend}
            dailyTrend={dashboard.dailyTrend}
            storageNamespace="bookkeeping.performanceOverview"
          />
        )}

        <section>
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <p className="text-sm text-gray-500">Latest office operations</p>
            <ul className="mt-4 flex flex-col gap-2">
              {dashboard.recentActivities.length === 0 && (
                <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No recent activities in the last 3 days
                </li>
              )}
              {dashboard.recentActivities.slice(0, 8).map((activity) => (
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

        <section>
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Live Jobs Queue</h2>
            <p className="text-sm text-gray-500">LLM and categorization pipeline status</p>

            <div className="mt-4 flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
              {dashboard.jobsQueue.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No active jobs right now
                </p>
              )}
              {dashboard.jobsQueue.map((job) => (
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
      </div>
    </section>
  )
}

export default BookkeepingDashboardPage
