import { useEffect, useMemo, useState } from "react"
import DateRangePicker from "../ui/DateRangePicker"
import {
  CartesianGrid,
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

function toIsoDate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function parseMetricValue(value) {
  const normalized = String(value || "").replace(/,/g, "").trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
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

function SeriesToggleLegend({ series, hiddenKeys, onToggle }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-2">
      {series.map((serie) => {
        const isHidden = hiddenKeys.has(serie.key)
        return (
          <button
            key={serie.key}
            type="button"
            onClick={() => onToggle(serie.key)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
              isHidden
                ? "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            aria-pressed={!isHidden}
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                isHidden ? "border-gray-300 bg-white" : "border-gray-700"
              }`}
              style={!isHidden ? { backgroundColor: serie.color, borderColor: serie.color } : undefined}
              aria-hidden="true"
            >
              {!isHidden && (
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span className={isHidden ? "line-through" : ""}>{serie.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function OverviewChart({ data = [], xKey = "bucket", series = DEFAULT_CHART_SERIES }) {
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set())
  const toggleSeries = (key) => {
    setHiddenKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const allHidden = hiddenKeys.size === series.length && series.length > 0

  return (
    <div className="flex h-full min-h-[22rem] flex-col rounded-xl border border-gray-200 bg-gray-50 p-4">
      <SeriesToggleLegend series={series} hiddenKeys={hiddenKeys} onToggle={toggleSeries} />
      <div className="flex-1">
        {allHidden ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            Select at least one series to display.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<OverviewTooltip />} cursor={{ stroke: "#d1d5db", strokeWidth: 1 }} />
              {series.map((serie) => (
                <Line
                  key={serie.key}
                  type="monotone"
                  dataKey={serie.key}
                  name={serie.label}
                  stroke={serie.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  hide={hiddenKeys.has(serie.key)}
                  dot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: serie.color }}
                  activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2, fill: serie.color }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/**
 * Props:
 * - title, subtitle: text
 * - kpis: array of { id, label, value, trend }
 * - trend: chart data array (x dimension keyed by chartXKey)
 * - range: { from, to } current selected range (ISO date strings)
 * - onRangeChange({ from, to }): fired when user picks a new range
 * - isLoading?: shows loading state on date picker
 * - chartSeries?: override the default series
 * - chartXKey?: data key for the chart x-axis (default "bucket")
 * - showChart?: whether to render the trend chart (default true)
 */
function PerformanceOverview({
  title = "Performance Overview",
  subtitle = "Office performance for the selected range",
  kpis = [],
  trend = [],
  range = null,
  onRangeChange,
  isLoading = false,
  chartSeries = DEFAULT_CHART_SERIES,
  chartXKey = "bucket",
  showChart = true,
  footer = null,
}) {
  const defaultRange = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - 13)
    return { from: toIsoDate(start), to: toIsoDate(today) }
  }, [])
  const [draftRange, setDraftRange] = useState(() => ({
    from: range?.from || defaultRange.from,
    to: range?.to || defaultRange.to,
  }))

  useEffect(() => {
    if (range?.from && range?.to) {
      setDraftRange({ from: range.from, to: range.to })
      return
    }
    onRangeChange?.(defaultRange)
  }, [range?.from, range?.to, defaultRange, onRangeChange])

  const items = useMemo(
    () => kpis.map((item) => ({ ...item, numericValue: parseMetricValue(item.value) })),
    [kpis]
  )
  const hasChartData = Array.isArray(trend) && trend.length > 0

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>

        <DateRangePicker
          value={draftRange}
          onChange={(next) => {
            setDraftRange(next)
            onRangeChange?.(next)
          }}
          isLoading={isLoading}
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No KPIs available for this range.
        </p>
      ) : showChart && hasChartData ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <article
                key={item.id || item.label}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                  {item.trend && <p className="mt-0.5 text-[11px] text-gray-500">{item.trend}</p>}
                </div>
                <p className="shrink-0 text-xl font-semibold text-gray-900">{item.value}</p>
              </article>
            ))}
          </div>
          <div className="min-h-[22rem]">
            <OverviewChart data={trend} xKey={chartXKey} series={chartSeries} />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <article key={item.id || item.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</p>
              {item.trend && <p className="mt-1 text-xs text-gray-500">{item.trend}</p>}
            </article>
          ))}
        </div>
      )}

      {footer && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          {footer}
        </div>
      )}
    </section>
  )
}

export default PerformanceOverview
