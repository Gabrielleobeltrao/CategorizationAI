const STORAGE_KEY = "recent-opened-clients"
const UPDATE_EVENT = "app:recent-clients-updated"
const MAX_RECENT_CLIENTS = 8

function parseStoredRecentClients(rawValue) {
  try {
    const parsed = JSON.parse(String(rawValue || "[]"))
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => ({
        id: String(item?.id || "").trim(),
        name: String(item?.name || "").trim(),
        to: String(item?.to || "").trim(),
        openedAt: String(item?.openedAt || "").trim(),
      }))
      .filter((item) => item.id && item.name)
  } catch {
    return []
  }
}

export function getRecentOpenedClients() {
  if (typeof window === "undefined") return []
  return parseStoredRecentClients(window.localStorage.getItem(STORAGE_KEY))
}

export function trackClientOpened(input = {}) {
  if (typeof window === "undefined") return []

  const id = String(input?.id || "").trim()
  const name = String(input?.name || "").trim()
  const to = String(input?.to || "").trim() || (id ? `/clients/${id}/ledger` : "")

  if (!id || !name) return getRecentOpenedClients()

  const currentList = getRecentOpenedClients()
  const withoutCurrent = currentList.filter((item) => item.id !== id)

  const nextList = [
    {
      id,
      name,
      to,
      openedAt: new Date().toISOString(),
    },
    ...withoutCurrent,
  ].slice(0, MAX_RECENT_CLIENTS)

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: nextList }))
  return nextList
}

export function subscribeRecentOpenedClients(callback) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {}
  }

  const handleInternalUpdate = () => {
    callback(getRecentOpenedClients())
  }

  const handleStorageUpdate = (event) => {
    if (event.key !== STORAGE_KEY) return
    callback(getRecentOpenedClients())
  }

  window.addEventListener(UPDATE_EVENT, handleInternalUpdate)
  window.addEventListener("storage", handleStorageUpdate)

  return () => {
    window.removeEventListener(UPDATE_EVENT, handleInternalUpdate)
    window.removeEventListener("storage", handleStorageUpdate)
  }
}
