function NotificationCenter({ notification, onClose }) {
  if (!notification) return null

  const paletteByType = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    loading: "border-gray-200 bg-white text-gray-900",
  }

  const tone = paletteByType[notification.type] || paletteByType.info

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[400] flex justify-center px-4">
      <div className={`pointer-events-auto flex min-w-[280px] max-w-[560px] items-center justify-between gap-4 rounded-lg border px-4 py-3 shadow-md ${tone}`}>
        <div className="flex items-center gap-2">
          {notification.type === "loading" && (
            <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-9-9" />
            </svg>
          )}
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded px-2 py-1 text-xs font-semibold hover:bg-black/5"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default NotificationCenter
