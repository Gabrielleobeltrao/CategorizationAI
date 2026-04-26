import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import {
  getCachedOfficeHomeDashboard,
  getOfficeHomeDashboard,
} from "../services/home.service"
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

function parseMetricValue(value) {
  const normalized = String(value || "")
    .replace(/,/g, "")
    .trim()

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const EMPTY_DASHBOARD = {
  header: {
    officeName: "Office",
    periodLabel: "-",
    lastSyncAt: "-",
    queueStatus: "idle",
  },
  kpis: [],
  weekKpis: [],
  weeklyTrend: [],
  dailyTrend: [],
  jobsQueue: [],
  recentActivities: [],
  meta: {},
}

const CHART_SERIES = [
  { key: "imported", label: "Imported", color: "#111827" },
  { key: "categorized", label: "Categorized", color: "#2563eb" },
  { key: "aiProcessed", label: "AI Processed", color: "#0f766e" },
  { key: "aiCategorized", label: "AI Categorized", color: "#16a34a" },
  { key: "pending", label: "Pending", color: "#d97706" },
]

const OVERVIEW_VIEW_STORAGE_KEY = "home.performanceOverview.view"
const OVERVIEW_PERIOD_STORAGE_KEY = "home.performanceOverview.period"
const ALLOWED_OVERVIEW_VIEWS = new Set(["blocks", "line", "columns"])
const ALLOWED_OVERVIEW_PERIODS = new Set(["month", "week"])

function normalizeDashboardPayload(payload = {}) {
  return {
    header: {
      ...EMPTY_DASHBOARD.header,
      ...(payload?.header || {}),
    },
    kpis: Array.isArray(payload?.kpis) ? payload.kpis : [],
    weekKpis: Array.isArray(payload?.weekKpis) ? payload.weekKpis : [],
    weeklyTrend: Array.isArray(payload?.weeklyTrend) ? payload.weeklyTrend : [],
    dailyTrend: Array.isArray(payload?.dailyTrend) ? payload.dailyTrend : [],
    jobsQueue: Array.isArray(payload?.jobsQueue) ? payload.jobsQueue : [],
    recentActivities: Array.isArray(payload?.recentActivities) ? payload.recentActivities : [],
    meta: payload?.meta || {},
  }
}

function readStoredOverviewOption(storageKey, allowedValues, fallbackValue) {
  if (typeof window === "undefined") return fallbackValue

  const storedValue = window.localStorage.getItem(storageKey)
  return allowedValues.has(storedValue) ? storedValue : fallbackValue
}

function OverviewTooltip({ active, payload, label }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-600">{item.name}</span>
            </div>
            <span className="font-semibold text-gray-900">
              {Number(item.value || 0).toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewChart({ data = [], chartType = "line", isWeek = false }) {
  return (
    <div className="mt-4 h-[22rem] rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "columns" ? (
            <BarChart
              data={data}
              margin={{ top: 16, right: 20, left: 0, bottom: 8 }}
              barCategoryGap={isWeek ? 18 : 28}
            >
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey={isWeek ? "day" : "week"} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<OverviewTooltip />} cursor={{ fill: "rgba(229, 231, 235, 0.22)" }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 18, fontSize: "12px" }} />
              {CHART_SERIES.map((serie) => (
                <Bar
                  key={serie.key}
                  dataKey={serie.key}
                  name={serie.label}
                  fill={serie.color}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={isWeek ? 32 : 28}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey={isWeek ? "day" : "week"} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<OverviewTooltip />} cursor={{ stroke: "#d1d5db", strokeWidth: 1 }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 18, fontSize: "12px" }} />
              {CHART_SERIES.map((serie) => (
                <Line
                  key={serie.key}
                  type="monotone"
                  dataKey={serie.key}
                  name={serie.label}
                  stroke={serie.color}
                  strokeWidth={isWeek ? 4 : 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{
                    r: isWeek ? 5 : 4,
                    stroke: "#ffffff",
                    strokeWidth: 2,
                    fill: serie.color,
                  }}
                  activeDot={{
                    r: isWeek ? 7 : 6,
                    stroke: "#ffffff",
                    strokeWidth: 2,
                    fill: serie.color,
                  }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const { error } = useNotification()
  const { profile } = useAuth()
  const [recentClients, setRecentClients] = useState(() => getRecentOpenedClients())
  const [employee, setEmployee] = useState({
    id: "",
    name: "",
    officeId: "",
    role: "",
  })
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
  const [overviewView, setOverviewView] = useState(() =>
    readStoredOverviewOption(
      OVERVIEW_VIEW_STORAGE_KEY,
      ALLOWED_OVERVIEW_VIEWS,
      "blocks"
    )
  )
  const [overviewPeriod, setOverviewPeriod] = useState(() =>
    readStoredOverviewOption(
      OVERVIEW_PERIOD_STORAGE_KEY,
      ALLOWED_OVERVIEW_PERIODS,
      "month"
    )
  )

  const loadDashboard = useCallback(async (officeId, options = {}) => {
    const safeOfficeId = String(officeId || "").trim()
    const showLoading = Boolean(options?.showLoading)
    const notifyError = options?.notifyError !== false
    const cachedDashboard = getCachedOfficeHomeDashboard(safeOfficeId)

    if (!safeOfficeId) {
      setDashboard(EMPTY_DASHBOARD)
      if (showLoading) setIsLoadingDashboard(false)
      return
    }

    if (cachedDashboard) {
      setDashboard(normalizeDashboardPayload(cachedDashboard))
      if (showLoading) setIsLoadingDashboard(false)
    } else if (showLoading) {
      setIsLoadingDashboard(true)
    }

    try {
      const payload = await getOfficeHomeDashboard(safeOfficeId, {
        noCache: true,
        backgroundLoadingMessage: cachedDashboard ? "Updating cached dashboard data..." : "",
      })
      setDashboard(normalizeDashboardPayload(payload))
    } catch (err) {
      if (!cachedDashboard) {
        setDashboard(EMPTY_DASHBOARD)
      }
      if (notifyError) {
        error(err.message || "Failed to load home dashboard")
      }
    } finally {
      if (showLoading) setIsLoadingDashboard(false)
    }
  }, [error])

  const monthMetricItems = useMemo(() => {
    return dashboard.kpis.map((item) => ({
      ...item,
      numericValue: parseMetricValue(item.value),
    }))
  }, [dashboard.kpis])

  const weekMetricItems = useMemo(() => {
    return dashboard.weekKpis.map((item) => ({
      ...item,
      numericValue: parseMetricValue(item.value),
    }))
  }, [dashboard.weekKpis])

  const activeMetricItems = overviewPeriod === "month" ? monthMetricItems : weekMetricItems
  const activeTrendData = overviewPeriod === "month" ? dashboard.weeklyTrend : dashboard.dailyTrend

  useEffect(() => {
    setRecentClients(getRecentOpenedClients())
    const unsubscribe = subscribeRecentOpenedClients((items) => {
      setRecentClients(Array.isArray(items) ? items : [])
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    window.localStorage.setItem(OVERVIEW_VIEW_STORAGE_KEY, overviewView)
  }, [overviewView])

  useEffect(() => {
    window.localStorage.setItem(OVERVIEW_PERIOD_STORAGE_KEY, overviewPeriod)
  }, [overviewPeriod])

  useEffect(() => {
    const safeOfficeId = String(profile?.officeId || "").trim()
    setEmployee({
      id: String(profile?._id || ""),
      name: String(profile?.name || "User"),
      officeId: safeOfficeId,
      role: String(profile?.role || ""),
    })

    if (!profile) {
      setDashboard(EMPTY_DASHBOARD)
      setIsLoadingDashboard(false)
    }
  }, [profile])

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
    <section className="w-full p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {dashboard.header.officeName || "Office"}
              </h1>
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

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Performance Overview</h2>
              <p className="text-sm text-gray-500">
                {overviewPeriod === "month"
                  ? "Office performance for the current month"
                  : "Office performance for the current week"}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    overviewView === "blocks"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600"
                  }`}
                  onClick={() => setOverviewView("blocks")}
                >
                  Blocks
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    overviewView === "line"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600"
                  }`}
                  onClick={() => setOverviewView("line")}
                >
                  Lines
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    overviewView === "columns"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600"
                  }`}
                  onClick={() => setOverviewView("columns")}
                >
                  Columns
                </button>
              </div>

              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    overviewPeriod === "month"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600"
                  }`}
                  onClick={() => setOverviewPeriod("month")}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    overviewPeriod === "week"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600"
                  }`}
                  onClick={() => setOverviewPeriod("week")}
                >
                  Week
                </button>
              </div>
            </div>
          </div>

          {isLoadingDashboard && dashboard.kpis.length === 0 && (
            <div className="mt-4 h-[22rem] rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Loading dashboard...</p>
            </div>
          )}

          {!isLoadingDashboard && overviewView === "blocks" && (
            <div className="mt-4 h-[22rem]">
              <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 md:auto-rows-fr xl:grid-cols-5 xl:auto-rows-auto">
                {activeMetricItems.map((kpi) => (
                <article
                  key={kpi.id}
                  className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
                  <h2 className="mt-1 text-2xl font-bold text-gray-900">{kpi.value}</h2>
                  <p className="mt-auto pt-3 text-sm text-gray-600">{kpi.trend}</p>
                </article>
                ))}
              </div>
            </div>
          )}

          {!isLoadingDashboard && overviewView !== "blocks" && (
            <OverviewChart
              data={activeTrendData}
              chartType={overviewView}
              isWeek={overviewPeriod === "week"}
            />
          )}
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

            <ul className="mt-4 flex flex-col gap-2">
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
