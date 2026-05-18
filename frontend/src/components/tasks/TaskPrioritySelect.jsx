import { useEffect, useRef, useState } from "react"

const PRIORITY_OPTIONS = [
    {
        value: "low",
        label: "Low",
        description: "Routine task, no specific deadline pressure.",
        dotClass: "bg-slate-400",
        chipClass: "bg-slate-100 text-slate-700 ring-slate-200",
    },
    {
        value: "medium",
        label: "Medium",
        description: "Should be handled soon, but not blocking.",
        dotClass: "bg-yellow-400",
        chipClass: "bg-yellow-50 text-yellow-800 ring-yellow-200",
    },
    {
        value: "high",
        label: "High",
        description: "Needs attention quickly — usually within the day.",
        dotClass: "bg-orange-500",
        chipClass: "bg-orange-50 text-orange-800 ring-orange-200",
    },
    {
        value: "urgent",
        label: "Urgent",
        description: "Drop other work — escalate immediately.",
        dotClass: "bg-red-600",
        chipClass: "bg-red-50 text-red-700 ring-red-200",
    },
]

const OPTIONS_BY_VALUE = PRIORITY_OPTIONS.reduce((acc, item) => {
    acc[item.value] = item
    return acc
}, {})

/**
 * Customized priority picker used by the New/Edit Task modal in place of
 * the native <select>. Each option renders with its tone chip so the user
 * can recognize the level at a glance.
 */
function TaskPrioritySelect({ value, onChange, id, disabled = false }) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return undefined
        const handlePointerDown = (event) => {
            if (containerRef.current?.contains(event.target)) return
            setIsOpen(false)
        }
        const handleEscape = (event) => {
            if (event.key === "Escape") setIsOpen(false)
        }
        window.addEventListener("pointerdown", handlePointerDown)
        window.addEventListener("keydown", handleEscape)
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown)
            window.removeEventListener("keydown", handleEscape)
        }
    }, [isOpen])

    const selected = OPTIONS_BY_VALUE[value] || OPTIONS_BY_VALUE.low

    const handleSelect = (next) => {
        onChange?.(next)
        setIsOpen(false)
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                id={id}
                type="button"
                disabled={disabled}
                className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition hover:border-gray-400 focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setIsOpen((current) => !current)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${selected.chipClass}`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${selected.dotClass}`} aria-hidden="true" />
                        {selected.label}
                    </span>
                </span>
                <svg
                    className={`h-4 w-4 shrink-0 text-gray-500 transition ${isOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {isOpen ? (
                <div
                    role="listbox"
                    className="absolute left-0 top-[calc(100%+6px)] z-[220] w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white py-1 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
                >
                    {PRIORITY_OPTIONS.map((option) => {
                        const isSelected = value === option.value
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(option.value)}
                                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-gray-50 ${isSelected ? "bg-gray-50" : ""}`}
                            >
                                <span
                                    className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${option.chipClass}`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${option.dotClass}`} aria-hidden="true" />
                                    {option.label}
                                </span>
                                <span className="min-w-0 flex-1 text-xs leading-4 text-gray-600">
                                    {option.description}
                                </span>
                                {isSelected ? (
                                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : null}
                            </button>
                        )
                    })}
                </div>
            ) : null}
        </div>
    )
}

export default TaskPrioritySelect
