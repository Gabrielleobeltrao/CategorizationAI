import { useEffect, useRef, useState } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"

function toIsoDate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function fromIsoDate(value) {
  if (!value) return undefined
  const [y, m, d] = String(value).split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function formatDisplay(date) {
  if (!date) return ""
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const PRESETS = [
  {
    id: "today",
    label: "Today",
    build: () => {
      const today = new Date()
      return { from: today, to: today }
    },
  },
  {
    id: "last7",
    label: "Last 7 days",
    build: () => {
      const today = new Date()
      const from = new Date(today)
      from.setDate(today.getDate() - 6)
      return { from, to: today }
    },
  },
  {
    id: "last30",
    label: "Last 30 days",
    build: () => {
      const today = new Date()
      const from = new Date(today)
      from.setDate(today.getDate() - 29)
      return { from, to: today }
    },
  },
  {
    id: "thisMonth",
    label: "This month",
    build: () => {
      const today = new Date()
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: today,
      }
    },
  },
  {
    id: "lastMonth",
    label: "Last month",
    build: () => {
      const today = new Date()
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const to = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from, to }
    },
  },
]

function DateRangePicker({ value, onChange, isLoading = false, align = "end", className = "" }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    from: fromIsoDate(value?.from),
    to: fromIsoDate(value?.to),
  }))
  const wrapperRef = useRef(null)

  useEffect(() => {
    setDraft({ from: fromIsoDate(value?.from), to: fromIsoDate(value?.to) })
  }, [value?.from, value?.to])

  useEffect(() => {
    if (!open) return undefined
    function onDocPointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const handleApply = () => {
    if (!draft.from || !draft.to) return
    onChange?.({ from: toIsoDate(draft.from), to: toIsoDate(draft.to) })
    setOpen(false)
  }

  const handlePreset = (preset) => {
    const next = preset.build()
    setDraft(next)
    onChange?.({ from: toIsoDate(next.from), to: toIsoDate(next.to) })
    setOpen(false)
  }

  const buttonLabel =
    draft.from && draft.to
      ? `${formatDisplay(draft.from)} → ${formatDisplay(draft.to)}`
      : "Select date range"

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 outline-none transition hover:border-gray-400"
      >
        <svg className="h-3.5 w-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="whitespace-nowrap">{isLoading ? "Loading…" : buttonLabel}</span>
        <svg className={`h-3.5 w-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={`absolute ${align === "start" ? "left-0" : "right-0"} z-50 mt-1 flex w-[min(95vw,30rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_48px_-12px_rgba(15,23,42,0.25)] md:flex-row`}>
          <div className="flex shrink-0 flex-col gap-0.5 border-b border-gray-100 p-3 md:w-40 md:border-b-0 md:border-r">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset)}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="overflow-x-auto">
              <DayPicker
                mode="range"
                selected={draft.from || draft.to ? draft : undefined}
                onSelect={(next) => setDraft(next || { from: undefined, to: undefined })}
                numberOfMonths={1}
                showOutsideDays
                weekStartsOn={0}
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!draft.from || !draft.to}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangePicker
