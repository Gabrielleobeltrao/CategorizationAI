import { useEffect, useMemo, useState } from "react"
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

const DEFAULT_CHART_SERIES = [
  { key: "imported", label: "Imported", color: "#111827" },
  { key: "categorized", label: "Categorized", color: "#2563eb" },
  { key: "aiProcessed", label: "AI Processed", color: "#0f766e" },
  { key: "aiCategorized", label: "AI Categorized", color: "#16a34a" },
  { key: "pending", label: "Pending", color: "#d97706" },
]

const ALLOWED_VIEWS = new Set(["blocks", "line", "columns"])
const ALLOWED_PERIODS = new Set(["month", "week"])

function parseMetricValue(value) {
  const normalized = String(value || "").replace(/,/g, "").trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function readStoredOption(storageKey, allowedValues, fallbackValue) {
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
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
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

function OverviewChart({ data = [], chartType = "line", isWeek = false, series = DEFAULT_CHART_SERIES }) {
  return (
    <div className="mt-4 h-[22rem] rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "columns" ? (
            <BarChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 8 }} barCategoryGap={isWeek ? 18 : 28}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey={isWeek ? "day" : "week"} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<OverviewTooltip />} cursor={{ fill: "rgba(229, 231, 235, 0.22)" }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 18, fontSize: "12px" }} />
              {series.map((serie) => (
                <Bar key={serie.key} dataKey={serie.key} name={serie.label} fill={serie.color} radius={[8, 8, 0, 0]} maxBarSize={isWeek ? 32 : 28} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey={isWeek ? "day" : "week"} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<OverviewTooltip />} cursor={{ stroke: "#d1d5db", strokeWidth: 1 }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 18, fontSize: "12px" }} />
              {series.map((serie) => (
                <Line
                  key={serie.key}
                  type="monotone"
                  dataKey={serie.key}
                  name={serie.label}
                  stroke={serie.color}
                  strokeWidth={isWeek ? 4 : 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{ r: isWeek ? 5 : 4, stroke: "#ffffff", strokeWidth: 2, fill: serie.color }}
                  activeDot={{ r: isWeek ? 7 : 6, stroke: "#ffffff", strokeWidth: 2, fill: serie.color }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * Props:
 * - title, subtitleMonth, subtitleWeek: text
 * - monthKpis, weekKpis: array of { id, label, value, trend }
 * - weeklyTrend, dailyTrend: array of data points for the chart
 * - chartSeries?: override the default 5 series
 * - storageNamespace: key prefix for localStorage view/period state (so different dashboards remember independently)
 * - showChart?: whether to render the chart toggle + chart (default true)
 */
function PerformanceOverview({
  title = "Performance Overview",
  subtitleMonth = "Office performance for the current month",
  subtitleWeek = "Office performance for the current week",
  monthKpis = [],
  weekKpis = [],
  weeklyTrend = [],
  dailyTrend = [],
  chartSeries = DEFAULT_CHART_SERIES,
  storageNamespace = "dashboard.performanceOverview",
  showChart = true,
}) {
  const viewKey = `${storageNamespace}.view`
  const periodKey = `${storageNamespace}.period`
  const [view, setView] = useState(() => readStoredOption(viewKey, ALLOWED_VIEWS, "blocks"))
  const [period, setPeriod] = useState(() => readStoredOption(periodKey, ALLOWED_PERIODS, "month"))

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(viewKey, view)
  }, [view, viewKey])

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(periodKey, period)
  }, [period, periodKey])

  const monthItems = useMemo(
    () => monthKpis.map((item) => ({ ...item, numericValue: parseMetricValue(item.value) })),
    [monthKpis]
  )
  const weekItems = useMemo(
    () => weekKpis.map((item) => ({ ...item, numericValue: parseMetricValue(item.value) })),
    [weekKpis]
  )

  const activeItems = period === "month" ? monthItems : weekItems
  const activeTrend = period === "month" ? weeklyTrend : dailyTrend

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-500">{period === "month" ? subtitleMonth : subtitleWeek}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-200 p-0.5">
            {[
              { id: "month", label: "Month" },
              { id: "week", label: "Week" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriod(option.id)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === option.id ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {showChart && (
            <div className="inline-flex rounded-md border border-gray-200 p-0.5">
              {[
                { id: "blocks", label: "Blocks" },
                { id: "line", label: "Line" },
                { id: "columns", label: "Columns" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setView(option.id)}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === option.id ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "blocks" || !showChart ? (
        activeItems.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            No KPIs available for this period.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {activeItems.map((item) => (
              <article key={item.id || item.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</p>
                {item.trend && <p className="mt-1 text-xs text-gray-500">{item.trend}</p>}
              </article>
            ))}
          </div>
        )
      ) : (
        <OverviewChart data={activeTrend} chartType={view} isWeek={period === "week"} series={chartSeries} />
      )}
    </section>
  )
}

export default PerformanceOverview
