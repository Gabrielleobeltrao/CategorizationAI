import {
    DEFAULT_OPERATIONAL_STATUS,
    isManualOperationalStatus,
    isValidOperationalStatus,
} from "../lib/operationalStatuses.js"
import {
    getClientOperationalStatus,
    listOperationalStatusesByOfficeId,
    setManualStatus,
    upsertComputedStatus,
} from "../repositories/clientOperationalStatus.repository.js"
import { getClientById, listAllClientsByOfficeId } from "../repositories/clients.repository.js"
import { getClientYearOperationalSignals } from "../repositories/transactions.repository.js"

function ensureClientBelongsToOffice(client, officeId) {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) throw new Error("Office context required")
    if (!client || String(client?.officeId || "") !== safeOfficeId) {
        throw new Error("Forbidden for this office")
    }
}

function getCurrentYearForRules() {
    // Current calendar year (UTC) — matches how transaction dates are stored.
    // README documents this scope; switch to a configurable fiscal year here
    // when that feature lands.
    return String(new Date().getUTCFullYear())
}

/**
 * Automatic Operational Status computation.
 *
 * Rules (current-year scope, ordered by precedence — first match wins):
 *
 *   1. onboarding         — no imported transactions at all
 *   2. waiting_documents  — has transactions but the current year is not
 *                           fully covered (fewer than 12 distinct months)
 *   3. categorizing       — every month of the current year has transactions
 *                           but some remain uncategorized
 *   4. ready_to_review    — every month of the current year has transactions
 *                           and all of them are categorized
 *
 * Manual statuses (paused, completed) live on a separate field and override
 * whatever this function returns — see normalizeRecord / effectiveStatus.
 *
 * Keep these rules in sync with the README "Operational Status rules" section.
 */
export async function computeOperationalStatusForClient(client) {
    if (!client?._id) return null

    const year = getCurrentYearForRules()
    const signals = await getClientYearOperationalSignals(String(client._id), year)
    const { totalCount, monthsInYear, uncategorizedInYear } = signals

    if (totalCount === 0) {
        return { status: "onboarding", reason: "No transactions imported yet." }
    }

    if (monthsInYear.length < 12) {
        const missing = 12 - monthsInYear.length
        return {
            status: "waiting_documents",
            reason: `Current year (${year}) missing ${missing} month(s) of transactions.`,
        }
    }

    if (uncategorizedInYear > 0) {
        return {
            status: "categorizing",
            reason: `Current year (${year}) has ${uncategorizedInYear} uncategorized transaction(s).`,
        }
    }

    return {
        status: "ready_to_review",
        reason: `Current year (${year}) fully covered and categorized.`,
    }
}

// Runs the compute and persists the result. Returns the latest stored record
// (or a default-shaped synthetic one when the rules don't return anything).
async function runComputeAndPersist(client) {
    const computed = await computeOperationalStatusForClient(client)
    if (!computed) {
        return (
            (await getClientOperationalStatus(client._id)) ||
            buildDefaultRecord(client)
        )
    }
    return upsertComputedStatus({
        clientId: String(client._id),
        officeId: String(client.officeId || ""),
        status: computed.status,
        reason: computed.reason,
    })
}

function buildDefaultRecord(client) {
    return {
        clientId: String(client?._id || ""),
        officeId: String(client?.officeId || ""),
        computedStatus: null,
        computedAt: null,
        computedReason: "",
        manualStatus: null,
        manualReason: "",
        manualSetAt: null,
        manualSetBy: "",
        effectiveStatus: DEFAULT_OPERATIONAL_STATUS,
        updatedAt: null,
    }
}

export async function getOperationalStatusForClientService(clientId, context = {}) {
    if (!clientId) throw new Error("clientId is required")
    const client = await getClientById(clientId)
    ensureClientBelongsToOffice(client, context?.actorOfficeId)

    // Always refresh on single-client read — cheap (one aggregation) and keeps
    // the badge in sync after CSV imports / category updates without us having
    // to wire recompute into every mutation path.
    return runComputeAndPersist(client)
}

export async function listOperationalStatusesByOfficeIdService(officeId, context = {}) {
    if (!officeId) throw new Error("officeId is required")
    const actorOfficeId = String(context?.actorOfficeId || "").trim()
    if (actorOfficeId && actorOfficeId !== officeId) {
        throw new Error("Forbidden for this office")
    }

    // Recompute every client in the office so the clients list shows fresh
    // badges. For early-phase offices (≤ a few hundred clients) this is fine
    // as one aggregation each; revisit with a staleness cache if it grows.
    const clients = await listAllClientsByOfficeId(officeId)
    const computed = await Promise.all(clients.map((client) => runComputeAndPersist(client)))

    // Merge with any pre-existing records (e.g. clients deleted from the
    // collection but whose status row still lingers — unlikely but harmless).
    const stored = await listOperationalStatusesByOfficeId(officeId)
    const byClientId = new Map()
    for (const record of stored) byClientId.set(record.clientId, record)
    for (const record of computed) {
        if (record?.clientId) byClientId.set(record.clientId, record)
    }
    return Array.from(byClientId.values())
}

export async function setManualOperationalStatusService(clientId, patch, context = {}) {
    if (!clientId) throw new Error("clientId is required")
    const client = await getClientById(clientId)
    ensureClientBelongsToOffice(client, context?.actorOfficeId)

    const requestedStatus = patch?.status === null || patch?.status === ""
        ? null
        : String(patch?.status || "")

    if (requestedStatus !== null) {
        if (!isValidOperationalStatus(requestedStatus)) {
            throw new Error("invalid operational status")
        }
        if (!isManualOperationalStatus(requestedStatus)) {
            throw new Error("this status cannot be set manually")
        }
    }

    return setManualStatus({
        clientId,
        officeId: client.officeId,
        status: requestedStatus,
        reason: patch?.reason,
        setBy: context?.actorProfileId || "",
    })
}

export async function recomputeOperationalStatusForClient(clientId, context = {}) {
    if (!clientId) throw new Error("clientId is required")
    const client = await getClientById(clientId)
    ensureClientBelongsToOffice(client, context?.actorOfficeId)
    return runComputeAndPersist(client)
}

/**
 * Internal recompute trigger — meant to be called fire-and-forget from
 * transaction mutation entry points (CSV import, edits, deletes, LLM
 * categorization). Skips the office-context guard because it's invoked by
 * trusted internal flows, not by an end-user request.
 *
 * Use {@link scheduleOperationalStatusRecompute} when you don't want to await.
 */
export async function recomputeOperationalStatusForClientInternal(clientId) {
    const safeClientId = String(clientId || "").trim()
    if (!safeClientId) return null
    const client = await getClientById(safeClientId)
    if (!client) return null
    return runComputeAndPersist(client)
}

// Fire-and-forget batch recompute. Accepts a single id or an array; dedupes
// and never rejects to the caller (mutations should never fail because the
// CRM signal failed to refresh).
export function scheduleOperationalStatusRecompute(clientIdOrIds) {
    const raw = Array.isArray(clientIdOrIds) ? clientIdOrIds : [clientIdOrIds]
    const unique = Array.from(
        new Set(
            raw
                .map((id) => String(id || "").trim())
                .filter(Boolean)
        )
    )
    if (unique.length === 0) return

    Promise.resolve()
        .then(() => Promise.all(unique.map((id) => recomputeOperationalStatusForClientInternal(id))))
        .catch((error) => {
            // eslint-disable-next-line no-console
            console.error("[operationalStatus] scheduled recompute failed", error)
        })
}
