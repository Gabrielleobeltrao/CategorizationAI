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
}) {
    return (
        <PopupModal isOpen={isOpen} title={title} onClose={onClose} maxWidthClass={maxWidthClass}>
            <div className="flex flex-col gap-4">
                {message ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                        <p className="text-sm text-amber-900">{message}</p>
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
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
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
