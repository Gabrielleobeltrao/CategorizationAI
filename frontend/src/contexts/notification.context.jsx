import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import NotificationCenter from "../components/ui/NotificationCenter"

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null)

  const hide = useCallback(() => {
    setNotification(null)
  }, [])

  const notify = useCallback((message, type = "info") => {
    if (!message) return
    setNotification({
      id: Date.now(),
      type,
      message,
    })
  }, [])

  useEffect(() => {
    if (!notification) return
    const timeout = setTimeout(() => {
      setNotification(null)
    }, 3500)

    return () => clearTimeout(timeout)
  }, [notification])

  const value = useMemo(
    () => ({
      notify,
      success: (message) => notify(message, "success"),
      error: (message) => notify(message, "error"),
      info: (message) => notify(message, "info"),
    }),
    [notify]
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

