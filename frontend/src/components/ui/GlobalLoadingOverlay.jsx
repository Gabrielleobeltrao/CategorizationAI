import { useEffect, useRef, useState } from "react"

const SHOW_DELAY_MS = 220
const MIN_VISIBLE_MS = 280

function GlobalLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(false)
    const isVisibleRef = useRef(false)

    useEffect(() => {
        isVisibleRef.current = isVisible
    }, [isVisible])

    useEffect(() => {
        let pendingRequests = 0
        let showTimerId = null
        let hideTimerId = null
        let visibleSince = 0

        const clearShowTimer = () => {
            if (!showTimerId) return
            clearTimeout(showTimerId)
            showTimerId = null
        }

        const clearHideTimer = () => {
            if (!hideTimerId) return
            clearTimeout(hideTimerId)
            hideTimerId = null
        }

        const showOverlay = () => {
            clearHideTimer()
            isVisibleRef.current = true
            setIsVisible(true)
            visibleSince = Date.now()
        }

        const hideOverlay = () => {
            clearShowTimer()
            clearHideTimer()
            isVisibleRef.current = false
            setIsVisible(false)
            visibleSince = 0
        }

        const handleLoadingStateChange = (event) => {
            pendingRequests = Number(event.detail?.pendingRequests || 0)

            if (pendingRequests > 0) {
                clearHideTimer()
                if (showTimerId || isVisibleRef.current) return

                showTimerId = setTimeout(() => {
                    showTimerId = null
                    if (pendingRequests > 0) showOverlay()
                }, SHOW_DELAY_MS)
                return
            }

            clearShowTimer()
            if (!isVisibleRef.current) return

            const elapsedVisible = Date.now() - visibleSince
            if (elapsedVisible >= MIN_VISIBLE_MS) {
                hideOverlay()
                return
            }

            hideTimerId = setTimeout(() => {
                hideTimerId = null
                hideOverlay()
            }, MIN_VISIBLE_MS - elapsedVisible)
        }

        window.addEventListener("app:loading-state", handleLoadingStateChange)

        return () => {
            clearShowTimer()
            clearHideTimer()
            window.removeEventListener("app:loading-state", handleLoadingStateChange)
        }
    }, [])

    if (!isVisible) return null

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/20">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <p className="text-sm font-medium text-slate-700">Loading</p>
            </div>
        </div>
    )
}

export default GlobalLoadingOverlay
