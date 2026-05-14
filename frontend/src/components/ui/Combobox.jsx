import { useEffect, useMemo, useRef, useState } from "react"

/**
 * Styled select replacement.
 *
 * Props:
 * - label?: string above the field
 * - value: current selected value
 * - onChange(value): called with the new value
 * - options: [{ value, label }]
 * - placeholder?: text when nothing is selected
 * - disabled?: boolean
 * - searchable?: if true, shows a search input at the top of the dropdown
 * - searchPlaceholder?: placeholder for the search input
 */
function Combobox({
    label,
    value,
    onChange,
    options = [],
    placeholder = "Select",
    disabled = false,
    searchable = false,
    searchPlaceholder = "Search…",
    className = "",
}) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const wrapperRef = useRef(null)
    const searchInputRef = useRef(null)

    const selected = options.find((option) => String(option.value) === String(value)) || null

    const visibleOptions = useMemo(() => {
        if (!searchable) return options
        const term = String(searchTerm || "").trim().toLowerCase()
        if (!term) return options
        return options.filter((option) =>
            String(option.label || "").toLowerCase().includes(term)
        )
    }, [options, searchable, searchTerm])

    const closeDropdown = () => {
        setOpen(false)
        setSearchTerm("")
    }

    useEffect(() => {
        if (!open) return undefined
        if (searchable) {
            const focusTimeout = window.setTimeout(() => {
                searchInputRef.current?.focus()
            }, 0)
            return () => window.clearTimeout(focusTimeout)
        }
        return undefined
    }, [open, searchable])

    useEffect(() => {
        if (!open) return undefined
        function onDocPointerDown(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                closeDropdown()
            }
        }
        function onKey(event) {
            if (event.key === "Escape") closeDropdown()
        }
        document.addEventListener("mousedown", onDocPointerDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDocPointerDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    return (
        <div className={`flex flex-col gap-1 text-xs text-gray-600 ${className}`}>
            {label ? <span>{label}</span> : null}
            <div className="relative" ref={wrapperRef}>
                <button
                    type="button"
                    onClick={() => !disabled && setOpen((current) => !current)}
                    disabled={disabled}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm text-left outline-none transition disabled:cursor-not-allowed disabled:bg-gray-50 ${
                        open ? "border-gray-500" : "border-gray-300 hover:border-gray-400"
                    }`}
                >
                    <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>
                        {selected ? selected.label : placeholder}
                    </span>
                    <svg
                        className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </button>

                {open && (
                    <div className="absolute left-0 right-0 z-40 mt-1 flex max-h-64 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_48px_-12px_rgba(15,23,42,0.25)]">
                        {searchable && (
                            <div className="relative border-b border-gray-100 p-2">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                                />
                                <svg
                                    className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="m21 21-4.3-4.3" />
                                </svg>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto p-1">
                            {visibleOptions.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-gray-400">
                                    {searchable && searchTerm ? "No matches" : "No options"}
                                </p>
                            ) : (
                                visibleOptions.map((option) => {
                                    const isSelected = String(option.value) === String(value)
                                    return (
                                        <button
                                            key={String(option.value)}
                                            type="button"
                                            onClick={() => {
                                                onChange?.(option.value)
                                                closeDropdown()
                                            }}
                                            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                isSelected
                                                    ? "bg-gray-900 text-white"
                                                    : "text-gray-700 hover:bg-gray-100"
                                            }`}
                                        >
                                            <span className="truncate">{option.label}</span>
                                            {isSelected && (
                                                <svg
                                                    className="h-3.5 w-3.5 shrink-0"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Combobox
