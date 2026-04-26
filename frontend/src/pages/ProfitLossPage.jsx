import { useEffect, useMemo, useState } from "react"
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
  const [period, setPeriod] = useState("YEAR")
  const [isManual, setIsManual] = useState(false)
  const [showPercentView, setShowPercentView] = useState(false)
  const [fromDate, setFromDate] = useState("2026-03-01")
  const [toDate, setToDate] = useState("2026-03-31")
  const [month, setMonth] = useState("")
  const [year, setYear] = useState(() => readStoredProfitLossYear(clientId))
  const [yearClientId, setYearClientId] = useState(clientId)
  const [periodOptions, setPeriodOptions] = useState({ months: [], years: [] })
  const [client, setClient] = useState(null)
  const [profitLoss, setProfitLoss] = useState(null)
  const [isLoadingProfitLoss, setIsLoadingProfitLoss] = useState(false)
  const { config: openTestConfig } = useOpenTest()

  const monthOptions = useMemo(
    () =>
      (Array.isArray(periodOptions.months) ? periodOptions.months : []).map((value) => ({
        value,
        label: formatMonthLabel(value),
      })),
    [periodOptions.months]
  )
  const yearOptions = useMemo(
    () => (Array.isArray(periodOptions.years) ? periodOptions.years : []),
    [periodOptions.years]
  )

  useEffect(() => {
    setYear(readStoredProfitLossYear(clientId))
    setYearClientId(clientId)
    setMonth("")
    setProfitLoss(null)
  }, [clientId])

  useEffect(() => {
    let active = true

    if (!clientId) {
      setPeriodOptions({ months: [], years: [] })
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

    if (!clientId) {
      setPeriodOptions({ months: [], years: [] })
      return () => {
        active = false
      }
    }

    const cachedOptions = getCachedProfitLossPeriodOptionsByClientId(clientId)
    if (cachedOptions) {
      setPeriodOptions({
        months: Array.isArray(cachedOptions?.months) ? cachedOptions.months : [],
        years: Array.isArray(cachedOptions?.years) ? cachedOptions.years : [],
      })
    }

    getProfitLossPeriodOptionsByClientId(clientId, {
      silentLoading: true,
      backgroundLoadingMessage: cachedOptions ? "Updating cached profit and loss periods..." : "",
    })
      .then((payload) => {
        if (!active) return
        const nextMonths = Array.isArray(payload?.months) ? payload.months : []
        const nextYears = Array.isArray(payload?.years) ? payload.years : []
        setPeriodOptions({
          months: nextMonths,
          years: nextYears,
        })
      })
      .catch(() => {
        if (!active) return
        setPeriodOptions({ months: [], years: [] })
      })

    return () => {
      active = false
    }
  }, [clientId])

  useEffect(() => {
    if (monthOptions.length === 0) {
      setMonth("")
      return
    }

    const monthExists = monthOptions.some((option) => option.value === month)
    if (!monthExists) {
      setMonth(monthOptions[0].value)
    }
  }, [monthOptions, month])

  useEffect(() => {
    if (yearOptions.length === 0) {
      setYear("")
      return
    }

    const storedYear = readStoredProfitLossYear(clientId)
    if (storedYear && yearOptions.includes(storedYear) && year !== storedYear) {
      setYear(storedYear)
      setYearClientId(clientId)
      return
    }

    if (!yearOptions.includes(year)) {
      setYear(yearOptions[0])
      setYearClientId(clientId)
    }
  }, [clientId, yearOptions, year])

  useEffect(() => {
    if (!clientId || !year) return
    writeStoredProfitLossYear(clientId, year)
  }, [clientId, year])

  useEffect(() => {
    let active = true

    if (!clientId) {
      return () => {
        active = false
      }
    }

    const run = async () => {
      if (!isManual && period === "MONTH" && !month) {
        setProfitLoss(null)
        return
      }

      if (!isManual && period === "YEAR" && !year) {
        setProfitLoss(null)
        return
      }

      if (!isManual && period === "YEAR" && yearClientId !== clientId) {
        setProfitLoss(null)
        return
      }

      setIsLoadingProfitLoss(true)
      const requestOptions = {
        period: isManual ? "RANGE" : period,
        month,
        year,
        fromDate,
        toDate,
      }
      const cachedProfitLoss = getCachedProfitLossByClientId(clientId, requestOptions)
      if (cachedProfitLoss) {
        setProfitLoss(cachedProfitLoss)
        setIsLoadingProfitLoss(false)
      }

      try {
        const payload = await getProfitLossByClientId(clientId, {
          ...requestOptions,
          backgroundLoadingMessage: cachedProfitLoss ? "Updating cached profit and loss..." : "",
        })
        if (!active) return
        setProfitLoss(payload || null)
      } catch (err) {
        if (!active) return
        if (!cachedProfitLoss) {
          setProfitLoss(null)
          error(err.message || "Failed to load profit and loss")
        }
      } finally {
        if (active) {
          setIsLoadingProfitLoss(false)
        }
      }
    }

    run()

    return () => {
      active = false
    }
  }, [clientId, period, month, year, yearClientId, fromDate, toDate, isManual, error])

  const revenueBase = useMemo(() => {
    const revenueLine = profitLoss?.statement.find((line) => line.id === "revenue")
    if (!revenueLine) return 1
    return Math.max(1, Math.abs(revenueLine.amount))
  }, [profitLoss])

  const formula = useMemo(() => {
    const income = profitLoss?.kpis.find((kpi) => kpi.id === "revenue")?.value ?? 0
    const grossProfit = profitLoss?.kpis.find((kpi) => kpi.id === "gross_profit")?.value ?? 0
    const operatingIncome = profitLoss?.kpis.find((kpi) => kpi.id === "operating_income")?.value ?? 0
    const netIncome = profitLoss?.kpis.find((kpi) => kpi.id === "net_income")?.value ?? 0

    return {
      income,
      costOfGoodsSold: income - grossProfit,
      operatingExpenses: grossProfit - operatingIncome,
      netIncome,
    }
  }, [profitLoss])

  const netIncomeColorClass = useMemo(() => {
    if (formula.netIncome > 0) return "text-emerald-700"
    return "text-gray-900"
  }, [formula.netIncome])

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

  return (
    <section className="w-full p-8">
      <div className="w-full flex flex-col gap-3">
        <header className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Profit & Loss</h1>
              <p className="text-sm text-gray-500 mt-1">
                {client ? client.name : "Unknown client"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Period: {profitLoss ? formatPeriodLabel(profitLoss.period) : (isLoadingProfitLoss ? "Loading..." : "-")}
              </p>
              <button
                type="button"
                className="mt-3 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleDownloadPdf}
                disabled={!profitLoss}
              >
                Download PDF
              </button>
            </div>

            <div className="w-full md:w-1/2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Period Filter
              </label>

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-white p-1">
                    {[
                      { value: "ALL", label: "All" },
                      { value: "MONTH", label: "Month" },
                      { value: "YEAR", label: "Year" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
                          !isManual && period === item.value
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                        onClick={() => {
                          setPeriod(item.value)
                          setIsManual(false)
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
                        isManual
                          ? "bg-gray-900 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      onClick={() => setIsManual((value) => !value)}
                    >
                      Manual
                    </button>
                </div>

                {period === "MONTH" && !isManual && (
                  <div className="w-full overflow-x-auto">
                    <div className="flex h-8 min-w-max items-center gap-1.5">
                      {monthOptions.length === 0 && (
                        <span className="text-xs text-gray-500">No months available</span>
                      )}
                      {monthOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`rounded-md px-2 py-1.5 text-xs ${
                            month === option.value
                              ? "bg-gray-900 text-white"
                              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                          }`}
                          onClick={() => setMonth(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {period === "YEAR" && !isManual && (
                  <div className="w-full overflow-x-auto">
                    <div className="flex h-8 min-w-max items-center gap-1.5">
                    {yearOptions.length === 0 && (
                      <span className="text-xs text-gray-500">No years available</span>
                    )}
                    {yearOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`rounded-md px-2 py-1.5 text-xs ${
                          year === option
                            ? "bg-gray-900 text-white"
                            : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                        }`}
                        onClick={() => {
                          setYear(option)
                          setYearClientId(clientId)
                        }}
                      >
                        {option}
                      </button>
                    ))}
                    </div>
                  </div>
                )}

                {isManual && (
                  <div className="w-full overflow-x-auto">
                    <div className="flex h-8 min-w-max items-center gap-2">
                    <span className="text-xs text-gray-500">From</span>
                    <input
                      type="date"
                      aria-label="From date"
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />

                    <span className="text-xs text-gray-500">To</span>
                    <input
                      type="date"
                      aria-label="To date"
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                    </div>
                  </div>
                )}
                </div>
            </div>
          </div>
        </header>

        {openTestConfig?.enabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Private beta notice</p>
            <p className="mt-1">
              Profit & loss totals can still change while AI categorization is being validated in private beta. Review uncategorized lines, recent AI results and final totals before using this statement in real work.
            </p>
          </div>
        )}

        {!profitLoss && !isLoadingProfitLoss && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Profit & Loss data not found for this client.
          </div>
        )}

        {profitLoss && (
          <div className="relative">
            <section className="w-full pb-3">
              <article className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="m-3 w-full overflow-x-auto">
                  <div className="grid min-w-[900px] grid-cols-[minmax(170px,1fr)_32px_minmax(220px,1fr)_32px_minmax(220px,1fr)_32px_minmax(180px,1fr)] items-end gap-x-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Income</p>
                      <p className={`text-xl font-semibold ${getProfitLossKpiPresentation({ amount: formula.income, kind: "income" }).className}`}>{formatAbsoluteCurrency(formula.income)}</p>
                    </div>
                    <span className="flex h-10 w-8 items-end justify-center pb-1 text-lg text-gray-500">-</span>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Cost Of Goods Sold</p>
                      <p className={`text-xl font-semibold ${getProfitLossKpiPresentation({ amount: formula.costOfGoodsSold, kind: "expense" }).className}`}>{formatAbsoluteCurrency(formula.costOfGoodsSold)}</p>
                    </div>
                    <span className="flex h-10 w-8 items-end justify-center pb-1 text-lg text-gray-500">-</span>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Operating Expenses</p>
                      <p className={`text-xl font-semibold ${getProfitLossKpiPresentation({ amount: formula.operatingExpenses, kind: "expense" }).className}`}>{formatAbsoluteCurrency(formula.operatingExpenses)}</p>
                    </div>
                    <span className="flex h-10 w-8 items-end justify-center pb-1 text-lg text-gray-500">=</span>
                    <div className="text-center">
                      <p className={`text-xs uppercase tracking-wide ${netIncomeColorClass}`}>Net Income</p>
                      <p className={`text-xl font-bold ${netIncomeColorClass}`}>{formatAbsoluteCurrency(formula.netIncome)}</p>
                    </div>
                  </div>
                </div>
              </article>
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
                      {profitLoss.statement.map((line, index) => (
                        (() => {
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
                        })()
                      ))}
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

            {isLoadingProfitLoss && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/55 backdrop-blur-[1px]">
                <div className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
                  Updating report...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default ProfitLossPage
