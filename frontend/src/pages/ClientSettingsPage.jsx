import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ConfirmModal from "../components/ui/ConfirmModal"
import TagsInput from "../components/ui/TagsInput"
import TagRulesHelp from "../components/ui/TagRulesHelp"
import BusinessTypeSelect from "../components/ui/BusinessTypeSelect"
import { useNotification } from "../contexts/notification.context"
import { useAuth } from "../contexts/auth.context"
import { useOfficeTags } from "../hooks/useOfficeTags"
import {
    clearClientsListCache,
    deleteClientById,
    getClientById,
    updateClientById,
} from "../services/clients.service"
import {
    TOGGLEABLE_MENU_ITEMS,
    readMenuVisibility,
    setMenuItemVisible,
    setAllMenuItemsVisible,
} from "../utils/clientMenuVisibility"

function normalizeOwnersForDraft(owners) {
    if (!Array.isArray(owners) || owners.length === 0) {
        return [{ name: "", email: "", phone: "" }]
    }
    return owners.map((owner) => {
        if (typeof owner === "string") {
            return { name: owner.trim(), email: "", phone: "" }
        }
        if (!owner || typeof owner !== "object") {
            return { name: "", email: "", phone: "" }
        }
        return {
            name: String(owner.name || "").trim(),
            email: String(owner.email || "").trim(),
            phone: String(owner.phone || "").trim(),
        }
    })
}

function normalizeOwnersForPayload(owners) {
    if (!Array.isArray(owners)) return []
    const seen = new Set()
    const out = []
    owners.forEach((owner) => {
        const name = String(owner?.name || "").trim()
        const email = String(owner?.email || "").trim()
        const phone = String(owner?.phone || "").trim()
        if (!name && !email && !phone) return
        const key = `${name.toLowerCase()}|${email.toLowerCase()}|${phone.toLowerCase()}`
        if (seen.has(key)) return
        seen.add(key)
        out.push({ name, email, phone })
    })
    return out
}

function emptyDraft() {
    return {
        name: "",
        businessType: "",
        description: "",
        mainActivity: "",
        state: "",
        address: "",
        tags: [],
        owners: [{ name: "", email: "", phone: "" }],
    }
}

function ClientSettingsPage() {
    const { clientId } = useParams()
    const navigate = useNavigate()
    const { success, error } = useNotification()
    const { profile } = useAuth()
    const officeId = String(profile?.officeId || "").trim()

    const [client, setClient] = useState(null)
    const [draft, setDraft] = useState(emptyDraft())
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const { tags: officeTags, reloadTags, deleteTag, deletingTag } = useOfficeTags(officeId, {
        autoLoad: true,
    })

    useEffect(() => {
        if (!clientId) {
            setIsLoading(false)
            return
        }
        let active = true
        getClientById(clientId)
            .then((data) => {
                if (!active) return
                setClient(data)
                setDraft({
                    name: String(data?.name || ""),
                    businessType: String(data?.businessType || ""),
                    description: String(data?.description || ""),
                    mainActivity: String(data?.mainActivity || ""),
                    state: String(data?.state || ""),
                    address: String(data?.address || ""),
                    tags: Array.isArray(data?.tags) ? data.tags : [],
                    owners: normalizeOwnersForDraft(data?.owners),
                })
            })
            .catch((err) => {
                if (active) error(err.message || "Failed to load client")
            })
            .finally(() => {
                if (active) setIsLoading(false)
            })
        return () => { active = false }
    }, [clientId, error])

    const initialSnapshot = useMemo(() => {
        if (!client) return null
        return JSON.stringify({
            name: String(client.name || ""),
            businessType: String(client.businessType || ""),
            description: String(client.description || ""),
            mainActivity: String(client.mainActivity || ""),
            state: String(client.state || ""),
            address: String(client.address || ""),
            tags: Array.isArray(client.tags) ? client.tags : [],
            owners: normalizeOwnersForDraft(client.owners),
        })
    }, [client])

    const isDirty = useMemo(() => {
        if (!initialSnapshot) return false
        return JSON.stringify(draft) !== initialSnapshot
    }, [draft, initialSnapshot])

    const updateDraft = useCallback((patch) => {
        setDraft((current) => ({ ...current, ...patch }))
    }, [])

    const updateOwner = (index, field, value) => {
        setDraft((current) => ({
            ...current,
            owners: current.owners.map((owner, idx) =>
                idx === index ? { ...owner, [field]: value } : owner
            ),
        }))
    }

    const addOwner = () => {
        setDraft((current) => ({
            ...current,
            owners: [...current.owners, { name: "", email: "", phone: "" }],
        }))
    }

    const removeOwner = (index) => {
        setDraft((current) => {
            if (current.owners.length <= 1) {
                return { ...current, owners: [{ name: "", email: "", phone: "" }] }
            }
            return {
                ...current,
                owners: current.owners.filter((_, idx) => idx !== index),
            }
        })
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!clientId) return
        if (!draft.name.trim()) {
            error("Name is required")
            return
        }

        try {
            setIsSaving(true)
            const payload = {
                name: draft.name.trim(),
                businessType: draft.businessType.trim(),
                description: draft.description.trim(),
                mainActivity: draft.mainActivity.trim(),
                state: draft.state.trim(),
                address: String(draft.address || "").trim(),
                tags: draft.tags,
                owners: normalizeOwnersForPayload(draft.owners),
            }
            const updated = await updateClientById(clientId, payload)
            setClient(updated)
            setDraft((current) => ({
                ...current,
                owners: normalizeOwnersForDraft(updated?.owners),
                tags: Array.isArray(updated?.tags) ? updated.tags : current.tags,
            }))
            clearClientsListCache(officeId)
            reloadTags()
            success("Client updated")
        } catch (err) {
            error(err.message || "Failed to update client")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!clientId) return
        try {
            setIsDeleting(true)
            await deleteClientById(clientId)
            clearClientsListCache(officeId)
            success("Client deleted")
            navigate("/clients", { replace: true })
        } catch (err) {
            error(err.message || "Failed to delete client")
            setIsDeleting(false)
            setIsConfirmingDelete(false)
        }
    }

    if (isLoading) {
        return (
            <section className="w-full px-12 py-8">
                <div className="mx-auto max-w-7xl">
                    <p className="text-sm text-gray-500">Loading client…</p>
                </div>
            </section>
        )
    }

    if (!client) {
        return (
            <section className="w-full px-12 py-8">
                <div className="mx-auto max-w-7xl">
                    <p className="text-sm text-gray-500">Client not found.</p>
                    <button
                        type="button"
                        onClick={() => navigate("/clients")}
                        className="mt-3 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Back to Clients
                    </button>
                </div>
            </section>
        )
    }

    return (
        <section className="w-full px-12 py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
                <header>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Client info
                    </p>
                    <h1 className="text-2xl font-semibold">{client.name || "Client"}</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage this client&apos;s information and which pages show up in the sidebar.
                    </p>
                </header>

                <form
                    onSubmit={handleSave}
                    className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
                >
                    <h2 className="text-base font-semibold text-gray-900">Client information</h2>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</span>
                            <input
                                type="text"
                                value={draft.name}
                                onChange={(e) => updateDraft({ name: e.target.value })}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-500"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business type</span>
                            <BusinessTypeSelect
                                value={draft.businessType}
                                onChange={(next) => updateDraft({ businessType: next })}
                            />
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">State</span>
                            <input
                                type="text"
                                value={draft.state}
                                onChange={(e) => updateDraft({ state: e.target.value })}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-500"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Main activity</span>
                            <input
                                type="text"
                                value={draft.mainActivity}
                                onChange={(e) => updateDraft({ mainActivity: e.target.value })}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-500"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</span>
                            <textarea
                                rows={3}
                                value={draft.description}
                                onChange={(e) => updateDraft({ description: e.target.value })}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-500"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</span>
                            <textarea
                                rows={2}
                                placeholder="123 Main St, Miami, FL 33101"
                                value={draft.address || ""}
                                onChange={(e) => updateDraft({ address: e.target.value })}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-500"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5 md:col-span-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <span>Tags</span>
                                <TagRulesHelp />
                            </span>
                            <TagsInput
                                value={draft.tags}
                                onChange={(nextTags) => updateDraft({ tags: nextTags })}
                                options={officeTags}
                                placeholder="Add tags for this client"
                                onDeleteOption={deleteTag}
                                deletingOption={deletingTag}
                            />
                        </label>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Owners</p>
                            <button
                                type="button"
                                onClick={addOwner}
                                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                            >
                                + Add owner
                            </button>
                        </div>
                        <div className="flex flex-col gap-3">
                            {draft.owners.map((owner, index) => (
                                <div key={index} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                                    <input
                                        type="text"
                                        placeholder="Name"
                                        value={owner.name}
                                        onChange={(e) => updateOwner(index, "name", e.target.value)}
                                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400 max-md:col-span-2"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={owner.email}
                                        onChange={(e) => updateOwner(index, "email", e.target.value)}
                                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400 max-md:col-span-2"
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={owner.phone}
                                        onChange={(e) => updateOwner(index, "phone", e.target.value)}
                                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeOwner(index)}
                                        disabled={draft.owners.length <= 1}
                                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300"
                                        title="Remove owner"
                                        aria-label="Remove owner"
                                    >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18" />
                                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="submit"
                            disabled={isSaving || !isDirty}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {isSaving ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                </form>

                <PageVisibilitySection clientId={clientId} />

                <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
                    <h2 className="text-base font-semibold text-rose-900">Danger zone</h2>
                    <p className="mt-1 text-sm text-rose-700">
                        Deleting a client removes its transactions, accounts, categories, and history. This cannot be undone.
                    </p>
                    <button
                        type="button"
                        onClick={() => setIsConfirmingDelete(true)}
                        className="mt-3 rounded-md border border-rose-600 bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    >
                        Delete this client
                    </button>
                </section>
            </div>

            <ConfirmModal
                isOpen={isConfirmingDelete}
                title="Delete client?"
                message={`This will permanently delete "${client.name}" and all its data.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={handleDelete}
                onClose={() => !isDeleting && setIsConfirmingDelete(false)}
                isLoading={isDeleting}
            />
        </section>
    )
}

function VisibilitySwitch({ checked, onClick, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={onClick}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                checked ? "bg-gray-900" : "bg-gray-300"
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    checked ? "translate-x-4" : "translate-x-0.5"
                }`}
            />
        </button>
    )
}

function PageVisibilitySection({ clientId }) {
    const [visibility, setVisibility] = useState(() => readMenuVisibility(clientId))

    useEffect(() => {
        setVisibility(readMenuVisibility(clientId))
    }, [clientId])

    const toggle = (id) => {
        const next = visibility?.[id] === false ? true : false
        setMenuItemVisible(clientId, id, next)
        setVisibility((current) => ({ ...current, [id]: next }))
    }

    const allVisible = TOGGLEABLE_MENU_ITEMS.every((m) => visibility?.[m.id] !== false)

    const toggleAll = () => {
        const next = !allVisible
        setAllMenuItemsVisible(clientId, next)
        if (next) {
            setVisibility({})
        } else {
            const map = {}
            for (const item of TOGGLEABLE_MENU_ITEMS) map[item.id] = false
            setVisibility(map)
        }
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div>
                <h2 className="text-base font-semibold text-gray-900">Page visibility</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Hide pages from this client&apos;s sidebar. The Info page itself stays visible
                    so you can always come back here. Saved locally on this device.
                </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="text-sm font-medium text-gray-900">All pages visible</span>
                <VisibilitySwitch
                    checked={allVisible}
                    onClick={toggleAll}
                    label="Toggle all pages"
                />
            </div>

            <ul className="mt-2 divide-y divide-gray-100">
                {TOGGLEABLE_MENU_ITEMS.map((item) => {
                    const isVisible = visibility?.[item.id] !== false
                    return (
                        <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 py-2.5"
                        >
                            <span className="text-sm text-gray-900">{item.label}</span>
                            <VisibilitySwitch
                                checked={isVisible}
                                onClick={() => toggle(item.id)}
                                label={`Toggle ${item.label}`}
                            />
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

export default ClientSettingsPage
