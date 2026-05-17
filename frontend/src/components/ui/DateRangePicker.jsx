import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
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

// Layout constants kept in sync with the JSX width classes below. If you bump
// the popover width, update DESIRED_POPOVER_WIDTH too so positioning math is
// consistent.
const DESIRED_POPOVER_WIDTH = 480 // 30rem
const VIEWPORT_PADDING = 16 // 1rem on each side
const POPOVER_GAP = 4 // space between trigger and popover edge

function DateRangePicker({ value, onChange, isLoading = false, className = "" }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    from: fromIsoDate(value?.from),
    to: fromIsoDate(value?.to),
  }))
  // Position the popover with viewport coordinates and render it via a portal
  // attached to document.body. That sidesteps any "ancestor with overflow or
  // transform" caveats — the popover is always positioned against the viewport
  // and clamped horizontally + vertically before being shown.
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0, width: DESIRED_POPOVER_WIDTH })
  const [isMeasured, setIsMeasured] = useState(false)
  const wrapperRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    setDraft({ from: fromIsoDate(value?.from), to: fromIsoDate(value?.to) })
  }, [value?.from, value?.to])

  useEffect(() => {
    if (!open) return undefined
    function onDocPointerDown(event) {
      if (wrapperRef.current?.contains(event.target)) return
      if (popoverRef.current?.contains(event.target)) return
      setOpen(false)
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

  const measurePopover = useCallback(() => {
    if (typeof window === "undefined") return
    const trigger = wrapperRef.current?.querySelector("button[type='button']")
    if (!trigger) return

    const triggerRect = trigger.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const maxWidth = Math.max(160, viewportW - VIEWPORT_PADDING * 2)
    const width = Math.min(DESIRED_POPOVER_WIDTH, maxWidth)

    // Use the popover's actual rendered height when we have it; otherwise fall
    // back to a conservative estimate so the first frame still picks a sensible
    // placement.
    const measuredHeight = popoverRef.current?.getBoundingClientRect().height || 0
    const popoverHeight = measuredHeight > 0 ? measuredHeight : 420

    // Horizontal: anchor to trigger.left (extends right). Flip to right-aligned
    // if it would overflow the viewport, then clamp on both sides.
    let viewportLeft = triggerRect.left
    if (viewportLeft + width > viewportW - VIEWPORT_PADDING) {
      viewportLeft = triggerRect.right - width
    }
    if (viewportLeft < VIEWPORT_PADDING) viewportLeft = VIEWPORT_PADDING
    if (viewportLeft + width > viewportW - VIEWPORT_PADDING) {
      viewportLeft = viewportW - VIEWPORT_PADDING - width
    }

    // Vertical: prefer below trigger. If the popover would spill past the
    // viewport bottom, flip above. Last resort, clamp to the bottom edge.
    let viewportTop = triggerRect.bottom + POPOVER_GAP
    if (viewportTop + popoverHeight > viewportH - VIEWPORT_PADDING) {
      const aboveTop = triggerRect.top - POPOVER_GAP - popoverHeight
      if (aboveTop >= VIEWPORT_PADDING) {
        viewportTop = aboveTop
      } else {
        viewportTop = Math.max(VIEWPORT_PADDING, viewportH - VIEWPORT_PADDING - popoverHeight)
      }
    }

    setPopoverStyle({ top: viewportTop, left: viewportLeft, width })
    setIsMeasured(true)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setIsMeasured(false)
      return undefined
    }
    measurePopover()
    return undefined
  }, [open, measurePopover])

  useEffect(() => {
    if (!open) return undefined
    const handleResize = () => measurePopover()
    window.addEventListener("resize", handleResize)
    window.addEventListener("scroll", handleResize, true)
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleResize, true)
    }
  }, [open, measurePopover])

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

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[260] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_48px_-12px_rgba(15,23,42,0.25)] md:flex-row"
          style={{
            top: `${popoverStyle.top}px`,
            left: `${popoverStyle.left}px`,
            width: `${popoverStyle.width}px`,
            // Hidden until measurePopover has clamped both horizontal and
            // vertical position to the viewport. Stays in layout so we can
            // read its actual height for the vertical flip.
            visibility: isMeasured ? "visible" : "hidden",
            pointerEvents: isMeasured ? "auto" : "none",
          }}
        >
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
            <div className="rdp-compact flex justify-center overflow-x-auto text-xs" style={{ "--rdp-cell-size": "32px", fontSize: "12px" }}>
              <style>{`
                .rdp-compact .rdp-day_button { font-size: 12px !important; font-weight: 500 !important; }
                .rdp-compact .rdp-selected .rdp-day_button { font-weight: 600 !important; }
                .rdp-compact .rdp-today .rdp-day_button { font-weight: 600 !important; }
                .rdp-compact .rdp-weekday { font-size: 11px !important; }
                .rdp-compact .rdp-caption_label { font-size: 13px !important; }
                .rdp-compact .rdp-months { margin: 0 auto; }
              `}</style>
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
        </div>,
        document.body,
      )}
    </div>
  )
}

export default DateRangePicker
