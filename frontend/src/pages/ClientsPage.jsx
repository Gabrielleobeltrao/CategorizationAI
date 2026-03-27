import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import { useNotification } from "../contexts/notification.context"
import { getMyUserProfile } from "../services/employees.service"
import {
    createClient,
    deleteClientById,
    listClientsByOfficeId,
    updateClientById,
} from "../services/clients.service"

function getEmptyClientDraft() {
    return {
        name: "",
        businessType: "",
        description: "",
        mainActivity: "",
        state: "",
    }
}

function ClientsPage() {

    const navigate = useNavigate()
    const { success, error } = useNotification()
    const [officeId, setOfficeId] = useState("")
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

    const [editingClientId, setEditingClientId] = useState("")
    const [editingClientDraft, setEditingClientDraft] = useState(getEmptyClientDraft())
    const [clientToDelete, setClientToDelete] = useState(null)
    const [expandedClientIds, setExpandedClientIds] = useState([])

    useEffect(() => {
        let active = true

        getMyUserProfile()
            .then((profile) => {
                if (!active) return
                setOfficeId(profile?.officeId || "")
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load current profile")
                setOfficeId("")
            })

        return () => {
            active = false
        }
    }, [error])

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
            })

            success("Client created successfully")
            setNewClientName("")
            setNewClientBusinessType("")
            setNewClientDescription("")
            setNewClientMainActivity("")
            setNewClientState("")
            setShowClientForm(false)
            setPage(1)
            setRefreshKey((current) => current + 1)
        } catch (err) {
            error(err.message || "Failed to create client")
        } finally {
            setIsSubmitting(false)
        }
    }

    const startInlineEditClient = (client) => {
        setEditingClientId(client.id)
        setEditingClientDraft({
            name: client.name || "",
            businessType: client.businessType || "",
            description: client.description || "",
            mainActivity: client.mainActivity || "",
            state: client.state || "",
        })
        setExpandedClientIds((current) =>
            current.includes(client.id) ? current : [...current, client.id]
        )
    }

    const cancelInlineEditClient = () => {
        setEditingClientId("")
        setEditingClientDraft(getEmptyClientDraft())
    }

    const handleEditClient = async () => {
        if (!editingClientId) return

        try {
            setIsSubmitting(true)

            const payload = {
                name: editingClientDraft.name,
                businessType: editingClientDraft.businessType,
                description: editingClientDraft.description,
                mainActivity: editingClientDraft.mainActivity,
                state: editingClientDraft.state,
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
                        }
                        : item
                )
            )

            success("Client updated successfully")
            cancelInlineEditClient()
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
                            const isEditing = editingClientId === client.id
                            const isExpanded = expandedClientIds.includes(client.id)

                            return (
                                <div key={client.id}>
                                    <div className="grid w-full grid-cols-[1fr_auto] gap-3 px-1 py-3 hover:bg-gray-50">
                                        <div className="flex min-w-0 flex-col gap-2">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                                                    value={editingClientDraft.name}
                                                    onChange={(e) => handleChangeEditingDraft({ name: e.target.value })}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="w-fit max-w-full truncate text-left font-medium text-gray-900 hover:underline"
                                                    onClick={() => navigate(`/clients/${client.id}/ledger`)}
                                                    title={client.name}
                                                >
                                                    {client.name}
                                                </button>
                                            )}

                                            {isExpanded && (
                                                <div className="mt-1 pt-2">
                                                    <div className="grid grid-cols-1 gap-y-2 text-sm md:grid-cols-[140px_minmax(0,1fr)] md:gap-x-4">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business Type</p>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                                                                value={editingClientDraft.businessType}
                                                                onChange={(e) => handleChangeEditingDraft({ businessType: e.target.value })}
                                                            />
                                                        ) : (
                                                            <p className="text-gray-700">{client.businessType || "-"}</p>
                                                        )}

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">State</p>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                                                                value={editingClientDraft.state}
                                                                onChange={(e) => handleChangeEditingDraft({ state: e.target.value })}
                                                            />
                                                        ) : (
                                                            <p className="text-gray-700">{client.state || "-"}</p>
                                                        )}

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Main Activity</p>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                                                                value={editingClientDraft.mainActivity}
                                                                onChange={(e) => handleChangeEditingDraft({ mainActivity: e.target.value })}
                                                            />
                                                        ) : (
                                                            <p className="text-gray-700">{client.mainActivity || "-"}</p>
                                                        )}

                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:pt-1">Description</p>
                                                        {isEditing ? (
                                                            <textarea
                                                                rows={2}
                                                                className="w-full resize-none rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                                                                value={editingClientDraft.description}
                                                                onChange={(e) => handleChangeEditingDraft({ description: e.target.value })}
                                                            />
                                                        ) : (
                                                            <p className="text-gray-700">{client.description || "-"}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-start justify-end gap-2">
                                            <button
                                                type="button"
                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                                                onClick={() => toggleClientExpanded(client.id)}
                                                title={isExpanded ? "Hide details" : "Show details"}
                                                aria-label={isExpanded ? "Hide details" : "Show details"}
                                            >
                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </button>

                                            {isEditing ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-emerald-700 disabled:opacity-50"
                                                        onClick={handleEditClient}
                                                        disabled={isSubmitting}
                                                        title="Save client"
                                                        aria-label="Save client"
                                                    >
                                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M20 6 9 17l-5-5" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50"
                                                        onClick={cancelInlineEditClient}
                                                        disabled={isSubmitting}
                                                        title="Cancel edit"
                                                        aria-label="Cancel edit"
                                                    >
                                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M18 6 6 18" />
                                                            <path d="m6 6 12 12" />
                                                        </svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                                        onClick={() => startInlineEditClient(client)}
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
                                                        onClick={() => setClientToDelete(client)}
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
                                                </>
                                            )}
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
                    title="New Client"
                    onClose={() => setShowClientForm(false)}
                >
                    <form className="flex flex-col gap-3" onSubmit={handleCreateClient}>
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Client name"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Business type"
                            value={newClientBusinessType}
                            onChange={(e) => setNewClientBusinessType(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Description"
                            value={newClientDescription}
                            onChange={(e) => setNewClientDescription(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Main activity"
                            value={newClientMainActivity}
                            onChange={(e) => setNewClientMainActivity(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="State"
                            value={newClientState}
                            onChange={(e) => setNewClientState(e.target.value)}
                        />
                        <button className="bg-gray-100 rounded-full p-2" type="submit" disabled={isSubmitting || !officeId}>
                            {isSubmitting ? "Saving..." : "Save Client"}
                        </button>
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
