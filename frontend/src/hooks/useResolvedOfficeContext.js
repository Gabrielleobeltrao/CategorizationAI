import { useEffect, useRef, useState } from "react"
import { useAuth } from "../contexts/auth.context"

export function useResolvedOfficeContext() {
  const { profile, refreshAuth } = useAuth()
  const [isResolvingOfficeContext, setIsResolvingOfficeContext] = useState(false)
  const hasRetriedOfficeContext = useRef(false)

  const officeId = String(profile?.officeId || "").trim()
  const email = String(profile?.email || "").trim().toLowerCase()

  useEffect(() => {
    let active = true

    if (officeId || !email || hasRetriedOfficeContext.current) {
      setIsResolvingOfficeContext(false)
      return () => {
        active = false
      }
    }

    hasRetriedOfficeContext.current = true
    setIsResolvingOfficeContext(true)

    refreshAuth({ force: true })
      .catch(() => null)
      .finally(() => {
        if (!active) return
        setIsResolvingOfficeContext(false)
      })

    return () => {
      active = false
    }
  }, [email, officeId, refreshAuth])

  useEffect(() => {
    if (officeId) {
      hasRetriedOfficeContext.current = false
    }
  }, [officeId])

  return {
    officeId,
    isResolvingOfficeContext,
  }
}
