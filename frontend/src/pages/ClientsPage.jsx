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

    const [showEditClientForm, setShowEditClientForm] = useState(false)
    const [editingClientId, setEditingClientId] = useState("")
    const [editClientName, setEditClientName] = useState("")
    const [editClientBusinessType, setEditClientBusinessType] = useState("")
    const [editClientDescription, setEditClientDescription] = useState("")
    const [editClientMainActivity, setEditClientMainActivity] = useState("")
    const [editClientState, setEditClientState] = useState("")
    const [clientToDelete, setClientToDelete] = useState(null)

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
    }, [])

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
    }, [officeId, refreshKey, page, limit, debouncedSearchTerm])

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

    const openEditClientModal = (client) => {
        setEditingClientId(client.id)
        setEditClientName(client.name || "")
        setEditClientBusinessType(client.businessType || "")
        setEditClientDescription(client.description || "")
        setEditClientMainActivity(client.mainActivity || "")
        setEditClientState(client.state || "")
        setShowEditClientForm(true)
    }

    const handleEditClient = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            await updateClientById(editingClientId, {
                name: editClientName,
                businessType: editClientBusinessType,
                description: editClientDescription,
                mainActivity: editClientMainActivity,
                state: editClientState,
            })

            success("Client updated successfully")
            setShowEditClientForm(false)
            setEditingClientId("")
            setRefreshKey((current) => current + 1)
        } catch (err) {
            error(err.message || "Failed to update client")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteClient = async () => {
        if (!clientToDelete?.id) return
        try {
            setIsSubmitting(true)
            await deleteClientById(clientToDelete.id)
            success("Client deleted successfully")
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
                    <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.6fr] gap-3 border-b border-gray-200 px-1 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        <span>Client</span>
                        <span>Business Type</span>
                        <span>State</span>
                        <span className="text-right">Actions</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {clients.map((client) => (
                            <div
                                key={client.id}
                                className="grid w-full grid-cols-[1.4fr_1fr_0.8fr_0.6fr] gap-3 px-1 py-3 hover:bg-gray-50"
                            >
                                <button
                                    type="button"
                                    className="contents text-left"
                                    onClick={() => navigate(`/clients/${client.id}/ledger`)}
                                >
                                    <span className="font-medium text-gray-900">{client.name}</span>
                                    <span className="text-gray-700">{client.businessType}</span>
                                    <span className="text-gray-500">{client.state}</span>
                                </button>
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                        onClick={() => openEditClientModal(client)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                        onClick={() => setClientToDelete(client)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
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

                <PopupModal
                    isOpen={showEditClientForm}
                    title="Edit Client"
                    onClose={() => setShowEditClientForm(false)}
                >
                    <form className="flex flex-col gap-3" onSubmit={handleEditClient}>
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Client name"
                            value={editClientName}
                            onChange={(e) => setEditClientName(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Business type"
                            value={editClientBusinessType}
                            onChange={(e) => setEditClientBusinessType(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Description"
                            value={editClientDescription}
                            onChange={(e) => setEditClientDescription(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Main activity"
                            value={editClientMainActivity}
                            onChange={(e) => setEditClientMainActivity(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="State"
                            value={editClientState}
                            onChange={(e) => setEditClientState(e.target.value)}
                        />
                        <button className="bg-gray-100 rounded-full p-2" type="submit" disabled={isSubmitting || !editingClientId}>
                            {isSubmitting ? "Saving..." : "Save Changes"}
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
