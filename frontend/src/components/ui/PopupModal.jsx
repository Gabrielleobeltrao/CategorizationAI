import { useEffect } from "react"

function PopupModal({ isOpen, title, onClose, children, maxWidthClass = "max-w-md" }) {
    useEffect(() => {
        if (!isOpen) return undefined

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                onClose?.()
            }
        }

        window.addEventListener("keydown", handleEscape)

        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener("keydown", handleEscape)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px] sm:p-6"
            onClick={onClose}
        >
            <section
                className={`popup-modal-surface flex w-full ${maxWidthClass} max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-b from-gray-50/85 to-white px-5 py-4 sm:px-6">
                    <h2 className="truncate pr-3 text-lg font-semibold tracking-tight text-gray-900">
                        {title}
                    </h2>
                    <button
                        type="button"
                        className="rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </header>
                <div className="overflow-y-auto px-5 py-4 sm:px-6">
                    {children}
                </div>
            </section>
        </div>
    )
}

export default PopupModal
