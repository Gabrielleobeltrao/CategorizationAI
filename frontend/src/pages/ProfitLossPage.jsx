import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { getClientById } from "../services/clients.service"
import { useOpenTest } from "../contexts/openTest.context"
import {
  getCachedProfitLossByClientId,
  getCachedProfitLossPeriodOptionsByClientId,
  getProfitLossByClientId,
  getProfitLossPeriodOptionsByClientId,
} from "../services/profitLoss.service"
import { useNotification } from "../contexts/notification.context"
import { downloadProfitLossPdf } from "../utils/pdf"
import DateRangePicker from "../components/ui/DateRangePicker"
import { trackClientOpened } from "../utils/recentClients"
import {
  formatAbsoluteCurrency,
  getProfitLossAmountPresentation,
  getProfitLossKpiPresentation,
} from "../utils/amountPresentation"

function getProfitLossYearStorageKey(clientId = "") {
  return `profit-loss:selected-year:${String(clientId || "").trim() || "global"}`
}

function readStoredProfitLossYear(clientId = "") {
  if (typeof window === "undefined") return ""

  try {
    return String(window.localStorage.getItem(getProfitLossYearStorageKey(clientId)) || "").trim()
  } catch {
    return ""
  }
}

function writeStoredProfitLossYear(clientId = "", year = "") {
  if (typeof window === "undefined") return

  try {
    const safeYear = String(year || "").trim()
    if (!safeYear) {
      window.localStorage.removeItem(getProfitLossYearStorageKey(clientId))
      return
    }
    window.localStorage.setItem(getProfitLossYearStorageKey(clientId), safeYear)
  } catch {
    // ignore storage errors
  }
}

function getDefaultDateRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 0))
  return {
    fromDate: start.toISOString().slice(0, 10),
    toDate: end.toISOString().slice(0, 10),
  }
}

function getInitialFilter(clientId = "") {
  const { fromDate, toDate } = getDefaultDateRange()
  return {
    mode: "YEAR",
    year: readStoredProfitLossYear(clientId),
    month: "",
    fromDate,
    toDate,
  }
}

function normalizePeriodOptions(payload) {
  const years = Array.isArray(payload?.years)
    ? [...new Set(payload.years.map((item) => String(item || "").trim()).filter((item) => /^\d{4}$/.test(item)))]
        .sort((a, b) => b.localeCompare(a))
    : []
  const months = Array.isArray(payload?.months)
    ? [...new Set(payload.months.map((item) => String(item || "").trim()).filter((item) => /^\d{4}-\d{2}$/.test(item)))]
        .sort((a, b) => b.localeCompare(a))
    : []
  return { years, months }
}

function arePeriodOptionsEqual(a = {}, b = {}) {
  const aYears = Array.isArray(a?.years) ? a.years : []
  const bYears = Array.isArray(b?.years) ? b.years : []
  const aMonths = Array.isArray(a?.months) ? a.months : []
  const bMonths = Array.isArray(b?.months) ? b.months : []

  return (
    aYears.length === bYears.length &&
    aMonths.length === bMonths.length &&
    aYears.every((value, index) => value === bYears[index]) &&
    aMonths.every((value, index) => value === bMonths[index])
  )
}

function resolveFilterForOptions(filter, periodOptions, clientId = "") {
  const next = {
    ...getInitialFilter(clientId),
    ...(filter || {}),
  }
  const years = Array.isArray(periodOptions?.years) ? periodOptions.years : []
  const months = Array.isArray(periodOptions?.months) ? periodOptions.months : []
  const storedYear = readStoredProfitLossYear(clientId)

  if (!['ALL', 'MONTH', 'YEAR', 'RANGE'].includes(next.mode)) {
    next.mode = 'YEAR'
  }

  if (next.mode === "YEAR") {
    if (!years.includes(next.year)) {
      next.year = storedYear && years.includes(storedYear) ? storedYear : years[0] || ""
    }
  }

  if (next.mode === "MONTH" && !months.includes(next.month)) {
    next.month = months[0] || ""
  }

  return next
}

function areFiltersEqual(a = {}, b = {}) {
  return (
    a.mode === b.mode &&
    a.year === b.year &&
    a.month === b.month &&
    a.fromDate === b.fromDate &&
    a.toDate === b.toDate
  )
}

function isValidDate(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
}

function isFilterReady(filter) {
  if (!filter?.mode) return false
  if (filter.mode === "ALL") return true
  if (filter.mode === "YEAR") return /^\d{4}$/.test(String(filter.year || ""))
  if (filter.mode === "MONTH") return /^\d{4}-\d{2}$/.test(String(filter.month || ""))
  if (filter.mode === "RANGE") {
    return isValidDate(filter.fromDate) && isValidDate(filter.toDate) && filter.fromDate <= filter.toDate
  }
  return false
}

function getProfitLossRequestOptions(filter) {
  if (filter.mode === "ALL") return { period: "ALL" }
  if (filter.mode === "YEAR") return { period: "YEAR", year: filter.year }
  if (filter.mode === "MONTH") return { period: "MONTH", month: filter.month }
  return {
    period: "RANGE",
    fromDate: filter.fromDate,
    toDate: filter.toDate,
  }
}

function getProfitLossRequestKey(clientId, filter) {
  if (!clientId || !isFilterReady(filter)) return ""
  return JSON.stringify({ clientId, ...getProfitLossRequestOptions(filter) })
}

function formatPeriodLabel(value) {
  const [prefix, raw] = String(value || "").split(":")
  if (String(value || "").toUpperCase() === "ALL") return "All time"
  if (!raw) return value
  if (prefix === "RANGE") return raw.replace("->", " to ")
  return raw
}

function formatMonthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return String(value || "")
  const [yearValue, monthValue] = value.split("-")
  const date = new Date(`${yearValue}-${monthValue}-01T00:00:00Z`)
  const monthLabel = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
  return `${monthLabel} ${yearValue}`
}

function ProfitLossPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { error } = useNotification()
  const [filter, setFilter] = useState(() => getInitialFilter(clientId))
  const [periodOptions, setPeriodOptions] = useState({ months: [], years: [] })
  const [periodOptionsLoaded, setPeriodOptionsLoaded] = useState(false)
  const [showPercentView, setShowPercentView] = useState(false)
  const [client, setClient] = useState(null)
  const [profitLoss, setProfitLoss] = useState(null)
  const [isFetchingProfitLoss, setIsFetchingProfitLoss] = useState(false)
  const profitLossRef = useRef(null)
  const requestKey = useMemo(() => getProfitLossRequestKey(clientId, filter), [clientId, filter])
  const { config: openTestConfig } = useOpenTest()

  const monthOptions = useMemo(
    () => periodOptions.months.map((value) => ({ value, label: formatMonthLabel(value) })),
    [periodOptions.months]
  )
  const yearOptions = periodOptions.years

  useEffect(() => {
    profitLossRef.current = profitLoss
  }, [profitLoss])

  useEffect(() => {
    setFilter(getInitialFilter(clientId))
    setPeriodOptions({ months: [], years: [] })
    setPeriodOptionsLoaded(false)
    setProfitLoss(null)
    setIsFetchingProfitLoss(false)
  }, [clientId])

  useEffect(() => {
    let active = true

    if (!clientId) {
      setClient(null)
      return () => {
        active = false
      }
    }

    getClientById(clientId)
      .then((clientData) => {
        if (!active) return
        setClient(clientData || null)
      })
      .catch(() => {
        if (!active) return
        setClient(null)
      })

    return () => {
      active = false
    }
  }, [clientId])

  useEffect(() => {
    if (!clientId || !client?.name) return
    trackClientOpened({
      id: clientId,
      name: client.name,
      to: `/clients/${clientId}/profit-loss`,
    })
  }, [clientId, client?.name])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    if (!clientId) {
      setPeriodOptionsLoaded(true)
      return () => {
        active = false
        controller.abort()
      }
    }

    const applyOptions = (payload) => {
      const normalized = normalizePeriodOptions(payload)
      setPeriodOptions((current) => (arePeriodOptionsEqual(current, normalized) ? current : normalized))
      setFilter((current) => {
        const resolved = resolveFilterForOptions(current, normalized, clientId)
        return areFiltersEqual(current, resolved) ? current : resolved
      })
    }

    const cachedOptions = getCachedProfitLossPeriodOptionsByClientId(clientId)
    if (cachedOptions) {
      applyOptions(cachedOptions)
      setPeriodOptionsLoaded(true)
    }

    getProfitLossPeriodOptionsByClientId(clientId, {
      silentLoading: true,
      signal: controller.signal,
    })
      .then((payload) => {
        if (!active) return
        applyOptions(payload)
        setPeriodOptionsLoaded(true)
      })
      .catch((err) => {
        if (!active || err?.name === "AbortError") return
        if (!cachedOptions) {
          setPeriodOptions({ months: [], years: [] })
          setPeriodOptionsLoaded(true)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [clientId])

  useEffect(() => {
    if (filter.mode !== "YEAR" || !clientId || !filter.year) return
    writeStoredProfitLossYear(clientId, filter.year)
  }, [clientId, filter.mode, filter.year])

  useEffect(() => {
    if (!clientId || !requestKey) {
      setIsFetchingProfitLoss(false)
      return undefined
    }

    let active = true
    const controller = new AbortController()
    const requestOptions = getProfitLossRequestOptions(filter)
    const cachedProfitLoss = getCachedProfitLossByClientId(clientId, requestOptions)

    if (cachedProfitLoss) {
      setProfitLoss(cachedProfitLoss)
      setIsFetchingProfitLoss(false)
    } else {
      setIsFetchingProfitLoss(true)
    }

    getProfitLossByClientId(clientId, {
      ...requestOptions,
      silentLoading: true,
      signal: controller.signal,
    })
      .then((payload) => {
        if (!active) return
        setProfitLoss(payload || null)
      })
      .catch((err) => {
        if (!active || err?.name === "AbortError") return
        if (!cachedProfitLoss && !profitLossRef.current) setProfitLoss(null)
        error(err.message || "Failed to load profit and loss")
      })
      .finally(() => {
        if (!active) return
        setIsFetchingProfitLoss(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [clientId, requestKey, filter, error])

  const revenueBase = useMemo(() => {
    const revenueLine = profitLoss?.statement.find((line) => line.id === "revenue")
    if (!revenueLine) return 1
    return Math.max(1, Math.abs(revenueLine.amount))
  }, [profitLoss])

  const formula = useMemo(() => {
    const income = profitLoss?.kpis.find((kpi) => kpi.id === "revenue")?.value ?? 0
    const grossProfit = profitLoss?.kpis.find((kpi) => kpi.id === "gross_profit")?.value ?? 0
    const operatingIncome = profitLoss?.kpis.find((kpi) => kpi.id === "operating_income")?.value ?? 0
    const pretaxIncome = profitLoss?.kpis.find((kpi) => kpi.id === "pretax_income")?.value ?? operatingIncome
    const netIncome = profitLoss?.kpis.find((kpi) => kpi.id === "net_income")?.value ?? 0

    const otherIncomeLine = profitLoss?.statement?.find((line) => line.id === "other_income")
    const otherExpenseLine = profitLoss?.statement?.find((line) => line.id === "other_expense")
    const taxExpenseLine = profitLoss?.statement?.find((line) => line.id === "tax_expense")

    const otherIncome = otherIncomeLine?.amount ?? 0
    const otherExpense = otherExpenseLine ? -otherExpenseLine.amount : 0
    const taxExpense = taxExpenseLine ? -taxExpenseLine.amount : 0

    return {
      income,
      costOfGoodsSold: income - grossProfit,
      operatingExpenses: grossProfit - operatingIncome,
      operatingIncome,
      otherIncome,
      otherExpense,
      pretaxIncome,
      taxExpense,
      netIncome,
      hasAdjustments: otherIncome !== 0 || otherExpense !== 0 || taxExpense !== 0,
    }
  }, [profitLoss])

  const netIncomeColorClass = useMemo(() => {
    if (formula.netIncome > 0) return "text-emerald-700"
    return "text-gray-900"
  }, [formula.netIncome])

  const isBlockingLoading = isFetchingProfitLoss && !profitLoss
  const hasNoReport = periodOptionsLoaded && !profitLoss && !isBlockingLoading

  const setMode = (mode) => {
    setFilter((current) => {
      const resolved = resolveFilterForOptions({ ...current, mode }, periodOptions, clientId)
      return areFiltersEqual(current, resolved) ? current : resolved
    })
  }

  const setYearFilter = (year) => {
    setFilter((current) => {
      const next = { ...current, mode: "YEAR", year }
      return areFiltersEqual(current, next) ? current : next
    })
  }

  const setMonthFilter = (month) => {
    setFilter((current) => {
      const next = { ...current, mode: "MONTH", month }
      return areFiltersEqual(current, next) ? current : next
    })
  }

  const setRangeField = (field, value) => {
    setFilter((current) => {
      const next = { ...current, mode: "RANGE", [field]: value }
      return areFiltersEqual(current, next) ? current : next
    })
  }

  const getLineWeightClass = (lineType) => {
    if (lineType === "total") return "font-bold"
    if (lineType === "group") return "font-semibold"
    return "font-normal"
  }

  const goToLedgerWithCategory = (line) => {
    const safeClientId = String(clientId || "").trim()
    const categoryLabel = String(line?.label || "").trim()
    if (!safeClientId || !categoryLabel) return
    const lowerLabel = categoryLabel.toLowerCase()
    const normalizedCategory = lowerLabel.includes("uncategorized income")
      ? "uncategorized income"
      : lowerLabel.includes("uncategorized expenses")
        ? "uncategorized expenses"
        : lowerLabel.includes("uncategorized")
          ? "uncategorized"
          : categoryLabel
    navigate(`/clients/${safeClientId}/ledger?category=${encodeURIComponent(normalizedCategory)}`)
  }

  const handleDownloadPdf = () => {
    if (!profitLoss) return

    const periodValue = profitLoss ? formatPeriodLabel(profitLoss.period) : "-"
    const clientName = client?.name || "Unknown client"
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`

    const safeClientSlug = clientName.replace(/\s+/g, "-").toLowerCase()
    const incomeKpi = getProfitLossKpiPresentation({ amount: formula.income, kind: "income" })
    const cogsKpi = getProfitLossKpiPresentation({ amount: formula.costOfGoodsSold, kind: "expense" })
    const operatingKpi = getProfitLossKpiPresentation({ amount: formula.operatingExpenses, kind: "expense" })
    const netIncomeKpi = getProfitLossKpiPresentation({ amount: formula.netIncome, kind: "net" })
    const kpis = [
      { id: "income", label: "Income", value: formula.income, displayValue: incomeKpi.text, pdfColor: incomeKpi.pdfColor },
      {
        id: "cost_of_goods_sold",
        label: "Cost of Goods Sold",
        value: formula.costOfGoodsSold,
        displayValue: cogsKpi.text,
        pdfColor: cogsKpi.pdfColor,
      },
      {
        id: "operating_expenses",
        label: "Operating Expenses",
        value: formula.operatingExpenses,
        displayValue: operatingKpi.text,
        pdfColor: operatingKpi.pdfColor,
      },
      { id: "net_income", label: "Net Income", value: formula.netIncome, displayValue: netIncomeKpi.text, pdfColor: netIncomeKpi.pdfColor },
    ]

    const statementRows = (Array.isArray(profitLoss.statement) ? profitLoss.statement : []).map((line) => ({
      label: line.label,
      level: line.level,
      type: line.type,
      presentationType: line.presentationType || "net",
      rawAmount: Number(line.amount || 0),
      amountText: getProfitLossAmountPresentation({ amount: line.amount }).text,
      amountPdfColor: getProfitLossAmountPresentation({ amount: line.amount }).pdfColor,
    }))

    downloadProfitLossPdf({
      filename: `profit-loss-${safeClientSlug}-${timestamp}.pdf`,
      title: "Profit & Loss",
      clientName,
      periodLabel: periodValue,
      generatedAt: now.toLocaleString("en-US"),
      kpis,
      statementRows,
    })
  }

  const handleDownloadCsv = () => {
    if (!profitLoss) return

    const periodValue = formatPeriodLabel(profitLoss.period)
    const clientName = client?.name || "Unknown client"
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`
    const safeClientSlug = clientName.replace(/\s+/g, "-").toLowerCase()

    const escape = (value) => {
      const safe = String(value ?? "").replace(/"/g, '""')
      return /[",\n]/.test(safe) ? `"${safe}"` : safe
    }

    const lines = [
      `Profit & Loss - ${clientName}`,
      `Period: ${periodValue}`,
      "",
      ["Label", "Amount", "Type", "Level"].map(escape).join(","),
    ]
    for (const row of Array.isArray(profitLoss.statement) ? profitLoss.statement : []) {
      lines.push([row.label, Number(row.amount || 0), row.type || "", row.level ?? ""].map(escape).join(","))
    }

    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `profit-loss-${safeClientSlug}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="w-full px-12 py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          <header className="flex h-full flex-col justify-between gap-8">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900">Profit & Loss</h1>
              <p className="text-sm text-gray-500">
                Period: {profitLoss ? formatPeriodLabel(profitLoss.period) : (isBlockingLoading ? "Loading..." : "-")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={!profitLoss}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!profitLoss}
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                PDF
              </button>
            </div>
          </header>

          <div className="flex h-full flex-col justify-center rounded-xl border border-gray-200 bg-white p-4">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Period filter
          </span>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-white p-1">
              {[
                { value: "ALL", label: "All" },
                { value: "MONTH", label: "Month" },
                { value: "YEAR", label: "Year" },
                { value: "RANGE", label: "Manual" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
                    filter.mode === item.value
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setMode(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filter.mode === "MONTH" && (
              <div className="w-full overflow-x-auto">
                <div className="flex h-8 min-w-max items-center gap-1.5">
                  {monthOptions.length === 0 && (
                    <span className="text-xs text-gray-500">
                      {periodOptionsLoaded ? "No months available" : "Loading months..."}
                    </span>
                  )}
                  {monthOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-md px-2 py-1.5 text-xs ${
                        filter.month === option.value
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                      }`}
                      onClick={() => setMonthFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filter.mode === "YEAR" && (
              <div className="w-full overflow-x-auto">
                <div className="flex h-8 min-w-max items-center gap-1.5">
                  {yearOptions.length === 0 && (
                    <span className="text-xs text-gray-500">
                      {periodOptionsLoaded ? "No years available" : "Loading years..."}
                    </span>
                  )}
                  {yearOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-md px-2 py-1.5 text-xs ${
                        filter.year === option
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                      }`}
                      onClick={() => setYearFilter(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filter.mode === "RANGE" && (
              <DateRangePicker
                value={{ from: filter.fromDate, to: filter.toDate }}
                onChange={(next) => {
                  setRangeField("fromDate", next.from)
                  setRangeField("toDate", next.to)
                }}
              />
            )}
          </div>
        </div>
        </div>

        {openTestConfig?.enabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Private beta notice</p>
            <p className="mt-1">
              Profit & loss totals can still change while AI categorization is being validated in private beta. Review uncategorized lines, recent AI results and final totals before using this statement in real work. Some reports may take longer to load while the final infrastructure is not in place.
            </p>
          </div>
        )}

        {hasNoReport && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Profit & Loss data not found for this client.
          </div>
        )}

        {isBlockingLoading && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Loading Profit & Loss...
          </div>
        )}

        {profitLoss && (
          <div className="relative">
            <section className="w-full pb-3">
              <article className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="m-3">
                  <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(170px,1fr)_32px_minmax(220px,1fr)_32px_minmax(220px,1fr)_32px_minmax(180px,1fr)] lg:items-end lg:gap-x-2 lg:gap-y-0">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Income</p>
                      <p className={`text-xl font-semibold ${getProfitLossKpiPresentation({ amount: formula.income, kind: "income" }).className}`}>{formatAbsoluteCurrency(formula.income)}</p>
                    </div>
                    <span className="flex w-full justify-center text-lg text-gray-400 lg:h-10 lg:w-8 lg:items-end lg:justify-center lg:pb-1 lg:text-gray-500">-</span>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Cost Of Goods Sold</p>
                      <p className={`text-xl font-semibold ${getProfitLossKpiPresentation({ amount: formula.costOfGoodsSold, kind: "expense" }).className}`}>{formatAbsoluteCurrency(formula.costOfGoodsSold)}</p>
                    </div>
                    <span className="flex w-full justify-center text-lg text-gray-400 lg:h-10 lg:w-8 lg:items-end lg:justify-center lg:pb-1 lg:text-gray-500">-</span>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Operating Expenses</p>
                      <p className={`text-xl font-semibold ${getProfitLossKpiPresentation({ amount: formula.operatingExpenses, kind: "expense" }).className}`}>{formatAbsoluteCurrency(formula.operatingExpenses)}</p>
                    </div>
                    <span className="flex w-full justify-center text-lg font-semibold text-gray-500 lg:h-10 lg:w-8 lg:items-end lg:justify-center lg:pb-1 lg:font-normal">=</span>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                      <p className={`text-xs uppercase tracking-wide ${formula.hasAdjustments ? "text-gray-500" : netIncomeColorClass}`}>
                        {formula.hasAdjustments ? "Operating Income" : "Net Income"}
                      </p>
                      <p className={`text-xl font-bold ${formula.hasAdjustments ? "text-gray-900" : netIncomeColorClass}`}>
                        {formatAbsoluteCurrency(formula.hasAdjustments ? formula.operatingIncome : formula.netIncome)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
              {formula.hasAdjustments && (
                <article className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
                  <div className="m-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Adjustments to Net Income</p>
                    <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(160px,1fr)_24px_minmax(160px,1fr)_24px_minmax(160px,1fr)_24px_minmax(160px,1fr)_24px_minmax(160px,1fr)] lg:items-end lg:gap-x-2 lg:gap-y-0">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Operating Income</p>
                        <p className="text-lg font-semibold text-gray-900">{formatAbsoluteCurrency(formula.operatingIncome)}</p>
                      </div>
                      <span className="flex w-full justify-center text-lg text-gray-400 lg:h-10 lg:w-6 lg:items-end lg:justify-center lg:pb-1">+</span>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Other Income</p>
                        <p className={`text-lg font-semibold ${getProfitLossKpiPresentation({ amount: formula.otherIncome, kind: "income" }).className}`}>{formatAbsoluteCurrency(formula.otherIncome)}</p>
                      </div>
                      <span className="flex w-full justify-center text-lg text-gray-400 lg:h-10 lg:w-6 lg:items-end lg:justify-center lg:pb-1">-</span>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Other Expense</p>
                        <p className={`text-lg font-semibold ${getProfitLossKpiPresentation({ amount: formula.otherExpense, kind: "expense" }).className}`}>{formatAbsoluteCurrency(formula.otherExpense)}</p>
                      </div>
                      <span className="flex w-full justify-center text-lg text-gray-400 lg:h-10 lg:w-6 lg:items-end lg:justify-center lg:pb-1">-</span>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Tax Expense</p>
                        <p className={`text-lg font-semibold ${getProfitLossKpiPresentation({ amount: formula.taxExpense, kind: "expense" }).className}`}>{formatAbsoluteCurrency(formula.taxExpense)}</p>
                      </div>
                      <span className="flex w-full justify-center text-lg font-semibold text-gray-500 lg:h-10 lg:w-6 lg:items-end lg:justify-center lg:pb-1 lg:font-normal">=</span>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
                        <p className={`text-xs uppercase tracking-wide ${netIncomeColorClass}`}>Net Income</p>
                        <p className={`text-lg font-bold ${netIncomeColorClass}`}>{formatAbsoluteCurrency(formula.netIncome)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              )}
            </section>

            <section className="grid grid-cols-1 gap-4">
              <article className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Statement</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${
                        showPercentView
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setShowPercentView((value) => !value)}
                    >
                      %
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">Revenue, costs, expenses and net income</p>

                <div className="mt-4 rounded-lg border border-gray-100 overflow-hidden">
                  {!showPercentView && (
                    <div>
                      {profitLoss.statement.map((line, index) => {
                        const amountPresentation = getProfitLossAmountPresentation({ amount: line.amount })

                        return (
                          <div
                            key={line.id}
                            className={`grid grid-cols-[minmax(0,1fr)_180px] items-center px-3 py-2 text-sm ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                          >
                            {line.type === "item" && line.id !== "service_income" ? (
                              <button
                                type="button"
                                className={`w-fit text-left hover:underline ${line.level === 1 ? "pl-4" : ""} ${getLineWeightClass(line.type)} text-gray-700`}
                                onClick={() => goToLedgerWithCategory(line)}
                                title={`Open transactions filtered by ${line.label}`}
                                aria-label={`Open transactions filtered by ${line.label}`}
                              >
                                {line.label}
                              </button>
                            ) : (
                              <span className={`${line.level === 1 ? "pl-4" : ""} ${getLineWeightClass(line.type)} ${line.type === "item" ? "text-gray-700" : ""}`}>
                                {line.label}
                              </span>
                            )}
                            <span className={`text-right ${getLineWeightClass(line.type)} ${amountPresentation.className}`}>
                              {amountPresentation.text}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {showPercentView && (
                    <div className="space-y-2 p-3">
                      {profitLoss.statement.map((line) => {
                        const percentage = Math.round((Math.abs(line.amount) / revenueBase) * 100)
                        const amountPresentation = getProfitLossAmountPresentation({ amount: line.amount })
                        return (
                          <div key={line.id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className={`${line.level === 1 ? "pl-4" : ""} ${getLineWeightClass(line.type)} ${line.type === "item" ? "text-gray-700" : ""}`}>
                                {line.label}
                              </span>
                              <span className={`${getLineWeightClass(line.type)} text-gray-900`}>{percentage}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-100">
                              <div
                                className={`h-2 rounded-full ${amountPresentation.barClassName}`}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </article>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}

export default ProfitLossPage
