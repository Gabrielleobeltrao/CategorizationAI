import { useEffect, useMemo, useRef, useState } from "react"

/**
 * Multi-select dropdown with searchable list of options and chip preview of
 * selected entries on the trigger button.
 *
 * Props:
 * - label?: string above the field
 * - value: array of selected values
 * - onChange(values): called with the next array
 * - options: [{ value, label }]
 * - placeholder?: text when nothing is selected
 * - searchable?: defaults true
 * - searchPlaceholder?: placeholder for the search input
 */
function MultiSelect({
    label,
    value = [],
    onChange,
    options = [],
    placeholder = "Select…",
    searchable = true,
    searchPlaceholder = "Search…",
    className = "",
}) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const wrapperRef = useRef(null)
    const searchInputRef = useRef(null)

    const selectedSet = useMemo(() => new Set((value || []).map(String)), [value])
    const selectedOptions = useMemo(
        () => options.filter((option) => selectedSet.has(String(option.value))),
        [options, selectedSet]
    )

    const visibleOptions = useMemo(() => {
        const term = String(searchTerm || "").trim().toLowerCase()
        if (!term) return options
        return options.filter((option) =>
            String(option.label || "").toLowerCase().includes(term)
        )
    }, [options, searchTerm])

    const closeDropdown = () => {
        setOpen(false)
        setSearchTerm("")
    }

    const toggleValue = (optionValue) => {
        const next = new Set((value || []).map(String))
        const key = String(optionValue)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        onChange?.(Array.from(next))
    }

    const removeValue = (optionValue) => {
        const key = String(optionValue)
        onChange?.((value || []).map(String).filter((v) => v !== key))
    }

    const clearAll = (event) => {
        event.stopPropagation()
        onChange?.([])
    }

    useEffect(() => {
        if (!open || !searchable) return undefined
        const focusTimeout = window.setTimeout(() => searchInputRef.current?.focus(), 0)
        return () => window.clearTimeout(focusTimeout)
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
                    onClick={() => setOpen((current) => !current)}
                    className={`flex w-full items-start justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left outline-none transition ${
                        open ? "border-gray-500" : "border-gray-300 hover:border-gray-400"
                    }`}
                >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        {selectedOptions.length === 0 ? (
                            <span className="py-0.5 text-sm text-gray-400">{placeholder}</span>
                        ) : (
                            selectedOptions.map((option) => (
                                <span
                                    key={String(option.value)}
                                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 py-0.5 pl-2 pr-1 text-xs text-gray-800"
                                >
                                    <span className="truncate">{option.label}</span>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            removeValue(option.value)
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                removeValue(option.value)
                                            }
                                        }}
                                        className="shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                                        aria-label={`Remove ${option.label}`}
                                    >
                                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 6 6 18" />
                                            <path d="m6 6 12 12" />
                                        </svg>
                                    </span>
                                </span>
                            ))
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pt-0.5">
                        {selectedOptions.length > 0 && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={clearAll}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault()
                                        clearAll(event)
                                    }
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                title="Clear all"
                                aria-label="Clear all"
                            >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </span>
                        )}
                        <svg
                            className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                </button>

                {open && (
                    <div className="absolute left-0 right-0 z-40 mt-1 flex max-h-72 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_48px_-12px_rgba(15,23,42,0.25)]">
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
                                    {searchTerm ? "No matches" : "No options"}
                                </p>
                            ) : (
                                visibleOptions.map((option) => {
                                    const isSelected = selectedSet.has(String(option.value))
                                    return (
                                        <button
                                            key={String(option.value)}
                                            type="button"
                                            onClick={() => toggleValue(option.value)}
                                            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                isSelected
                                                    ? "bg-gray-100 text-gray-900"
                                                    : "text-gray-700 hover:bg-gray-50"
                                            }`}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <span
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                        isSelected ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-white"
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M20 6 9 17l-5-5" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <span className="truncate">{option.label}</span>
                                            </span>
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

export default MultiSelect
