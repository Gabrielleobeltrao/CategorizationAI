import { useEffect, useRef, useState } from "react"
import { BUSINESS_TYPE_OPTIONS, getBusinessTypeOption } from "../../constants/businessTypes"

function BusinessTypeSelect({ value, onChange, placeholder = "Select business type", id }) {
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef(null)

    const selected = getBusinessTypeOption(value)

    useEffect(() => {
        if (!isOpen) return undefined
        const onMouseDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        const onKey = (event) => {
            if (event.key === "Escape") setIsOpen(false)
        }
        document.addEventListener("mousedown", onMouseDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onMouseDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [isOpen])

    const pick = (next) => {
        onChange(next)
        setIsOpen(false)
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                id={id}
                onClick={() => setIsOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-gray-50 px-3 py-2.5 text-left text-sm outline-none transition focus:border-gray-400 focus:bg-white ${
                    isOpen ? "border-gray-400 bg-white" : "border-gray-200 hover:bg-white"
                }`}
            >
                <span className="min-w-0 flex-1 truncate">
                    {selected ? (
                        <span className="text-gray-900">{selected.entity}</span>
                    ) : (
                        <span className="text-gray-500">{placeholder}</span>
                    )}
                </span>
                {selected && (
                    <span className="shrink-0 text-[11px] text-gray-500">{selected.code}</span>
                )}
                <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {isOpen && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
                >
                    {BUSINESS_TYPE_OPTIONS.map((opt) => {
                        const isActive = selected?.value === opt.value
                        return (
                            <li key={opt.value}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isActive}
                                    onClick={() => pick(opt.value)}
                                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                                        isActive ? "bg-gray-100 text-gray-900" : "text-gray-800 hover:bg-gray-50"
                                    }`}
                                >
                                    <span className="min-w-0 flex-1 truncate">{opt.entity}</span>
                                    <span className={`shrink-0 text-[11px] ${isActive ? "text-gray-600" : "text-gray-400"}`}>
                                        {opt.code}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

export default BusinessTypeSelect
