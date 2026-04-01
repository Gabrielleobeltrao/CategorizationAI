import { useEffect, useMemo, useState } from "react"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import {
    createEmployeeAccount,
    deleteEmployeeById,
    getMyUserProfile,
    listAvailableRoles,
    listEmployeesByOfficeId,
    resetEmployeePasswordById,
    updateEmployeeById,
} from "../services/employees.service"
import { useNotification } from "../contexts/notification.context"

const fallbackRoles = [
    { key: "viewer", label: "Viewer", description: "Can only view data. Cannot create, update or delete records." },
    { key: "staff", label: "Staff", description: "Can manage operational data, but cannot manage office settings or full team permissions." },
    { key: "manager", label: "Manager", description: "Can manage most accounting operations and employee profiles, except owner-level full control." },
    { key: "owner", label: "Owner", description: "Full access to all resources and actions." },
]

function EmployeesPage() {
    const [officeId, setOfficeId] = useState("")
    const [currentUserProfile, setCurrentUserProfile] = useState(null)

    const [showEmployeeForm, setShowEmployeeForm] = useState(false)
    const [newEmployeeName, setNewEmployeeName] = useState("")
    const [newEmployeeEmail, setNewEmployeeEmail] = useState("")
    const [newEmployeePassword, setNewEmployeePassword] = useState("")
    const [newEmployeeRole, setNewEmployeeRole] = useState("")
    const [editingEmployeeId, setEditingEmployeeId] = useState("")
    const [editingDraft, setEditingDraft] = useState({
        name: "",
        email: "",
        role: "staff",
        status: "active",
    })
    const [searchTerm, setSearchTerm] = useState("")
    const [roleFilter, setRoleFilter] = useState("all")
    const [employeeToDelete, setEmployeeToDelete] = useState(null)
    const [employeeToResetPassword, setEmployeeToResetPassword] = useState(null)
    const [resetPasswordResult, setResetPasswordResult] = useState(null)
    const [employees, setEmployees] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
    const [isLoadingProfile, setIsLoadingProfile] = useState(true)
    const [roles, setRoles] = useState([])
    const [isLoadingRoles, setIsLoadingRoles] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const displayedRoles = roles.length > 0 ? roles : fallbackRoles
    const { success, error } = useNotification()
    const roleLabelByKey = useMemo(
        () =>
            displayedRoles.reduce((acc, item) => {
                acc[item.key] = item.label
                return acc
            }, {}),
        [displayedRoles]
    )

    const filteredEmployees = useMemo(() => {
        const safeSearch = String(searchTerm || "").trim().toLowerCase()
        return [...employees]
            .filter((employee) => {
                if (roleFilter !== "all" && employee.role !== roleFilter) return false
                if (!safeSearch) return true

                const name = String(employee.name || "").toLowerCase()
                const email = String(employee.email || "").toLowerCase()
                return name.includes(safeSearch) || email.includes(safeSearch)
            })
            .sort((a, b) =>
                String(a.name || "").toLowerCase().localeCompare(String(b.name || "").toLowerCase())
            )
    }, [employees, searchTerm, roleFilter])

    useEffect(() => {
        let active = true
        setIsLoadingProfile(true)

        getMyUserProfile()
            .then((profile) => {
                if (!active) return
                setOfficeId(profile?.officeId || "")
                setCurrentUserProfile(profile || null)
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load current profile")
                setOfficeId("")
                setCurrentUserProfile(null)
            })
            .finally(() => {
                if (!active) return
                setIsLoadingProfile(false)
            })

        return () => {
            active = false
        }
    }, [error])

    useEffect(() => {
        let active = true
        setIsLoadingRoles(true)

        listAvailableRoles()
            .then((items) => {
                if (!active) return
                const safeItems = Array.isArray(items) ? items : []
                setRoles(safeItems)

                const defaultRole = safeItems.find((item) => item.key === "staff")?.key || safeItems[0]?.key || "staff"
                setNewEmployeeRole(defaultRole)
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load roles")
                setNewEmployeeRole("staff")
            })
            .finally(() => {
                if (!active) return
                setIsLoadingRoles(false)
            })

        return () => {
            active = false
        }
    }, [error])

    useEffect(() => {
        let active = true

        if (!officeId) {
            return () => {
                active = false
            }
        }

        setIsLoadingEmployees(true)

        listEmployeesByOfficeId(officeId)
            .then((profiles) => {
                if (!active) return

                const mapped = Array.isArray(profiles)
                    ? profiles.map((profile) => ({
                        id: profile?._id || `${Date.now()}`,
                        officeId: profile?.officeId || officeId,
                        name: profile?.name || "",
                        email: profile?.email || "Email not available",
                        role: profile?.role || "staff",
                        status: profile?.status || "active",
                    }))
                    : []

                setEmployees(mapped)
            })
            .catch((err) => {
                if (!active) return
                error(err.message || "Failed to load employees")
                setEmployees([])
            })
            .finally(() => {
                if (!active) return
                setIsLoadingEmployees(false)
            })

        return () => {
            active = false
        }
    }, [officeId, refreshKey, error])

    const handleCreateEmployee = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            const result = await createEmployeeAccount({
                officeId,
                name: newEmployeeName,
                email: newEmployeeEmail,
                password: newEmployeePassword,
                role: newEmployeeRole || "staff",
            })

            setEmployees((current) => [
                ...current,
                {
                    id: result?.userProfile?._id || `${Date.now()}`,
                    officeId,
                    name: newEmployeeName,
                    email: newEmployeeEmail,
                    role: newEmployeeRole || "staff",
                    status: "active",
                },
            ])

            success("Employee created successfully")
            setNewEmployeeName("")
            setNewEmployeeEmail("")
            setNewEmployeePassword("")
            setNewEmployeeRole("staff")
            setShowEmployeeForm(false)
            setRefreshKey((current) => current + 1)
        } catch (err) {
            error(err.message || "Failed to create employee")
        } finally {
            setIsSubmitting(false)
        }
    }

    const startEditEmployee = (employeeItem) => {
        setEditingEmployeeId(employeeItem.id)
        setEditingDraft({
            name: employeeItem.name || "",
            email: employeeItem.email || "",
            role: employeeItem.role || "staff",
            status: employeeItem.status || "active",
        })
    }

    const cancelEditEmployee = () => {
        setEditingEmployeeId("")
        setEditingDraft({
            name: "",
            email: "",
            role: "staff",
            status: "active",
        })
    }

    const handleUpdateEmployee = async () => {
        if (!editingEmployeeId) return

        try {
            setIsSubmitting(true)

            const updated = await updateEmployeeById(editingEmployeeId, {
                name: editingDraft.name,
                role: editingDraft.role || "staff",
                status: editingDraft.status || "active",
            })

            setEmployees((current) =>
                current.map((item) =>
                    item.id === editingEmployeeId
                        ? {
                            ...item,
                            name: updated?.name || editingDraft.name,
                            email: item.email,
                            role: updated?.role || editingDraft.role,
                            status: updated?.status || editingDraft.status,
                        }
                        : item
                )
            )

            success("Employee updated successfully")
            cancelEditEmployee()
        } catch (err) {
            error(err.message || "Failed to update employee")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteEmployee = async () => {
        if (!employeeToDelete?.id) return
        try {
            setIsSubmitting(true)
            await deleteEmployeeById(employeeToDelete.id)
            setEmployees((current) => current.filter((item) => item.id !== employeeToDelete.id))
            success("Employee deleted successfully")
            setEmployeeToDelete(null)
        } catch (err) {
            error(err.message || "Failed to delete employee")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleResetEmployeePassword = async () => {
        if (!employeeToResetPassword?.id) return
        try {
            setIsSubmitting(true)
            const result = await resetEmployeePasswordById(employeeToResetPassword.id)
            setEmployeeToResetPassword(null)
            setResetPasswordResult({
                name: employeeToResetPassword.name,
                email: result?.email || employeeToResetPassword.email,
                temporaryPassword: result?.temporaryPassword || "",
            })
            success("Temporary password generated")
            setRefreshKey((current) => current + 1)
        } catch (err) {
            error(err.message || "Failed to reset employee password")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCopyTemporaryPassword = async () => {
        const temp = String(resetPasswordResult?.temporaryPassword || "")
        if (!temp) return

        try {
            await navigator.clipboard.writeText(temp)
            success("Temporary password copied")
        } catch {
            error("Failed to copy temporary password")
        }
    }

    const isCurrentUser = (employeeItem) => {
        const currentEmail = String(currentUserProfile?.email || "").toLowerCase()
        const itemEmail = String(employeeItem.email || "").toLowerCase()
        const currentId = String(currentUserProfile?._id || "")
        const itemId = String(employeeItem.id || "")
        return (currentEmail && currentEmail === itemEmail) || (currentId && currentId === itemId)
    }

    return (
        <section className="w-full p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">Employees</h1>
                    </div>
                    <button
                        className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-left"
                        onClick={() => setShowEmployeeForm(true)}
                    >
                        + New Employee
                    </button>
                </header>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name or email"
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

                    <div className="relative">
                        <select
                            className="w-full appearance-none rounded-full border-3 border-gray-100 bg-white px-3 py-2.5 pr-8 text-sm"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="all">All roles</option>
                            {displayedRoles.map((role) => (
                                <option key={role.key} value={role.key}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                        <svg
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </div>

                </div>

                <section>
                    <div className="grid grid-cols-[1fr_1.2fr_0.8fr_120px_auto] gap-3 border-b border-gray-200 px-1 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        <span>Name</span>
                        <span>Email</span>
                        <span>Role</span>
                        <span>Status</span>
                        <div className="flex min-w-[72px] justify-end">
                            <span>Actions</span>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {filteredEmployees.map((employeeItem) => {
                            const isCurrent = isCurrentUser(employeeItem)
                            const isEditing = editingEmployeeId === employeeItem.id

                            return (
                                <div key={employeeItem.id}>
                                    <div className="grid grid-cols-[1fr_1.2fr_0.8fr_120px_auto] gap-3 px-1 py-3 hover:bg-gray-50">
                                        <div className="min-w-0">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                                                    value={editingDraft.name}
                                                    onChange={(e) =>
                                                        setEditingDraft((current) => ({ ...current, name: e.target.value }))
                                                    }
                                                />
                                            ) : (
                                                <p className="truncate font-medium text-gray-900">{employeeItem.name}</p>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex items-center">
                                            <p className="truncate text-gray-700">{employeeItem.email}</p>
                                        </div>

                                        <div className="min-w-0">
                                            {isEditing ? (
                                                <div className="relative">
                                                    <select
                                                        className="w-full appearance-none rounded-full border-3 border-gray-100 bg-white px-3 py-1.5 pr-8 text-sm"
                                                        value={editingDraft.role}
                                                        onChange={(e) =>
                                                            setEditingDraft((current) => ({ ...current, role: e.target.value }))
                                                        }
                                                    >
                                                        {displayedRoles.map((role) => (
                                                            <option key={role.key} value={role.key}>
                                                                {role.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <svg
                                                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M6 9l6 6 6-6" />
                                                    </svg>
                                                </div>
                                            ) : (
                                                <p className="truncate text-gray-700">
                                                    {roleLabelByKey[employeeItem.role] || employeeItem.role}
                                                </p>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex items-center">
                                            {isEditing ? (
                                                <button
                                                    type="button"
                                                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                                                        editingDraft.status === "active" ? "bg-emerald-500" : "bg-gray-300"
                                                    }`}
                                                    onClick={() =>
                                                        setEditingDraft((current) => ({
                                                            ...current,
                                                            status: current.status === "active" ? "inactive" : "active",
                                                        }))
                                                    }
                                                    title={editingDraft.status === "active" ? "Set inactive" : "Set active"}
                                                    aria-label={editingDraft.status === "active" ? "Set inactive" : "Set active"}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                            editingDraft.status === "active" ? "translate-x-5" : "translate-x-1"
                                                        }`}
                                                    />
                                                </button>
                                            ) : (
                                                <p className="text-sm text-gray-700">
                                                    {employeeItem.status}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex min-w-[72px] items-center justify-end gap-2">
                                            {isCurrent && (
                                                <div className="flex items-center gap-2 opacity-0" aria-hidden="true">
                                                    <span className="h-4 w-4" />
                                                    <span className="h-4 w-4" />
                                                    <span className="h-4 w-4" />
                                                </div>
                                            )}
                                            {!isCurrent && (
                                                <>
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-emerald-700 disabled:opacity-50"
                                                                onClick={handleUpdateEmployee}
                                                                disabled={isSubmitting}
                                                                title="Save employee"
                                                                aria-label="Save employee"
                                                            >
                                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M20 6 9 17l-5-5" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50"
                                                                onClick={cancelEditEmployee}
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
                                                                onClick={() => startEditEmployee(employeeItem)}
                                                                title="Edit employee"
                                                                aria-label="Edit employee"
                                                            >
                                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M12 20h9" />
                                                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-amber-700"
                                                                onClick={() => setEmployeeToResetPassword(employeeItem)}
                                                                title="Reset password"
                                                                aria-label="Reset password"
                                                            >
                                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
                                                                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                                                                onClick={() => setEmployeeToDelete(employeeItem)}
                                                                title="Delete employee"
                                                                aria-label="Delete employee"
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
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {isLoadingEmployees && (
                    <p className="text-sm text-gray-500">
                        Loading employees...
                    </p>
                )}

                {!isLoadingEmployees && employees.length === 0 && (
                    <p className="text-sm text-gray-500">
                        No employees found for this office
                    </p>
                )}

                {!isLoadingEmployees && employees.length > 0 && filteredEmployees.length === 0 && (
                    <p className="text-sm text-gray-500">
                        No employees match your current filters
                    </p>
                )}

                <PopupModal
                    isOpen={showEmployeeForm}
                    title="Create Employee Account"
                    onClose={() => setShowEmployeeForm(false)}
                >
                    <form className="flex flex-col gap-3" onSubmit={handleCreateEmployee}>
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Employee name"
                            value={newEmployeeName}
                            onChange={(e) => setNewEmployeeName(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="email"
                            placeholder="Employee email"
                            value={newEmployeeEmail}
                            onChange={(e) => setNewEmployeeEmail(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="password"
                            placeholder="Password"
                            value={newEmployeePassword}
                            onChange={(e) => setNewEmployeePassword(e.target.value)}
                        />
                        <div className="relative">
                            <select
                                className="w-full appearance-none rounded-full border-3 border-gray-100 bg-white px-3 py-2 pr-8"
                                value={newEmployeeRole}
                                onChange={(e) => setNewEmployeeRole(e.target.value)}
                                disabled={isLoadingRoles}
                            >
                                {displayedRoles.map((role) => (
                                    <option key={role.key} value={role.key}>
                                        {role.label}
                                    </option>
                                ))}
                            </select>
                            <svg
                                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </div>
                        {displayedRoles.length > 0 && (
                            <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                {displayedRoles.find((role) => role.key === newEmployeeRole)?.description || "Select a role"}
                            </div>
                        )}
                        <button className="bg-gray-100 rounded-full p-2" type="submit" disabled={isSubmitting || isLoadingProfile || !officeId}>
                            {isSubmitting ? "Saving..." : "Save Employee"}
                        </button>
                    </form>
                </PopupModal>

                <ConfirmModal
                    isOpen={Boolean(employeeToDelete)}
                    title="Delete Employee"
                    message={`This action will permanently delete ${employeeToDelete?.name || "this employee"}.`}
                    confirmLabel="Delete Employee"
                    onConfirm={handleDeleteEmployee}
                    onClose={() => setEmployeeToDelete(null)}
                    isLoading={isSubmitting}
                />

                <ConfirmModal
                    isOpen={Boolean(employeeToResetPassword)}
                    title="Reset Employee Password"
                    message={`Generate a temporary password for ${employeeToResetPassword?.name || "this employee"}?`}
                    confirmLabel="Generate Temporary Password"
                    onConfirm={handleResetEmployeePassword}
                    onClose={() => setEmployeeToResetPassword(null)}
                    isLoading={isSubmitting}
                />

                <PopupModal
                    isOpen={Boolean(resetPasswordResult)}
                    title="Temporary Password"
                    onClose={() => setResetPasswordResult(null)}
                    maxWidthClass="max-w-lg"
                >
                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                            <p className="font-medium text-gray-900">{resetPasswordResult?.name}</p>
                            <p className="text-gray-600">{resetPasswordResult?.email}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-3">
                            <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Temporary password</p>
                            <div className="flex items-start justify-between gap-2">
                                <p className="break-all font-mono text-base text-gray-900">
                                    {resetPasswordResult?.temporaryPassword}
                                </p>
                                <button
                                    type="button"
                                    className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                    onClick={handleCopyTemporaryPassword}
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setResetPasswordResult(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </PopupModal>
            </div>
        </section>
    )
}

export default EmployeesPage
