/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { getAuthBootstrap } from "../services/auth.service"
import { hydrateAvailableRolesCache, hydrateRolePermissionsCache } from "../services/employees.service"
import { hydrateOfficeCache } from "../services/office.service"
import { hydrateOfficeTagsCache } from "../hooks/useOfficeTags"
import { readSessionCache, removeSessionCache, writeSessionCache } from "../utils/sessionCache"

const AuthContext = createContext(null)
const AUTH_SNAPSHOT_CACHE_KEY = "auth:snapshot:v2"

const DEFAULT_FEATURES = Object.freeze({
  crm: false,
})

function resolveFeatures(office) {
  const raw = office?.features
  return {
    ...DEFAULT_FEATURES,
    ...(raw && typeof raw === "object" ? raw : {}),
    crm: Boolean(raw?.crm),
  }
}

let bootstrapPromise = null
let bootstrapCache = readSessionCache(AUTH_SNAPSHOT_CACHE_KEY, null)

function hydrateBootstrapCaches(snapshot) {
  const officeId = String(snapshot?.profile?.officeId || snapshot?.office?._id || "").trim()
  if (snapshot?.office) hydrateOfficeCache(snapshot.office)
  if (officeId && Array.isArray(snapshot?.officeTags)) hydrateOfficeTagsCache(officeId, snapshot.officeTags)
  if (officeId && Array.isArray(snapshot?.roles)) hydrateAvailableRolesCache(officeId, snapshot.roles)
  if (Array.isArray(snapshot?.permissionCatalog)) hydrateRolePermissionsCache(snapshot.permissionCatalog)
}

async function loadAuthSnapshot() {
  const snapshot = await getAuthBootstrap().catch(() => null)
  hydrateBootstrapCaches(snapshot)

  return {
    isAuthenticated: Boolean(snapshot?.isAuthenticated),
    profile: snapshot?.profile || null,
    office: snapshot?.office || null,
    officeTags: Array.isArray(snapshot?.officeTags) ? snapshot.officeTags : [],
    roles: Array.isArray(snapshot?.roles) ? snapshot.roles : [],
    permissionCatalog: Array.isArray(snapshot?.permissionCatalog) ? snapshot.permissionCatalog : [],
  }
}

async function bootstrapAuthSnapshot(force = false) {
  if (!force && bootstrapCache) {
    hydrateBootstrapCaches(bootstrapCache)
    return bootstrapCache
  }
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
  const [office, setOffice] = useState(() => bootstrapCache?.office || null)

  const refreshAuth = useCallback(async (options = {}) => {
    const force = Boolean(options?.force)
    const snapshot = await bootstrapAuthSnapshot(force)
    setIsAuthenticated(Boolean(snapshot?.isAuthenticated))
    setProfile(snapshot?.profile || null)
    setOffice(snapshot?.office || null)
    setIsBootstrapping(false)
    return snapshot
  }, [])

  const clearAuth = useCallback(() => {
    bootstrapCache = {
      isAuthenticated: false,
      profile: null,
      office: null,
    }
    writeSessionCache(AUTH_SNAPSHOT_CACHE_KEY, bootstrapCache)
    setIsAuthenticated(false)
    setProfile(null)
    setOffice(null)
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
      office: safeProfile ? (bootstrapCache?.office || null) : null,
    }
    if (safeProfile) {
      writeSessionCache(AUTH_SNAPSHOT_CACHE_KEY, bootstrapCache)
    } else {
      removeSessionCache(AUTH_SNAPSHOT_CACHE_KEY)
      setOffice(null)
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
        setOffice(snapshot?.office || null)
      })
      .finally(() => {
        if (!active) return
        setIsBootstrapping(false)
      })

    return () => {
      active = false
    }
  }, [])

  const features = useMemo(() => resolveFeatures(office), [office])

  const value = useMemo(
    () => ({
      isBootstrapping,
      isAuthenticated,
      profile,
      office,
      features,
      refreshAuth,
      clearAuth,
      beginAuthenticatedSession,
      updateProfile,
    }),
    [beginAuthenticatedSession, clearAuth, features, isAuthenticated, isBootstrapping, office, profile, refreshAuth, updateProfile]
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
