import { useEffect, useRef, useState } from "react"
import {
    OPERATIONAL_STATUS_LIST,
    getOperationalStatusBadgeClass,
} from "../../constants/operationalStatuses"

/**
 * Tooltip-style "?" icon that explains how the Operational Status is computed.
 * Mirrors the rules documented in the README so the user can self-serve when a
 * client lands on an unexpected status.
 *
 * Props:
 * - align: "right" (default) or "left" — which side the popover anchors to.
 *   Defaults to right because the icon usually lives in a column header that
 *   sits toward the right side of the screen; right-anchoring keeps the
 *   popover inside the viewport on narrow widths.
 */
function OperationalStatusHelp({ align = "right" }) {
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
                aria-label="Operational Status rules"
                title="Operational Status rules"
                onClick={() => setIsOpen((current) => !current)}
            >
                ?
            </button>

            {isOpen ? (
                <div
                    className={`absolute ${anchorClass} top-[calc(100%+8px)] z-[160] w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5`}
                >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                        How Operational Status is computed
                    </p>
                    <div className="mt-2 h-px bg-gray-100" />
                    <p className="mt-2 text-[11px] normal-case leading-4 text-gray-500">
                        Evaluated against the current year. Manual statuses (paused, completed) override the automatic ones until cleared.
                    </p>
                    <ul className="mt-3 flex flex-col gap-2 text-xs leading-5 text-gray-700">
                        {OPERATIONAL_STATUS_LIST.map((status) => (
                            <li key={status.id} className="flex items-start gap-2">
                                <span
                                    className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${getOperationalStatusBadgeClass(status.id)}`}
                                >
                                    {status.label}
                                </span>
                                <span className="min-w-0 flex-1 text-gray-600">
                                    {status.description}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </span>
    )
}

export default OperationalStatusHelp
