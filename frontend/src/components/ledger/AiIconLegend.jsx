import { useEffect, useRef, useState } from "react"

const LEGEND_ITEMS = [
    {
        id: "ai",
        label: "Categorized by AI",
        description: "AI suggested this category based on the description and amount.",
        toneClass: "bg-sky-100 text-sky-700",
        icon: (
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.9 4.3L18 9.2l-4.1 1.9L12 15.5l-1.9-4.4L6 9.2l4.1-1.9z" />
                <path d="M19 16l.8 1.7L21.5 18l-1.7.8L19 20.5l-.8-1.7-1.7-.8 1.7-.3z" />
            </svg>
        ),
    },
    {
        id: "memory",
        label: "Categorized by memory",
        description: "Reused a category previously confirmed for a similar transaction.",
        toneClass: "bg-violet-100 text-violet-700",
        icon: (
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 8a3 3 0 0 1 3-3h7v14h-7a3 3 0 0 0-3 3z" />
                <path d="M17 5a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3" />
                <path d="M10 9h4" />
                <path d="M10 13h4" />
            </svg>
        ),
    },
    {
        id: "processing",
        label: "Processing by AI",
        description: "AI run is currently in progress for this transaction.",
        toneClass: "bg-amber-100 text-amber-700",
        icon: (
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-9-9" />
            </svg>
        ),
    },
]

/**
 * Compact legend rendered inside the transactions table header. Shows the
 * sample AI/memory/processing badges users see next to each category and
 * exposes a "?" popover with their full description.
 */
function AiIconLegend({ align = "right" }) {
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

    const anchorClass = align === "left" ? "left-0" : "right-0"

    return (
        <span ref={containerRef} className="relative inline-flex items-center">
            <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-500 transition hover:border-gray-400 hover:text-gray-700"
                aria-label="What do these icons mean?"
                title="What do these icons mean?"
                onClick={() => setIsOpen((current) => !current)}
            >
                ?
            </button>

            {isOpen ? (
                <div
                    className={`absolute ${anchorClass} top-[calc(100%+8px)] z-[160] w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5`}
                >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Category icons
                    </p>
                    <div className="mt-2 h-px bg-gray-100" />
                    <ul className="mt-3 flex flex-col gap-2 text-xs leading-5 text-gray-700">
                        {LEGEND_ITEMS.map((item) => (
                            <li key={item.id} className="flex items-start gap-2">
                                <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0.5 ${item.toneClass}`} aria-hidden="true">
                                    {item.icon}
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-medium text-gray-800">{item.label}</span>
                                    <span className="block text-gray-600">{item.description}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </span>
    )
}

export default AiIconLegend
