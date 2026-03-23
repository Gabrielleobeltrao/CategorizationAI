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
}) {
    return (
        <PopupModal isOpen={isOpen} title={title} onClose={onClose}>
            <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-700">{message}</p>
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
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
