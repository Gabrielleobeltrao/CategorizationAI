import { useEffect, useRef, useState } from "react"
import {
    OPERATIONAL_STATUS_LIST,
    getOperationalStatusBadgeClass,
    getOperationalStatusMeta,
} from "../../constants/operationalStatuses"

/**
 * Custom status filter dropdown for the Clients page. Replaces the native
 * <select> so each option can render its colored badge. Empty value ("") means
 * "All statuses".
 *
 * Props:
 * - value: current status id or empty string
 * - onChange: (nextValue: string) => void
 */
function OperationalStatusFilter({ value, onChange }) {
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

    const selectedMeta = value ? getOperationalStatusMeta(value) : null
    const isActive = Boolean(value)

    const handleSelect = (next) => {
        onChange(next)
        setIsOpen(false)
    }

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                type="button"
                className="relative inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-700 outline-none transition hover:border-gray-400 focus:border-gray-500 sm:w-auto sm:gap-2 sm:justify-between sm:px-3 sm:py-2.5"
                onClick={() => setIsOpen((current) => !current)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={selectedMeta ? `Filter: ${selectedMeta.label}` : "Filter by operational status"}
                title={selectedMeta ? `Filter: ${selectedMeta.label}` : "Filter by operational status"}
            >
                {/* Mobile icon — funnel; active dot shows when a status is selected */}
                <svg
                    className="h-5 w-5 text-gray-600 sm:hidden"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M4 5h16l-6 8v5l-4 2v-7L4 5z" />
                </svg>
                {isActive && (
                    <span
                        className="absolute right-1 top-1 inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white sm:hidden"
                        aria-hidden="true"
                    />
                )}

                {/* Desktop: label + selected badge */}
                <span className="hidden min-w-0 items-center gap-2 sm:inline-flex">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Status
                    </span>
                    {selectedMeta ? (
                        <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${getOperationalStatusBadgeClass(selectedMeta.id)}`}
                        >
                            {selectedMeta.label}
                        </span>
                    ) : (
                        <span className="text-sm text-gray-700">All</span>
                    )}
                </span>
                <svg
                    className={`hidden h-4 w-4 shrink-0 text-gray-500 transition sm:inline-block ${isOpen ? "rotate-180" : ""}`}
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
                    className="absolute right-0 top-[calc(100%+6px)] z-[160] w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
                >
                    <button
                        type="button"
                        role="option"
                        aria-selected={!value}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${!value ? "bg-gray-50" : ""}`}
                        onClick={() => handleSelect("")}
                    >
                        <span className="text-gray-700">All statuses</span>
                        {!value ? (
                            <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : null}
                    </button>
                    <div className="h-px bg-gray-100" />
                    {OPERATIONAL_STATUS_LIST.map((status) => {
                        const isSelected = value === status.id
                        return (
                            <button
                                key={status.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-gray-50 ${isSelected ? "bg-gray-50" : ""}`}
                                onClick={() => handleSelect(status.id)}
                                title={status.description}
                            >
                                <span
                                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${getOperationalStatusBadgeClass(status.id)}`}
                                >
                                    {status.label}
                                </span>
                                {isSelected ? (
                                    <svg className="h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

export default OperationalStatusFilter
