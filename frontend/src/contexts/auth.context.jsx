/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { getAuthBootstrap } from "../services/auth.service"
import { readSessionCache, removeSessionCache, writeSessionCache } from "../utils/sessionCache"

const AuthContext = createContext(null)
const AUTH_SNAPSHOT_CACHE_KEY = "auth:snapshot:v1"

let bootstrapPromise = null
let bootstrapCache = readSessionCache(AUTH_SNAPSHOT_CACHE_KEY, null)

async function loadAuthSnapshot() {
  const snapshot = await getAuthBootstrap().catch(() => null)
  return {
    isAuthenticated: Boolean(snapshot?.isAuthenticated),
    profile: snapshot?.profile || null,
  }
}

async function bootstrapAuthSnapshot(force = false) {
  if (!force && bootstrapCache) return bootstrapCache
  if (!force && bootstrapPromise) return bootstrapPromise

  bootstrapPromise = loadAuthSnapshot()
    .then((result) => {
      bootstrapCache = result
      writeSessionCache(AUTH_SNAPSHOT_CACHE_KEY, result)
      return result
    })
    .finally(() => {
      bootstrapPromise = null
    })

  return bootstrapPromise
}

export function AuthProvider({ children }) {
  const [isBootstrapping, setIsBootstrapping] = useState(() => !bootstrapCache)
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(bootstrapCache?.isAuthenticated))
  const [profile, setProfile] = useState(() => bootstrapCache?.profile || null)

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
    writeSessionCache(AUTH_SNAPSHOT_CACHE_KEY, bootstrapCache)
    setIsAuthenticated(false)
    setProfile(null)
    setIsBootstrapping(false)
  }, [])

  const beginAuthenticatedSession = useCallback(() => {
    setIsAuthenticated(true)
    setIsBootstrapping(true)
  }, [])

  const updateProfile = useCallback((nextProfile) => {
    const safeProfile = nextProfile || null
    bootstrapCache = {
      isAuthenticated: Boolean(safeProfile),
      profile: safeProfile,
    }
    if (safeProfile) {
      writeSessionCache(AUTH_SNAPSHOT_CACHE_KEY, bootstrapCache)
    } else {
      removeSessionCache(AUTH_SNAPSHOT_CACHE_KEY)
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
      beginAuthenticatedSession,
      updateProfile,
    }),
    [beginAuthenticatedSession, clearAuth, isAuthenticated, isBootstrapping, profile, refreshAuth, updateProfile]
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
