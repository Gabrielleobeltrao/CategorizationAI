import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useNotification } from "../contexts/notification.context"
import { getMyUserProfile } from "../services/employees.service"
import { getOfficeHomeDashboard } from "../services/home.service"
import {
  getRecentOpenedClients,
  subscribeRecentOpenedClients,
} from "../utils/recentClients"
import { subscribeDashboardRefresh } from "../utils/dashboardRefresh"

function getQueueStatusClass(status) {
  const safe = String(status || "").toLowerCase()
  if (safe === "running") return "bg-sky-100 text-sky-700"
  if (safe === "queued") return "bg-amber-100 text-amber-700"
  if (safe === "failed") return "bg-rose-100 text-rose-700"
  if (safe === "done") return "bg-emerald-100 text-emerald-700"
  return "bg-gray-100 text-gray-700"
}

function formatOpenedAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const EMPTY_DASHBOARD = {
  header: {
    periodLabel: "-",
    lastSyncAt: "-",
    queueStatus: "idle",
  },
  kpis: [],
  weeklyTrend: [],
  jobsQueue: [],
  recentActivities: [],
}

function Home() {
  const navigate = useNavigate()
  const { error } = useNotification()
  const [recentClients, setRecentClients] = useState(() => getRecentOpenedClients())
  const [employee, setEmployee] = useState({
    id: "",
    name: "",
    officeId: "",
    role: "",
  })
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)

  const loadDashboard = useCallback(async (officeId, options = {}) => {
    const safeOfficeId = String(officeId || "").trim()
    const showLoading = Boolean(options?.showLoading)
    const notifyError = options?.notifyError !== false

    if (!safeOfficeId) {
      setDashboard(EMPTY_DASHBOARD)
      if (showLoading) setIsLoadingDashboard(false)
      return
    }

    if (showLoading) setIsLoadingDashboard(true)

    try {
      const payload = await getOfficeHomeDashboard(safeOfficeId, { noCache: true })
      setDashboard({
        header: payload?.header || EMPTY_DASHBOARD.header,
        kpis: Array.isArray(payload?.kpis) ? payload.kpis : [],
        weeklyTrend: Array.isArray(payload?.weeklyTrend) ? payload.weeklyTrend : [],
        jobsQueue: Array.isArray(payload?.jobsQueue) ? payload.jobsQueue : [],
        recentActivities: Array.isArray(payload?.recentActivities) ? payload.recentActivities : [],
      })
    } catch (err) {
      setDashboard(EMPTY_DASHBOARD)
      if (notifyError) {
        error(err.message || "Failed to load home dashboard")
      }
    } finally {
      if (showLoading) setIsLoadingDashboard(false)
    }
  }, [error])

  const maxWeekly = useMemo(() => {
    return Math.max(
      1,
      ...dashboard.weeklyTrend.flatMap((item) => [
        Number(item.imported || 0),
        Number(item.categorized || 0),
        Number(item.pending || 0),
      ])
    )
  }, [dashboard.weeklyTrend])

  useEffect(() => {
    setRecentClients(getRecentOpenedClients())
    const unsubscribe = subscribeRecentOpenedClients((items) => {
      setRecentClients(Array.isArray(items) ? items : [])
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    let active = true
    setIsLoadingDashboard(true)

    getMyUserProfile()
      .then((profile) => {
        if (!active) return

        const safeOfficeId = String(profile?.officeId || "").trim()
        setEmployee({
          id: String(profile?._id || ""),
          name: String(profile?.name || "User"),
          officeId: safeOfficeId,
          role: String(profile?.role || ""),
        })

        if (!safeOfficeId) {
          setDashboard(EMPTY_DASHBOARD)
          setIsLoadingDashboard(false)
        }
      })
      .catch((err) => {
        if (!active) return
        setDashboard(EMPTY_DASHBOARD)
        error(err.message || "Failed to load home dashboard")
        setIsLoadingDashboard(false)
      })

    return () => {
      active = false
    }
  }, [error])

  useEffect(() => {
    const safeOfficeId = String(employee.officeId || "").trim()
    if (!safeOfficeId) return undefined

    loadDashboard(safeOfficeId, {
      showLoading: true,
      notifyError: true,
    })

    const refreshSilently = () => {
      loadDashboard(safeOfficeId, {
        showLoading: false,
        notifyError: false,
      })
    }

    const refreshTimer = setInterval(refreshSilently, 15000)
    const unsubscribeDashboardRefresh = subscribeDashboardRefresh(refreshSilently)
    const onWindowFocus = () => refreshSilently()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSilently()
    }

    window.addEventListener("focus", onWindowFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      clearInterval(refreshTimer)
      unsubscribeDashboardRefresh()
      window.removeEventListener("focus", onWindowFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [employee.officeId, loadDashboard])

  return (
    <section className="w-full h-full min-h-0 overflow-auto p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Office Service Dashboard</h1>
              <p className="text-sm text-gray-500">
                {employee.name} ({employee.role})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Last sync: {dashboard.header.lastSyncAt}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getQueueStatusClass(dashboard.header.queueStatus)}`}>
                Queue: {dashboard.header.queueStatus}
              </span>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoadingDashboard && dashboard.kpis.length === 0 && (
            <article className="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2 xl:col-span-4">
              <p className="text-sm text-gray-500">Loading dashboard...</p>
            </article>
          )}
          {dashboard.kpis.map((kpi) => (
            <article key={kpi.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">{kpi.value}</h2>
              <p className="mt-1 text-sm text-gray-600">{kpi.trend}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Recently Opened Clients</h2>
          <p className="text-sm text-gray-500">Last 8 client contexts opened in this office</p>

          {recentClients.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">No clients opened yet</p>
          )}

          {recentClients.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              {recentClients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => navigate(client.to || `/clients/${client.id}/ledger`)}
                  >
                    <span className="truncate text-sm font-medium text-gray-900">{client.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-gray-500">{formatOpenedAt(client.openedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Weekly Trend</h2>
            <p className="text-sm text-gray-500">Imported, categorized and pending by week</p>

            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[680px] space-y-3">
                {dashboard.weeklyTrend.map((item) => (
                  <div key={item.week} className="grid grid-cols-[64px_minmax(0,1fr)_60px] items-center gap-2 text-sm">
                    <span className="text-gray-600">{item.week}</span>
                    <div className="space-y-1">
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-slate-500" style={{ width: `${Math.max(2, (item.imported / maxWeekly) * 100)}%` }} />
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.max(2, (item.categorized / maxWeekly) * 100)}%` }} />
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.max(2, (item.pending / maxWeekly) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-right text-xs text-gray-500">{item.imported.toLocaleString("en-US")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" /> Imported</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Categorized</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Pending</span>
            </div>
          </article>

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

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="text-sm text-gray-500">Latest office operations</p>

            <ul className="mt-4 flex max-h-[36.5rem] flex-col gap-2 overflow-y-auto pr-1">
              {dashboard.recentActivities.length === 0 && (
                <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No recent activities in the last 3 days
                </li>
              )}
              {dashboard.recentActivities.map((activity) => (
                <li key={activity.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{activity.detail}</p>
                </li>
              ))}
            </ul>
          </article>

          <aside className="flex flex-col gap-4">
            {/*
            <article className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-lg font-semibold">Office Alerts</h2>
              <p className="text-sm text-gray-500">Service signals requiring action</p>
              <ul className="mt-4 flex flex-col gap-2">
                {dashboard.alerts.map((alert) => (
                  <li key={alert} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {alert}
                  </li>
                ))}
              </ul>
            </article>
            */}

          </aside>
        </section>
      </div>
    </section>
  )
}

export default Home
