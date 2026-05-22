// Centralized handler for domain errors raised by the backend. Reads
// `err.code` and either:
//   - returns an action descriptor so the caller can render a contextual
//     toast (Reopen period, Open reconciliation, etc.), or
//   - falls back to a plain message-only toast.
//
// Usage:
//   try { ... } catch (err) {
//     showError(error, navigate, clientId, err, "Failed to update")
//   }
// where `error` comes from useNotification().

function buildAction(label, onClick) {
    if (!label || typeof onClick !== "function") return null
    return { label, onClick }
}

export function actionForError(err, { navigate, clientId } = {}) {
    if (!err || !err.code) return null
    if (err.code === "PERIOD_CLOSED" && clientId && navigate) {
        return buildAction("Open Period Close", () =>
            navigate(`/clients/${clientId}/period-close`),
        )
    }
    if (err.code === "RECONCILED_TRANSACTION_LOCKED" && clientId && navigate) {
        return buildAction("Open Reconciliation", () =>
            navigate(`/clients/${clientId}/reconciliation`),
        )
    }
    return null
}

// Convenience wrapper: shows an error toast and attaches an action when
// the error code is one we know how to deep-link.
//
//   showApiError({
//     error: notification.error,
//     err,
//     fallbackMessage: "Failed to update transaction",
//     navigate,                   // from useNavigate()
//     clientId,                   // from useParams()
//   })
export function showApiError({
    error,
    err,
    fallbackMessage = "Something went wrong",
    navigate,
    clientId,
}) {
    if (typeof error !== "function") return
    const message = err?.message || fallbackMessage
    const action = actionForError(err, { navigate, clientId })
    if (action) {
        // Persist the toast so the user has time to click the action.
        error(message, { action, persist: true })
    } else {
        error(message)
    }
}
