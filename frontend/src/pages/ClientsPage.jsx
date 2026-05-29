import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import OperationalStatusPopover from "../components/crm/OperationalStatusPopover"
import OperationalStatusHelp from "../components/crm/OperationalStatusHelp"
import { useNotification } from "../contexts/notification.context"
import { useResolvedOfficeContext } from "../hooks/useResolvedOfficeContext"
import { useFeature } from "../hooks/useFeature"
import { trackClientOpened } from "../utils/recentClients"
import {
    DEFAULT_OPERATIONAL_STATUS,
    OPERATIONAL_STATUS_LIST,
    getOperationalStatusBadgeClass,
} from "../constants/operationalStatuses"
import BusinessTypeSelect from "../components/ui/BusinessTypeSelect"
import { listOperationalStatusesByOfficeId } from "../services/operationalStatus.service"
import {
    clearClientsListCache,
    createClient,
    deleteClientById,
    getCachedClientsListByOfficeId,
    listClientsByOfficeId,
    updateClientById,
} from "../services/clients.service"

function normalizeOwnersList(owners = []) {
    if (!Array.isArray(owners)) return []

    const normalized = []
    const dedupe = new Set()

    for (const owner of owners) {
        let name = ""
        let email = ""
        let phone = ""

        if (typeof owner === "string") {
            name = owner.trim()
        } else if (owner && typeof owner === "object") {
            name = String(owner.name || "").trim()
            email = String(owner.email || "").trim()
            phone = String(owner.phone || "").trim()
        } else {
            continue
        }

        if (!name && !email && !phone) continue

        const key = `${name.toLowerCase()}|${email.toLowerCase()}|${phone.toLowerCase()}`
        if (dedupe.has(key)) continue
        dedupe.add(key)

        normalized.push({
            name,
            email,
            phone,
        })
    }

    return normalized
}

function normalizeOwnersForDraft(owners = []) {
    if (!Array.isArray(owners) || owners.length === 0) {
        return [{ name: "", email: "", phone: "" }]
    }

    const mapped = owners.map((owner) => {
        if (typeof owner === "string") {
            return {
                name: owner,
                email: "",
                phone: "",
            }
        }

        if (owner && typeof owner === "object") {
            return {
                name: String(owner.name || ""),
                email: String(owner.email || ""),
                phone: String(owner.phone || ""),
            }
        }

        return {
            name: "",
            email: "",
            phone: "",
        }
    })

    return mapped.length > 0 ? mapped : [{ name: "", email: "", phone: "" }]
}

function getEmptyClientDraft() {
    return {
        name: "",
        businessType: "",
        description: "",
        mainActivity: "",
        state: "",
        address: "",
        owners: [{ name: "", email: "", phone: "" }],
    }
}

function mapClientItem(item = {}) {
    return {
        id: item?._id || item?.id || "",
        name: item?.name || "",
        businessType: item?.businessType || "",
        description: item?.description || "",
        mainActivity: item?.mainActivity || "",
        state: item?.state || "",
        address: item?.address || "",
        owners: normalizeOwnersForDraft(item?.owners),
        ownerEmail: String(item?.ownerEmail || ""),
        ownerPhone: String(item?.ownerPhone || ""),
        createdAt: item?.createdAt || "",
        updatedAt: item?.updatedAt || "",
    }
}

function formatClientDate(value = "") {
    const safe = String(value || "").trim()
    if (!safe) return "-"

    const parsed = new Date(safe)
    if (Number.isNaN(parsed.getTime())) return "-"

    return parsed.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
}

function hasOwnerContactInfo(owner = {}) {
    if (!owner || typeof owner !== "object") return false

    return Boolean(
        String(owner.name || "").trim() ||
        String(owner.email || "").trim() ||
        String(owner.phone || "").trim()
    )
}

function hasLegacyOwnerContact(client = {}) {
    return Boolean(
        String(client?.ownerEmail || "").trim() ||
        String(client?.ownerPhone || "").trim()
    )
}

function ClientsPage() {

    const navigate = useNavigate()
    const { success, error } = useNotification()
    const [clients, setClients] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    const [showClientForm, setShowClientForm] = useState(false)
    const [newClientName, setNewClientName] = useState("")
    const [newClientBusinessType, setNewClientBusinessType] = useState("")
    const [newClientDescription, setNewClientDescription] = useState("")
    const [newClientMainActivity, setNewClientMainActivity] = useState("")
    const [newClientState, setNewClientState] = useState("")
    const [newClientAddress, setNewClientAddress] = useState("")
    const [newClientOwners, setNewClientOwners] = useState([{ name: "", email: "", phone: "" }])

    const [editingClientId, setEditingClientId] = useState("")
    const [editingClientDraft, setEditingClientDraft] = useState(getEmptyClientDraft())
    const [clientToDelete, setClientToDelete] = useState(null)
    const [expandedClientIds, setExpandedClientIds] = useState([])

    const { officeId, isResolvingOfficeContext } = useResolvedOfficeContext()
    const isOperationalStatusEnabled = useFeature("crmOperationalStatus")
    const [operationalStatusMap, setOperationalStatusMap] = useState({})
    // statusFilter is mirrored to the URL `?status=` so external pages
    // (e.g. the Bookkeeping Overview pipeline card) can deep-link into
    // a pre-filtered Clients list.
    const [searchParams, setSearchParams] = useSearchParams()
    const statusFilter = searchParams.get("status") || ""
    const setStatusFilter = (next) => {
        const safe = String(next || "")
        setSearchParams((current) => {
            const updated = new URLSearchParams(current)
            if (safe) updated.set("status", safe)
            else updated.delete("status")
            return updated
        }, { replace: true })
    }
    const canSubmitNewClient = Boolean(
        !isSubmitting &&
        !isResolvingOfficeContext &&
        String(newClientName || "").trim()
    )

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm.trim())
        }, 300)

        return () => {
            clearTimeout(timeoutId)
        }
    }, [searchTerm])

    useEffect(() => {
        setPage(1)
    }, [debouncedSearchTerm])

    useEffect(() => {
        let active = true

        if (!officeId) {
            setClients([])
            setTotal(0)
            setTotalPages(1)
            return () => {
                active = false
            }
        }

        const requestOptions = { page, limit, search: debouncedSearchTerm }
        const cachedPayload = getCachedClientsListByOfficeId(officeId, requestOptions)

        if (cachedPayload) {
            const mapped = Array.isArray(cachedPayload?.items)
                ? cachedPayload.items.map(mapClientItem)
                : []
            setClients(mapped)
            setTotal(Number(cachedPayload?.total || 0))
            setTotalPages(Number(cachedPayload?.totalPages || 1))
            setIsLoading(false)
        } else {
            setIsLoading(true)
        }

        listClientsByOfficeId(officeId, {
            ...requestOptions,
            backgroundLoadingMessage: cachedPayload ? "Updating cached clients..." : "",
        })
            .then((payload) => {
                if (!active) return
                const mapped = Array.isArray(payload?.items)
                    ? payload.items.map(mapClientItem)
                    : []
                setClients(mapped)
                setTotal(Number(payload?.total || 0))
                setTotalPages(Number(payload?.totalPages || 1))
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load clients")
                setClients([])
                setTotal(0)
                setTotalPages(1)
            })
            .finally(() => {
                if (!active) return
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [officeId, refreshKey, page, limit, debouncedSearchTerm, error])

    useEffect(() => {
        if (!officeId || !isOperationalStatusEnabled) {
            setOperationalStatusMap({})
            return undefined
        }
        let active = true
        listOperationalStatusesByOfficeId(officeId)
            .then((items) => {
                if (!active) return
                const map = {}
                for (const item of items) {
                    if (item?.clientId) map[String(item.clientId)] = item
                }
                setOperationalStatusMap(map)
            })
            .catch(() => {
                if (active) setOperationalStatusMap({})
            })
        return () => { active = false }
    }, [officeId, isOperationalStatusEnabled])

    const getEffectiveStatus = useMemo(() => (clientId) => {
        const entry = operationalStatusMap[String(clientId)]
        return entry?.effectiveStatus || DEFAULT_OPERATIONAL_STATUS
    }, [operationalStatusMap])

    const displayedClients = useMemo(() => {
        if (!isOperationalStatusEnabled || !statusFilter) return clients
        return clients.filter((client) => getEffectiveStatus(client.id) === statusFilter)
    }, [clients, statusFilter, isOperationalStatusEnabled, getEffectiveStatus])

    // Status counts across the office (not the current page) — drives the
    // pipeline pills row above the list.
    const statusCounts = useMemo(() => {
        const map = {}
        for (const entry of Object.values(operationalStatusMap)) {
            const id = entry?.effectiveStatus || DEFAULT_OPERATIONAL_STATUS
            map[id] = (map[id] || 0) + 1
        }
        return map
    }, [operationalStatusMap])

    const handleCreateClient = async (e) => {
        e.preventDefault()

        if (!officeId) {
            error("Office context is not available yet. Refresh the page and try again.")
            return
        }

        try {
            setIsSubmitting(true)

            const created = await createClient({
                officeId,
                name: newClientName,
                businessType: newClientBusinessType,
                description: newClientDescription,
                mainActivity: newClientMainActivity,
                state: newClientState,
                address: newClientAddress,
                owners: normalizeOwnersList(newClientOwners),
            })

            const mappedClient = mapClientItem(created)

            setClients((current) => {
                if (page !== 1 || debouncedSearchTerm) return current
                return [mappedClient, ...current].slice(0, limit)
            })
            setTotal((current) => {
                const nextTotal = current + 1
                setTotalPages((currentPages) => Math.max(currentPages, Math.ceil(nextTotal / limit)))
                return nextTotal
            })

            success("Client created successfully")
            clearClientsListCache(officeId)
            setNewClientName("")
            setNewClientBusinessType("")
            setNewClientDescription("")
            setNewClientMainActivity("")
            setNewClientState("")
            setNewClientAddress("")
            setNewClientOwners([{ name: "", email: "", phone: "" }])
            setShowClientForm(false)
            if (page !== 1) {
                setPage(1)
            }
        } catch (err) {
            error(err.message || "Failed to create client")
        } finally {
            setIsSubmitting(false)
        }
    }

    const closeEditClientModal = () => {
        setEditingClientId("")
        setEditingClientDraft(getEmptyClientDraft())
    }

    const handleEditClient = async (e) => {
        e.preventDefault()
        if (!editingClientId) return

        try {
            setIsSubmitting(true)

            const payload = {
                name: editingClientDraft.name,
                businessType: editingClientDraft.businessType,
                description: editingClientDraft.description,
                mainActivity: editingClientDraft.mainActivity,
                state: editingClientDraft.state,
                address: editingClientDraft.address || "",
                owners: normalizeOwnersList(editingClientDraft.owners),
            }

            const updated = await updateClientById(editingClientId, payload)

            setClients((current) =>
                current.map((item) => (item.id === editingClientId ? mapClientItem(updated) : item))
            )

            success("Client updated successfully")
            clearClientsListCache(officeId)
            closeEditClientModal()
        } catch (err) {
            error(err.message || "Failed to update client")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleChangeEditingDraft = (patch) => {
        setEditingClientDraft((current) => ({
            ...current,
            ...patch,
        }))
    }

    const handleChangeNewOwner = (index, field, value) => {
        setNewClientOwners((current) =>
            current.map((item, currentIndex) =>
                currentIndex === index
                    ? {
                        ...item,
                        [field]: value,
                    }
                    : item
            )
        )
    }

    const addNewOwnerInput = () => {
        setNewClientOwners((current) => [...current, { name: "", email: "", phone: "" }])
    }

    const removeNewOwnerInput = (index) => {
        setNewClientOwners((current) => {
            if (current.length <= 1) return current
            return current.filter((_, currentIndex) => currentIndex !== index)
        })
    }

    const handleChangeEditingOwner = (index, field, value) => {
        setEditingClientDraft((current) => ({
            ...current,
            owners: Array.isArray(current.owners)
                ? current.owners.map((item, currentIndex) =>
                    currentIndex === index
                        ? {
                            ...item,
                            [field]: value,
                        }
                        : item
                )
                : [{ name: "", email: "", phone: "" }],
        }))
    }

    const addEditingOwnerInput = () => {
        setEditingClientDraft((current) => ({
            ...current,
            owners: Array.isArray(current.owners)
                ? [...current.owners, { name: "", email: "", phone: "" }]
                : [{ name: "", email: "", phone: "" }],
        }))
    }

    const removeEditingOwnerInput = (index) => {
        setEditingClientDraft((current) => {
            const owners = Array.isArray(current.owners) ? current.owners : [""]
            if (owners.length <= 1) return current
            return {
                ...current,
                owners: owners.filter((_, currentIndex) => currentIndex !== index),
            }
        })
    }

    const handleDeleteClient = async () => {
        if (!clientToDelete?.id) return
        try {
            setIsSubmitting(true)
            await deleteClientById(clientToDelete.id)
            setClients((current) => current.filter((item) => item.id !== clientToDelete.id))
            setTotal((current) => {
                const nextTotal = Math.max(0, current - 1)
                setTotalPages(() => Math.max(1, Math.ceil(nextTotal / limit)))
                return nextTotal
            })
            success("Client deleted successfully")
            setExpandedClientIds((current) =>
                current.filter((id) => id !== clientToDelete.id)
            )
            setClientToDelete(null)
            clearClientsListCache(officeId)

            if (clients.length === 1 && page > 1) {
                setPage((current) => Math.max(1, current - 1))
            }
        } catch (err) {
            error(err.message || "Failed to delete client")
        } finally {
            setIsSubmitting(false)
        }
    }

    const toggleClientExpanded = (clientId) => {
        setExpandedClientIds((current) =>
            current.includes(clientId)
                ? current.filter((id) => id !== clientId)
                : [...current, clientId]
        )
    }

    const openClientLedger = (client) => {
        if (!client?.id) return
        // Clicking a client opens its Dashboard now (was /ledger before).
        trackClientOpened({
            id: client.id,
            name: client.name,
            to: `/clients/${client.id}/home`,
        })
        navigate(`/clients/${client.id}/home`)
    }

    return (
        <section className="w-full px-12 py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <h1 className="text-2xl font-bold sm:text-3xl">Clients</h1>
                    <button
                        className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-100 sm:px-4"
                        disabled={isResolvingOfficeContext}
                        onClick={() => setShowClientForm(true)}
                    >
                        <span className="hidden sm:inline">+ New Client</span>
                        <span className="sm:hidden">+ Client</span>
                    </button>
                </header>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search clients"
                            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gray-500"
                        />
                        <svg
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </svg>
                    </div>
                </div>

                {/* Pipeline pills — quick filter row scoped by status. Counts
                    are office-wide (not paginated), so the user can see at a
                    glance how many clients sit in each stage and click to
                    drill in. */}
                {isOperationalStatusEnabled && Object.keys(operationalStatusMap).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setStatusFilter("")}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                !statusFilter
                                    ? "border-gray-900 bg-gray-900 text-white"
                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                            <span>All</span>
                            <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums ${
                                !statusFilter ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                            }`}>
                                {Object.values(statusCounts).reduce((s, n) => s + n, 0)}
                            </span>
                        </button>
                        {OPERATIONAL_STATUS_LIST.map((status) => {
                            const count = statusCounts[status.id] || 0
                            if (count === 0 && statusFilter !== status.id) return null
                            const isActive = statusFilter === status.id
                            return (
                                <button
                                    key={status.id}
                                    type="button"
                                    onClick={() => setStatusFilter(isActive ? "" : status.id)}
                                    title={status.description}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset transition ${
                                        getOperationalStatusBadgeClass(status.id)
                                    } ${isActive ? "shadow-[0_0_0_2px_rgba(15,23,42,0.85)]" : "opacity-80 hover:opacity-100"}`}
                                >
                                    <span>{status.label}</span>
                                    <span className="tabular-nums">{count}</span>
                                </button>
                            )
                        })}
                    </div>
                )}

                <section>
                    <div
                        className={`hidden border-b border-gray-200 px-1 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 sm:grid ${
                            isOperationalStatusEnabled
                                ? "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
                                : "sm:grid-cols-[minmax(0,1fr)_72px]"
                        } sm:items-center sm:gap-3`}
                    >
                        <span>Client</span>
                        {isOperationalStatusEnabled && (
                            <span className="inline-flex items-center justify-start gap-1.5 text-left">
                                <span>Status</span>
                                <OperationalStatusHelp />
                            </span>
                        )}
                        <span className="text-right">Actions</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {displayedClients.map((client) => {
                            const isExpanded = expandedClientIds.includes(client.id)

                            return (
                                <div key={client.id}>
                                    <div
                                        className={`flex w-full cursor-pointer flex-col gap-2 px-1 py-3 hover:bg-gray-50 sm:grid sm:gap-3 ${
                                            isOperationalStatusEnabled
                                                ? "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
                                                : "sm:grid-cols-[minmax(0,1fr)_72px]"
                                        } sm:items-center`}
                                        onClick={() => openClientLedger(client)}
                                    >
                                        <button
                                            type="button"
                                            className="flex min-w-0 max-w-full flex-col items-start text-left"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openClientLedger(client)
                                            }}
                                            title={client.name}
                                        >
                                            <span className="block w-full truncate font-medium text-gray-900">
                                                {client.name}
                                            </span>
                                            {(() => {
                                                // Subtítulo: "main activity · state". Mostra só o
                                                // que existe — se ambos faltam, omite o subtítulo
                                                // pra não deixar uma linha vazia / "—".
                                                const parts = [
                                                    String(client.mainActivity || "").trim(),
                                                    String(client.state || "").trim(),
                                                ].filter(Boolean)
                                                if (parts.length === 0) return null
                                                const subtitle = parts.join(" · ")
                                                return (
                                                    <span className="block w-full truncate text-[11px] text-gray-500">
                                                        {subtitle}
                                                    </span>
                                                )
                                            })()}
                                        </button>

                                        {/*
                                            Mobile: status badge + eye button share a row (flex).
                                            Desktop: `sm:contents` flattens this wrapper so each
                                            child sits in its own grid cell.
                                        */}
                                        <div className="flex items-center justify-between gap-2 sm:contents">
                                            {isOperationalStatusEnabled && (
                                                <div className="flex min-w-0 justify-start">
                                                    <OperationalStatusPopover
                                                        entry={operationalStatusMap[String(client.id)] || null}
                                                        clientId={client.id}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleClientExpanded(client.id)
                                                }}
                                                title={isExpanded ? "Hide details" : "Show details"}
                                                aria-label={isExpanded ? "Hide details" : "Show details"}
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </button>
                                        </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-gray-200 px-1 py-3">
                                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Business Type</dt>
                                                    <dd className="mt-0.5 text-sm text-gray-800">{client.businessType || "-"}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">State</dt>
                                                    <dd className="mt-0.5 text-sm text-gray-800">{client.state || "-"}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Main Activity</dt>
                                                    <dd className="mt-0.5 text-sm text-gray-800">{client.mainActivity || "-"}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Created</dt>
                                                    <dd className="mt-0.5 text-sm text-gray-800">{formatClientDate(client.createdAt)}</dd>
                                                </div>
                                            </dl>

                                            {client.description && (
                                                <section className="mt-3">
                                                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Description</h3>
                                                    <p className="mt-0.5 text-sm leading-5 text-gray-700">{client.description}</p>
                                                </section>
                                            )}

                                            <section className="mt-3">
                                                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Owners</h3>
                                                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    {Array.isArray(client.owners) && client.owners.some(hasOwnerContactInfo) ? (
                                                        client.owners.map((owner, index) => (
                                                            <div
                                                                key={`owner-display-${client.id}-${index}`}
                                                                className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                                                            >
                                                                <p className="text-sm font-semibold text-gray-900">
                                                                    {String(owner?.name || "").trim() || `Owner ${index + 1}`}
                                                                </p>
                                                                {String(owner?.email || "").trim() && (
                                                                    <p className="text-xs text-gray-600">{String(owner.email).trim()}</p>
                                                                )}
                                                                {String(owner?.phone || "").trim() && (
                                                                    <p className="text-xs text-gray-600">{String(owner.phone).trim()}</p>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : hasLegacyOwnerContact(client) ? (
                                                        <div className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                                            <p className="text-sm font-semibold text-gray-900">Owner</p>
                                                            {String(client.ownerEmail || "").trim() && (
                                                                <p className="text-xs text-gray-600">{String(client.ownerEmail).trim()}</p>
                                                            )}
                                                            {String(client.ownerPhone || "").trim() && (
                                                                <p className="text-xs text-gray-600">{String(client.ownerPhone).trim()}</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-500">No owner details added yet</p>
                                                    )}
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </section>

                {isLoading && (
                    <p className="text-sm text-gray-500">
                        Loading clients...
                    </p>
                )}

                {!isLoading && clients.length === 0 && (
                    <p className="text-sm text-gray-500">
                        No clients found
                    </p>
                )}

                {!isLoading && clients.length > 0 && displayedClients.length === 0 && (
                    <p className="text-sm text-gray-500">
                        No clients match the selected status on this page.
                    </p>
                )}

                {!isLoading && total > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3">
                        <p className="text-sm text-gray-500">
                            Page {page} of {totalPages} · {total} clients
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={page <= 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={page >= totalPages}
                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

                <PopupModal
                    isOpen={showClientForm}
                    title="Create Client"
                    onClose={() => setShowClientForm(false)}
                    maxWidthClass="max-w-2xl"
                >
                    <form className="flex flex-col gap-4" onSubmit={handleCreateClient}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client name</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="VB Construction LLC"
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business type</span>
                                <BusinessTypeSelect
                                    value={newClientBusinessType}
                                    onChange={setNewClientBusinessType}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Main activity</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="Construction"
                                    value={newClientMainActivity}
                                    onChange={(e) => setNewClientMainActivity(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">State</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="Florida"
                                    value={newClientState}
                                    onChange={(e) => setNewClientState(e.target.value)}
                                />
                            </label>
                        </div>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Details</span>
                            <textarea
                                className="min-h-20 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                placeholder="Construction and painting services"
                                value={newClientDescription}
                                onChange={(e) => setNewClientDescription(e.target.value)}
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</span>
                            <textarea
                                className="min-h-16 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                placeholder="123 Main St, Miami, FL 33101"
                                value={newClientAddress}
                                onChange={(e) => setNewClientAddress(e.target.value)}
                            />
                        </label>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Owners</p>
                                <button
                                    type="button"
                                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                    onClick={addNewOwnerInput}
                                >
                                    + Add owner
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {newClientOwners.map((owner, index) => (
                                    <div key={`new-owner-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
                                        <input
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                                            type="text"
                                            placeholder={`Owner ${index + 1} name`}
                                            value={owner?.name || ""}
                                            onChange={(e) => handleChangeNewOwner(index, "name", e.target.value)}
                                        />
                                        <input
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                                            type="email"
                                            placeholder="Email (optional)"
                                            value={owner?.email || ""}
                                            onChange={(e) => handleChangeNewOwner(index, "email", e.target.value)}
                                        />
                                        <input
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                                            type="text"
                                            placeholder="Phone (optional)"
                                            value={owner?.phone || ""}
                                            onChange={(e) => handleChangeNewOwner(index, "phone", e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                                            disabled={newClientOwners.length <= 1}
                                            onClick={() => removeNewOwnerInput(index)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {!officeId && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                {isResolvingOfficeContext
                                    ? "Loading your office context..."
                                    : "Your session does not have an office linked yet. Reload the page and try again."}
                            </div>
                        )}
                        <div className="mt-1 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setShowClientForm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                                type="submit"
                                disabled={!canSubmitNewClient}
                            >
                                {isSubmitting ? "Saving..." : "Save Client"}
                            </button>
                        </div>
                    </form>
                </PopupModal>

                <PopupModal
                    isOpen={Boolean(editingClientId)}
                    title="Edit Client"
                    onClose={closeEditClientModal}
                    maxWidthClass="max-w-2xl"
                >
                    <form className="flex flex-col gap-4" onSubmit={handleEditClient}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client name</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="VB Construction LLC"
                                    value={editingClientDraft.name}
                                    onChange={(e) => handleChangeEditingDraft({ name: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business type</span>
                                <BusinessTypeSelect
                                    value={editingClientDraft.businessType}
                                    onChange={(next) => handleChangeEditingDraft({ businessType: next })}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Main activity</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="Construction"
                                    value={editingClientDraft.mainActivity}
                                    onChange={(e) => handleChangeEditingDraft({ mainActivity: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">State</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="Florida"
                                    value={editingClientDraft.state}
                                    onChange={(e) => handleChangeEditingDraft({ state: e.target.value })}
                                />
                            </label>
                        </div>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Details</span>
                            <textarea
                                className="min-h-20 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                placeholder="Construction and painting services"
                                value={editingClientDraft.description}
                                onChange={(e) => handleChangeEditingDraft({ description: e.target.value })}
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</span>
                            <textarea
                                className="min-h-16 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                placeholder="123 Main St, Miami, FL 33101"
                                value={editingClientDraft.address || ""}
                                onChange={(e) => handleChangeEditingDraft({ address: e.target.value })}
                            />
                        </label>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Owners</p>
                                <button
                                    type="button"
                                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                    onClick={addEditingOwnerInput}
                                >
                                    + Add owner
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {(Array.isArray(editingClientDraft.owners) ? editingClientDraft.owners : [{ name: "", email: "", phone: "" }]).map((owner, index) => (
                                    <div key={`editing-owner-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
                                        <input
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                                            type="text"
                                            placeholder={`Owner ${index + 1} name`}
                                            value={owner?.name || ""}
                                            onChange={(e) => handleChangeEditingOwner(index, "name", e.target.value)}
                                        />
                                        <input
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                                            type="email"
                                            placeholder="Email (optional)"
                                            value={owner?.email || ""}
                                            onChange={(e) => handleChangeEditingOwner(index, "email", e.target.value)}
                                        />
                                        <input
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                                            type="text"
                                            placeholder="Phone (optional)"
                                            value={owner?.phone || ""}
                                            onChange={(e) => handleChangeEditingOwner(index, "phone", e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                                            disabled={(Array.isArray(editingClientDraft.owners) ? editingClientDraft.owners.length : 1) <= 1}
                                            onClick={() => removeEditingOwnerInput(index)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={closeEditClientModal}
                            >
                                Cancel
                            </button>
                            <button
                                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </PopupModal>

                <ConfirmModal
                    isOpen={Boolean(clientToDelete)}
                    title="Delete Client"
                    message={`This action will permanently delete ${clientToDelete?.name || "this client"}.`}
                    confirmLabel="Delete Client"
                    onConfirm={handleDeleteClient}
                    onClose={() => setClientToDelete(null)}
                    isLoading={isSubmitting}
                />
            </div>
        </section>
    )
}

export default ClientsPage
