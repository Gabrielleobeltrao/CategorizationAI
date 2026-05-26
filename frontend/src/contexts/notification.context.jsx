/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import NotificationCenter from "../components/ui/NotificationCenter"

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null)

  const hide = useCallback((targetId) => {
    setNotification((current) => {
      if (!current) return null
      if (targetId === undefined || targetId === null || targetId === "") return null
      return current.id === targetId ? null : current
    })
  }, [])

  const notify = useCallback((message, type = "info", options = {}) => {
    if (!message) return
    const persist = Boolean(options?.persist)
    setNotification({
      id: options?.id || Date.now(),
      type,
      message,
      persist,
      action: options?.action || null,
    })
  }, [])

  useEffect(() => {
    if (!notification) return
    if (notification.persist) return
    const timeout = setTimeout(() => {
      setNotification(null)
    }, 3500)

    return () => clearTimeout(timeout)
  }, [notification])

  const value = useMemo(
    () => ({
      notify,
      success: (message, options) => notify(message, "success", options),
      error: (message, options) => notify(message, "error", options),
      info: (message, options) => notify(message, "info", options),
      showLoading: (message, id = "loading") => notify(message, "loading", { id, persist: true }),
      hideNotification: hide,
    }),
    [hide, notify]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationCenter notification={notification} onClose={hide} />
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotification must be used inside NotificationProvider")
  }
  return context
}
