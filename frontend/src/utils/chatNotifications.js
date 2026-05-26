const ENABLED_KEY = "chat:notifications-enabled"
const IN_APP_KEY = "chat:in-app-popups-enabled"
const CHANGE_EVENT = "chat:notifications-enabled-changed"
const IN_APP_CHANGE_EVENT = "chat:in-app-popups-changed"

export function isChatNotificationsEnabled() {
    if (typeof window === "undefined") return false
    try {
        return window.localStorage?.getItem(ENABLED_KEY) === "true"
    } catch {
        return false
    }
}

export function setChatNotificationsEnabled(enabled) {
    if (typeof window === "undefined") return
    try {
        window.localStorage?.setItem(ENABLED_KEY, enabled ? "true" : "false")
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled: Boolean(enabled) } }))
    } catch {
        /* ignore */
    }
}

export function subscribeChatNotificationsEnabled(handler) {
    if (typeof window === "undefined") return () => {}
    const listener = (event) => handler(Boolean(event?.detail?.enabled))
    window.addEventListener(CHANGE_EVENT, listener)
    return () => window.removeEventListener(CHANGE_EVENT, listener)
}

// In-app popups are ON by default (no permission needed, safe fallback when
// the browser notification is unavailable or blocked).
export function isInAppPopupsEnabled() {
    if (typeof window === "undefined") return true
    try {
        const raw = window.localStorage?.getItem(IN_APP_KEY)
        return raw === null ? true : raw === "true"
    } catch {
        return true
    }
}

export function setInAppPopupsEnabled(enabled) {
    if (typeof window === "undefined") return
    try {
        window.localStorage?.setItem(IN_APP_KEY, enabled ? "true" : "false")
        window.dispatchEvent(new CustomEvent(IN_APP_CHANGE_EVENT, { detail: { enabled: Boolean(enabled) } }))
    } catch {
        /* ignore */
    }
}

export function subscribeInAppPopupsEnabled(handler) {
    if (typeof window === "undefined") return () => {}
    const listener = (event) => handler(Boolean(event?.detail?.enabled))
    window.addEventListener(IN_APP_CHANGE_EVENT, listener)
    return () => window.removeEventListener(IN_APP_CHANGE_EVENT, listener)
}

export function getNotificationPermission() {
    if (typeof Notification === "undefined") return "unsupported"
    return Notification.permission
}

export async function requestNotificationPermission() {
    if (typeof Notification === "undefined") return "unsupported"
    if (Notification.permission === "granted") return "granted"
    if (Notification.permission === "denied") return "denied"
    try {
        return await Notification.requestPermission()
    } catch {
        return "denied"
    }
}

// Fires a desktop notification if the feature is on and permission is granted.
// Returns the Notification object so the caller can hook a click handler.
// Logs diagnostics to the console when it can't fire so silent failures
// are debuggable.
export function fireChatNotification({ title, body, tag, onClick }) {
    if (typeof Notification === "undefined") {
        console.warn("[chat-notif] Notification API not supported in this browser")
        return null
    }
    if (!isChatNotificationsEnabled()) {
        console.warn("[chat-notif] skipped — chat notifications are disabled in Settings")
        return null
    }
    if (Notification.permission !== "granted") {
        console.warn(`[chat-notif] skipped — browser permission is "${Notification.permission}"`)
        return null
    }
    try {
        const notif = new Notification(title, {
            body,
            tag,
            icon: "/favicon.ico",
        })
        if (onClick) {
            notif.onclick = (event) => {
                event.preventDefault()
                window.focus()
                onClick()
                notif.close()
            }
        }
        return notif
    } catch (err) {
        console.warn("[chat-notif] firing failed:", err?.message || err)
        return null
    }
}
