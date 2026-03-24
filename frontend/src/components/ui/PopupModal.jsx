function PopupModal({ isOpen, title, onClose, children, maxWidthClass = "max-w-md" }) {
    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={onClose}
        >
            <section
                className={`w-full ${maxWidthClass} rounded-xl bg-white p-5 shadow-xl`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button
                        type="button"
                        className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </header>
                {children}
            </section>
        </div>
    )
}

export default PopupModal
