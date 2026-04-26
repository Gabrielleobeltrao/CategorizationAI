import { api } from "../lib/api"
import { readSessionCache, removeSessionCache, writeSessionCache } from "../utils/sessionCache"

const clientsListCache = new Map()
const CLIENTS_LIST_CACHE_PREFIX = "cache:clients-list:"
const clientLedgerBootstrapCache = new Map()
const CLIENT_LEDGER_BOOTSTRAP_CACHE_PREFIX = "cache:client-ledger-bootstrap:"

function getClientsListCacheKey(officeId, options = {}) {
  return JSON.stringify({
    officeId: String(officeId || "").trim(),
    page: Number(options.page || 1),
    limit: Number(options.limit || 10),
    search: String(options.search || "").trim(),
  })
}

export function getCachedClientsListByOfficeId(officeId, options = {}) {
  const key = getClientsListCacheKey(officeId, options)
  if (clientsListCache.has(key)) {
    return clientsListCache.get(key) || null
  }

  const persisted = readSessionCache(`${CLIENTS_LIST_CACHE_PREFIX}${key}`, null)
  if (persisted) {
    clientsListCache.set(key, persisted)
    return persisted
  }

  return null
}

export function clearClientsListCache(officeId = "") {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    clientsListCache.clear()
    if (typeof window !== "undefined") {
      Object.keys(window.sessionStorage)
        .filter((storageKey) => storageKey.startsWith(CLIENTS_LIST_CACHE_PREFIX))
        .forEach((storageKey) => removeSessionCache(storageKey))
    }
    return
  }

  for (const key of clientsListCache.keys()) {
    if (key.includes(`"officeId":"${safeOfficeId}"`)) {
      clientsListCache.delete(key)
      removeSessionCache(`${CLIENTS_LIST_CACHE_PREFIX}${key}`)
    }
  }
}

export async function listClientsByOfficeId(officeId, options = {}) {
  const cleanOfficeId = String(officeId || "").trim()
  if (!cleanOfficeId) throw new Error("officeId is required")

  const page = Number(options.page || 1)
  const limit = Number(options.limit || 10)
  const search = String(options.search || "").trim()
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  if (search) {
    params.set("search", search)
  }

  const payload = await api(`/api/offices/${cleanOfficeId}/clients?${params.toString()}`, {
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })
  const cacheKey = getClientsListCacheKey(cleanOfficeId, options)
  clientsListCache.set(cacheKey, payload)
  writeSessionCache(`${CLIENTS_LIST_CACHE_PREFIX}${cacheKey}`, payload)
  return payload
}

export async function createClient(input) {
  const officeId = String(input?.officeId || "").trim()
  const name = String(input?.name || "").trim()
  const businessType = String(input?.businessType || "").trim()
  const description = String(input?.description || "").trim()
  const mainActivity = String(input?.mainActivity || "").trim()
  const state = String(input?.state || "").trim()
  const tags = Array.isArray(input?.tags)
    ? input.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
    : []
  const owners = Array.isArray(input?.owners)
    ? input.owners
      .map((owner) => {
        if (typeof owner === "string") {
          return {
            name: owner.trim(),
            email: "",
            phone: "",
          }
        }

        return {
          name: String(owner?.name || "").trim(),
          email: String(owner?.email || "").trim(),
          phone: String(owner?.phone || "").trim(),
        }
      })
      .filter((owner) => owner.name || owner.email || owner.phone)
    : []

  if (!officeId) throw new Error("officeId is required")
  if (!name) throw new Error("name is required")
  if (!businessType) throw new Error("businessType is required")
  if (!description) throw new Error("description is required")
  if (!mainActivity) throw new Error("mainActivity is required")
  if (!state) throw new Error("state is required")

  const payload = {
    officeId,
    name,
    businessType,
    description,
    mainActivity,
    state,
    tags,
    owners,
  }

  return api("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getClientById(clientId) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")

  return api(`/api/clients/${id}`)
}

function getClientLedgerBootstrapCacheKey(clientId) {
  return String(clientId || "").trim()
}

function isDefaultLedgerBootstrapOptions(options = {}) {
  return (
    !String(options.search || "").trim() &&
    (!Array.isArray(options.accountIds) || options.accountIds.length === 0) &&
    (!Array.isArray(options.categoryIds) || options.categoryIds.length === 0) &&
    !Boolean(options.includeUncategorizedIncome) &&
    !Boolean(options.includeUncategorizedExpenses) &&
    String(options.splitMode || "all").trim().toLowerCase() === "all" &&
    String(options.amountSign || "all").trim().toLowerCase() === "all" &&
    String(options.llmProcessed || "all").trim().toLowerCase() === "all" &&
    String(options.iconType || "all").trim().toLowerCase() === "all" &&
    !String(options.fromDate || "").trim() &&
    !String(options.toDate || "").trim() &&
    (!Array.isArray(options.years) || options.years.length === 0) &&
    (!Array.isArray(options.months) || options.months.length === 0) &&
    (options.minAmount === undefined || String(options.minAmount).trim() === "") &&
    (options.maxAmount === undefined || String(options.maxAmount).trim() === "") &&
    !String(options.cursor || "").trim() &&
    String(options.paginationMode || "page").trim().toLowerCase() === "cursor"
  )
}

export function getCachedClientLedgerBootstrap(clientId) {
  const key = getClientLedgerBootstrapCacheKey(clientId)
  if (!key) return null

  if (clientLedgerBootstrapCache.has(key)) {
    return clientLedgerBootstrapCache.get(key) || null
  }

  const persisted = readSessionCache(`${CLIENT_LEDGER_BOOTSTRAP_CACHE_PREFIX}${key}`, null)
  if (persisted) {
    clientLedgerBootstrapCache.set(key, persisted)
    return persisted
  }

  return null
}

export async function getClientLedgerBootstrap(clientId, options = {}) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")

  const params = new URLSearchParams()
  const accountIds = Array.isArray(options.accountIds) ? options.accountIds : []
  const categoryIds = Array.isArray(options.categoryIds) ? options.categoryIds : []
  const years = Array.isArray(options.years) ? options.years : []
  const months = Array.isArray(options.months) ? options.months : []
  const search = String(options.search || "").trim()
  const paginationMode = String(options.paginationMode || "page").trim().toLowerCase()
  const cursor = String(options.cursor || "").trim()
  const limit = Number(options.limit || 50)

  params.set("limit", String(limit))
  if (paginationMode === "cursor") {
    params.set("paginationMode", "cursor")
    if (cursor) params.set("cursor", cursor)
  } else {
    params.set("page", String(Number(options.page || 1)))
  }

  if (search) params.set("search", search)
  if (accountIds.length > 0) params.set("accountIds", accountIds.join(","))
  if (categoryIds.length > 0) params.set("categoryIds", categoryIds.join(","))
  if (options.includeUncategorizedIncome) params.set("includeUncategorizedIncome", "true")
  if (options.includeUncategorizedExpenses) params.set("includeUncategorizedExpenses", "true")
  if (String(options.splitMode || "all").trim().toLowerCase() !== "all") params.set("splitMode", String(options.splitMode || "all").trim().toLowerCase())
  if (String(options.amountSign || "all").trim().toLowerCase() !== "all") params.set("amountSign", String(options.amountSign || "all").trim().toLowerCase())
  if (String(options.fromDate || "").trim()) params.set("fromDate", String(options.fromDate || "").trim())
  if (String(options.toDate || "").trim()) params.set("toDate", String(options.toDate || "").trim())
  if (years.length > 0) params.set("years", years.join(","))
  if (months.length > 0) params.set("months", months.join(","))
  if (String(options.llmProcessed || "all").trim().toLowerCase() !== "all") params.set("llmProcessed", String(options.llmProcessed || "all").trim().toLowerCase())
  if (String(options.iconType || "all").trim().toLowerCase() !== "all") params.set("iconType", String(options.iconType || "all").trim().toLowerCase())
  if (options.minAmount !== undefined && String(options.minAmount).trim() !== "") params.set("minAmount", String(options.minAmount).trim())
  if (options.maxAmount !== undefined && String(options.maxAmount).trim() !== "") params.set("maxAmount", String(options.maxAmount).trim())

  const payload = await api(`/api/clients/${id}/ledger-bootstrap?${params.toString()}`, {
    silentLoading: Boolean(options.silentLoading),
    backgroundLoadingMessage: options?.backgroundLoadingMessage,
  })

  if (isDefaultLedgerBootstrapOptions(options)) {
    const cacheKey = getClientLedgerBootstrapCacheKey(id)
    clientLedgerBootstrapCache.set(cacheKey, payload)
    writeSessionCache(`${CLIENT_LEDGER_BOOTSTRAP_CACHE_PREFIX}${cacheKey}`, payload)
  }

  return payload
}

export async function updateClientById(clientId, patch) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const nextPatch = { ...patch }
  if (Array.isArray(patch?.tags)) {
    nextPatch.tags = patch.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
  }

  return api(`/api/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(nextPatch),
  })
}

export async function deleteClientById(clientId) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")

  return api(`/api/clients/${id}`, {
    method: "DELETE",
  })
}
