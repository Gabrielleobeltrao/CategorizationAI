import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import TagsInput from "../components/ui/TagsInput"
import TagRulesHelp from "../components/ui/TagRulesHelp"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"
import { useOfficeTags } from "../hooks/useOfficeTags"
import { trackClientOpened } from "../utils/recentClients"
import {
    createClient,
    deleteClientById,
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
        tags: [],
        owners: [{ name: "", email: "", phone: "" }],
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
    const { profile } = useAuth()
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
    const [newClientTags, setNewClientTags] = useState([])
    const [newClientOwners, setNewClientOwners] = useState([{ name: "", email: "", phone: "" }])

    const [editingClientId, setEditingClientId] = useState("")
    const [editingClientDraft, setEditingClientDraft] = useState(getEmptyClientDraft())
    const [clientToDelete, setClientToDelete] = useState(null)
    const [expandedClientIds, setExpandedClientIds] = useState([])

    const officeId = String(profile?.officeId || "").trim()
    const handleOfficeTagError = useCallback((err) => {
        error(err.message || "Failed to delete tag")
    }, [error])
    const handleOfficeTagDeleteSuccess = useCallback((tag) => {
        success(`Tag "${tag}" deleted successfully`)
    }, [success])
    const { tags: officeTags, reloadTags, deleteTag, deletingTag } = useOfficeTags(officeId, {
        onError: handleOfficeTagError,
        onDeleteSuccess: handleOfficeTagDeleteSuccess,
    })

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

        setIsLoading(true)

        listClientsByOfficeId(officeId, { page, limit, search: debouncedSearchTerm })
            .then((payload) => {
                if (!active) return
                const mapped = Array.isArray(payload?.items)
                    ? payload.items.map((item) => ({
                        id: item?._id || "",
                        name: item?.name || "",
                        businessType: item?.businessType || "",
                        description: item?.description || "",
                        mainActivity: item?.mainActivity || "",
                        state: item?.state || "",
                        tags: Array.isArray(item?.tags) ? item.tags : [],
                        owners: normalizeOwnersForDraft(item?.owners),
                        ownerEmail: String(item?.ownerEmail || ""),
                        ownerPhone: String(item?.ownerPhone || ""),
                        createdAt: item?.createdAt || "",
                        updatedAt: item?.updatedAt || "",
                    }))
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

    const handleCreateClient = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            await createClient({
                officeId,
                name: newClientName,
                businessType: newClientBusinessType,
                description: newClientDescription,
                mainActivity: newClientMainActivity,
                state: newClientState,
                tags: newClientTags,
                owners: normalizeOwnersList(newClientOwners),
            })

            success("Client created successfully")
            setNewClientName("")
            setNewClientBusinessType("")
            setNewClientDescription("")
            setNewClientMainActivity("")
            setNewClientState("")
            setNewClientTags([])
            setNewClientOwners([{ name: "", email: "", phone: "" }])
            setShowClientForm(false)
            setPage(1)
            setRefreshKey((current) => current + 1)
            reloadTags()
        } catch (err) {
            error(err.message || "Failed to create client")
        } finally {
            setIsSubmitting(false)
        }
    }

    const openEditClientModal = (client) => {
        setEditingClientId(client.id)
        setEditingClientDraft({
            name: client.name || "",
            businessType: client.businessType || "",
            description: client.description || "",
            mainActivity: client.mainActivity || "",
            state: client.state || "",
            tags: Array.isArray(client.tags) ? client.tags : [],
            owners: normalizeOwnersForDraft(client.owners),
        })
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
                tags: editingClientDraft.tags,
                owners: normalizeOwnersList(editingClientDraft.owners),
            }

            const updated = await updateClientById(editingClientId, payload)

            setClients((current) =>
                current.map((item) =>
                    item.id === editingClientId
                        ? {
                            ...item,
                            name: updated?.name ?? payload.name,
                            businessType: updated?.businessType ?? payload.businessType,
                            description: updated?.description ?? payload.description,
                            mainActivity: updated?.mainActivity ?? payload.mainActivity,
                            state: updated?.state ?? payload.state,
                            tags: Array.isArray(updated?.tags) ? updated.tags : payload.tags,
                            owners: normalizeOwnersForDraft(
                                Array.isArray(updated?.owners) ? updated.owners : payload.owners
                            ),
                            ownerEmail: updated?.ownerEmail ?? item.ownerEmail ?? "",
                            ownerPhone: updated?.ownerPhone ?? item.ownerPhone ?? "",
                            createdAt: updated?.createdAt ?? item.createdAt ?? "",
                            updatedAt: updated?.updatedAt ?? item.updatedAt ?? "",
                        }
                        : item
                )
            )

            success("Client updated successfully")
            closeEditClientModal()
            reloadTags()
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
            success("Client deleted successfully")
            setExpandedClientIds((current) =>
                current.filter((id) => id !== clientToDelete.id)
            )
            setClientToDelete(null)

            if (clients.length === 1 && page > 1) {
                setPage((current) => Math.max(1, current - 1))
            } else {
                setRefreshKey((current) => current + 1)
            }
            reloadTags()
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
        trackClientOpened({
            id: client.id,
            name: client.name,
            to: `/clients/${client.id}/ledger`,
        })
        navigate(`/clients/${client.id}/ledger`)
    }

    return (
        <section className="w-full p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Clients</h1>
                    </div>
                    <button
                        className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-left"
                        disabled={!officeId}
                        onClick={() => setShowClientForm(true)}
                    >
                        + New Client
                    </button>
                </header>

                <div className="relative">
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

                <section>
                    <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-200 px-1 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        <span>Client</span>
                        <span className="text-right">Actions</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {clients.map((client) => {
                            const isExpanded = expandedClientIds.includes(client.id)

                            return (
                                <div key={client.id}>
                                    <div
                                        className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-3 px-1 py-3 hover:bg-gray-50"
                                        onClick={() => openClientLedger(client)}
                                    >
                                        <div className="flex min-w-0 flex-col gap-2">
                                            <button
                                                type="button"
                                                className="w-full max-w-full truncate text-left font-medium text-gray-900"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openClientLedger(client)
                                                }}
                                                title={client.name}
                                            >
                                                {client.name}
                                            </button>

                                            {isExpanded && (
                                                <div className="mt-1 pt-2">
                                                    <div className="grid grid-cols-1 gap-y-2 text-sm md:grid-cols-[140px_minmax(0,1fr)] md:gap-x-4">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business Type</p>
                                                        <p className="text-gray-700">{client.businessType || "-"}</p>

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">State</p>
                                                        <p className="text-gray-700">{client.state || "-"}</p>

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Main Activity</p>
                                                        <p className="text-gray-700">{client.mainActivity || "-"}</p>

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tags</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Array.isArray(client.tags) && client.tags.length > 0 ? (
                                                                client.tags.map((tag) => (
                                                                    <span
                                                                        key={`${client.id}-tag-${tag}`}
                                                                        className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <p className="text-gray-700">-</p>
                                                            )}
                                                        </div>

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:pt-1">Description</p>
                                                        <p className="text-gray-700">{client.description || "-"}</p>

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:pt-1">Owners</p>
                                                        <div className="flex flex-col gap-2">
                                                            {Array.isArray(client.owners) && client.owners.some(hasOwnerContactInfo) ? (
                                                                client.owners.map((owner, index) => (
                                                                    <div
                                                                        key={`owner-display-${client.id}-${index}`}
                                                                        className="grid grid-cols-1 gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 md:grid-cols-[88px_minmax(0,1fr)]"
                                                                    >
                                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                                                            Owner {index + 1}
                                                                        </p>
                                                                        <div className="grid grid-cols-1 gap-y-1 text-gray-700 sm:grid-cols-3 sm:gap-x-4">
                                                                            <p>
                                                                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Name:</span>{" "}
                                                                                {String(owner?.name || "").trim() || "-"}
                                                                            </p>
                                                                            <p>
                                                                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Email:</span>{" "}
                                                                                {String(owner?.email || "").trim() || "-"}
                                                                            </p>
                                                                            <p>
                                                                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Phone:</span>{" "}
                                                                                {String(owner?.phone || "").trim() || "-"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : hasLegacyOwnerContact(client) ? (
                                                                <div className="grid grid-cols-1 gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 md:grid-cols-[88px_minmax(0,1fr)]">
                                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                                                        Owner
                                                                    </p>
                                                                    <div className="grid grid-cols-1 gap-y-1 text-gray-700 sm:grid-cols-3 sm:gap-x-4">
                                                                        <p>
                                                                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Name:</span> -
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Email:</span>{" "}
                                                                            {String(client.ownerEmail || "").trim() || "-"}
                                                                        </p>
                                                                        <p>
                                                                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Phone:</span>{" "}
                                                                            {String(client.ownerPhone || "").trim() || "-"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-gray-700">-</p>
                                                            )}
                                                        </div>

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Created At</p>
                                                        <p className="text-gray-700">{formatClientDate(client.createdAt)}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-start justify-end gap-2">
                                            <button
                                                type="button"
                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
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
                                            <button
                                                type="button"
                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openEditClientModal(client)
                                                }}
                                                title="Edit client"
                                                aria-label="Edit client"
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9" />
                                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setClientToDelete(client)
                                                }}
                                                title="Delete client"
                                                aria-label="Delete client"
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" />
                                                    <path d="M8 6V4h8v2" />
                                                    <path d="M19 6l-1 14H6L5 6" />
                                                    <path d="M10 11v6M14 11v6" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
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

                {!isLoading && total > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-200 pt-3">
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
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="1120"
                                    value={newClientBusinessType}
                                    onChange={(e) => setNewClientBusinessType(e.target.value)}
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
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <span>Tags</span>
                                <TagRulesHelp />
                            </span>
                            <TagsInput
                                value={newClientTags}
                                onChange={setNewClientTags}
                                options={officeTags}
                                placeholder="Add tags for this client"
                                onDeleteOption={deleteTag}
                                deletingOption={deletingTag}
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
                                disabled={isSubmitting || !officeId}
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
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="1120"
                                    value={editingClientDraft.businessType}
                                    onChange={(e) => handleChangeEditingDraft({ businessType: e.target.value })}
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
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <span>Tags</span>
                                <TagRulesHelp />
                            </span>
                            <TagsInput
                                value={editingClientDraft.tags}
                                onChange={(nextTags) => handleChangeEditingDraft({ tags: nextTags })}
                                options={officeTags}
                                placeholder="Add tags for this client"
                                onDeleteOption={deleteTag}
                                deletingOption={deletingTag}
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
