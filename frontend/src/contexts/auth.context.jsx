/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api } from "../lib/api"
import { getMyProfile } from "../services/auth.service"

const AuthContext = createContext(null)

let bootstrapPromise = null
let bootstrapCache = null

async function loadAuthSnapshot() {
  const sessionData = await api("/api/auth/get-session", { silentLoading: true }).catch(() => null)
  const isAuthenticated = Boolean(sessionData?.session && sessionData?.user)

  if (!isAuthenticated) {
    return {
      isAuthenticated: false,
      profile: null,
    }
  }

  const profile = await getMyProfile().catch(() => null)

  return {
    isAuthenticated: true,
    profile,
  }
}

async function bootstrapAuthSnapshot(force = false) {
  if (!force && bootstrapCache) return bootstrapCache
  if (!force && bootstrapPromise) return bootstrapPromise

  bootstrapPromise = loadAuthSnapshot()
    .then((result) => {
      bootstrapCache = result
      return result
    })
    .finally(() => {
      bootstrapPromise = null
    })

  return bootstrapPromise
}

export function AuthProvider({ children }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profile, setProfile] = useState(null)

  const refreshAuth = useCallback(async (options = {}) => {
    const force = Boolean(options?.force)
    const snapshot = await bootstrapAuthSnapshot(force)
    setIsAuthenticated(Boolean(snapshot?.isAuthenticated))
    setProfile(snapshot?.profile || null)
    setIsBootstrapping(false)
    return snapshot
  }, [])

  const clearAuth = useCallback(() => {
    bootstrapCache = {
      isAuthenticated: false,
      profile: null,
    }
    setIsAuthenticated(false)
    setProfile(null)
    setIsBootstrapping(false)
  }, [])

  const updateProfile = useCallback((nextProfile) => {
    const safeProfile = nextProfile || null
    bootstrapCache = {
      isAuthenticated: Boolean(safeProfile),
      profile: safeProfile,
    }
    setIsAuthenticated(Boolean(safeProfile))
    setProfile(safeProfile)
  }, [])

  useEffect(() => {
    let active = true

    bootstrapAuthSnapshot(false)
      .then((snapshot) => {
        if (!active) return
        setIsAuthenticated(Boolean(snapshot?.isAuthenticated))
        setProfile(snapshot?.profile || null)
      })
      .finally(() => {
        if (!active) return
        setIsBootstrapping(false)
      })

    return () => {
      active = false
    }
  }, [])

  const value = useMemo(
    () => ({
      isBootstrapping,
      isAuthenticated,
      profile,
      refreshAuth,
      clearAuth,
      updateProfile,
    }),
    [clearAuth, isAuthenticated, isBootstrapping, profile, refreshAuth, updateProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }
  return context
}
