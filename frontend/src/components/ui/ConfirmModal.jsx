import PopupModal from "./PopupModal"

function ConfirmModal({
    isOpen,
    title = "Confirm Action",
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onClose,
    isLoading = false,
    children,
    maxWidthClass = "max-w-2xl",
    variant = "danger",
}) {
    const isNeutral = variant === "neutral"

    return (
        <PopupModal isOpen={isOpen} title={title} onClose={onClose} maxWidthClass={maxWidthClass}>
            <div className="flex flex-col gap-4">
                {message ? (
                    <div className={`rounded-xl px-3 py-2.5 ${
                        isNeutral
                            ? "border border-gray-200 bg-gray-50"
                            : "border border-amber-100 bg-amber-50"
                    }`}>
                        <p className={`text-sm ${
                            isNeutral ? "text-gray-700" : "text-amber-900"
                        }`}>
                            {message}
                        </p>
                    </div>
                ) : null}
                {children}
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                            isNeutral
                                ? "border border-gray-900 bg-gray-900 text-white hover:bg-black"
                                : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? "Processing..." : confirmLabel}
                    </button>
                </div>
            </div>
        </PopupModal>
    )
}

export default ConfirmModal
