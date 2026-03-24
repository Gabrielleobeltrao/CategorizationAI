import { useEffect, useMemo, useState } from "react"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import {
    createEmployeeAccount,
    deleteEmployeeById,
    getMyUserProfile,
    listAvailableRoles,
    listEmployeesByOfficeId,
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
    const [showEditEmployeeForm, setShowEditEmployeeForm] = useState(false)
    const [newEmployeeName, setNewEmployeeName] = useState("")
    const [newEmployeeEmail, setNewEmployeeEmail] = useState("")
    const [newEmployeePassword, setNewEmployeePassword] = useState("")
    const [newEmployeeRole, setNewEmployeeRole] = useState("")
    const [editingEmployeeId, setEditingEmployeeId] = useState("")
    const [editingEmployeeName, setEditingEmployeeName] = useState("")
    const [editingEmployeeEmail, setEditingEmployeeEmail] = useState("")
    const [editingEmployeeRole, setEditingEmployeeRole] = useState("")
    const [editingEmployeeStatus, setEditingEmployeeStatus] = useState("active")
    const [employeeToDelete, setEmployeeToDelete] = useState(null)
    const [employees, setEmployees] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
    const [isLoadingProfile, setIsLoadingProfile] = useState(true)
    const [roles, setRoles] = useState([])
    const [isLoadingRoles, setIsLoadingRoles] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const displayedRoles = roles.length > 0 ? roles : fallbackRoles
    const { success, error } = useNotification()
    const roleOrder = ["owner", "manager", "staff", "viewer"]

    const groupedEmployees = useMemo(() => {
        const groups = {}

        displayedRoles.forEach((roleItem) => {
            groups[roleItem.key] = []
        })

        employees.forEach((employee) => {
            const roleKey = String(employee.role || "staff").toLowerCase()
            if (!groups[roleKey]) groups[roleKey] = []
            groups[roleKey].push(employee)
        })

        Object.keys(groups).forEach((roleKey) => {
            groups[roleKey] = [...groups[roleKey]].sort((a, b) => {
                const nameA = String(a.name || "").toLowerCase()
                const nameB = String(b.name || "").toLowerCase()
                return nameA.localeCompare(nameB)
            })
        })

        return groups
    }, [employees, displayedRoles])

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
        setEditingEmployeeName(employeeItem.name || "")
        setEditingEmployeeEmail(employeeItem.email || "")
        setEditingEmployeeRole(employeeItem.role || "staff")
        setEditingEmployeeStatus(employeeItem.status || "active")
        setShowEditEmployeeForm(true)
    }

    const handleUpdateEmployee = async (e) => {
        e.preventDefault()

        try {
            setIsSubmitting(true)

            const updated = await updateEmployeeById(editingEmployeeId, {
                name: editingEmployeeName,
                email: editingEmployeeEmail,
                role: editingEmployeeRole || "staff",
                status: editingEmployeeStatus || "active",
            })

            setEmployees((current) =>
                current.map((item) =>
                    item.id === editingEmployeeId
                        ? {
                            ...item,
                            name: updated?.name || editingEmployeeName,
                            email: updated?.email || editingEmployeeEmail,
                            role: updated?.role || editingEmployeeRole,
                            status: updated?.status || editingEmployeeStatus,
                        }
                        : item
                )
            )

            success("Employee updated successfully")
            setShowEditEmployeeForm(false)
            setEditingEmployeeId("")
            setRefreshKey((current) => current + 1)
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

    const handleToggleEmployeeStatus = async (employeeItem) => {
        const nextStatus = employeeItem.status === "inactive" ? "active" : "inactive"

        try {
            const updated = await updateEmployeeById(employeeItem.id, {
                status: nextStatus,
            })

            setEmployees((current) =>
                current.map((item) =>
                    item.id === employeeItem.id
                        ? { ...item, status: updated?.status || nextStatus }
                        : item
                )
            )

            success(`Employee ${nextStatus === "active" ? "activated" : "deactivated"} successfully`)
        } catch (err) {
            error(err.message || "Failed to update employee status")
        }
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

                <section className="flex flex-col gap-6">
                    {roleOrder.map((roleKey) => {
                        const roleMeta = displayedRoles.find((item) => item.key === roleKey)
                        const roleLabel = roleMeta?.label || roleKey
                        const roleEmployees = groupedEmployees[roleKey] || []

                        if (roleEmployees.length === 0) return null

                        return (
                            <section key={roleKey} className="flex flex-col gap-3">
                                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                    <h3 className="text-base font-semibold">{roleLabel}</h3>
                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                        {roleEmployees.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {roleEmployees.map((employeeItem) => {
                                        const currentEmail = String(currentUserProfile?.email || "").toLowerCase()
                                        const itemEmail = String(employeeItem.email || "").toLowerCase()
                                        const currentId = String(currentUserProfile?._id || "")
                                        const itemId = String(employeeItem.id || "")
                                        const isCurrentUser = (currentEmail && currentEmail === itemEmail) || (currentId && currentId === itemId)

                                        return (
                                            <article
                                                key={employeeItem.id}
                                                className="border border-gray-200 rounded-lg p-4"
                                            >
                                                <h2 className="text-lg font-semibold">{employeeItem.name}</h2>
                                                <p className="text-sm text-gray-600">{employeeItem.email}</p>
                                                <p className="text-sm text-gray-500">Role: {employeeItem.role}</p>
                                                <p className="text-xs uppercase tracking-wide text-gray-400">
                                                    Status: {employeeItem.status}
                                                </p>
                                                {!isCurrentUser && (
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                                                                employeeItem.status === "active" ? "bg-emerald-500" : "bg-gray-300"
                                                            }`}
                                                            onClick={() => handleToggleEmployeeStatus(employeeItem)}
                                                            title={employeeItem.status === "active" ? "Deactivate employee" : "Activate employee"}
                                                            aria-label={employeeItem.status === "active" ? "Deactivate employee" : "Activate employee"}
                                                        >
                                                            <span
                                                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                                                    employeeItem.status === "active" ? "translate-x-6" : "translate-x-1"
                                                                }`}
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                                                            onClick={() => startEditEmployee(employeeItem)}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                                            onClick={() => setEmployeeToDelete(employeeItem)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </article>
                                        )
                                    })}
                                </div>
                            </section>
                        )
                    })}
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
                        <select
                            className="border-2 border-gray-100 rounded-full px-3 py-2 bg-white"
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

                <PopupModal
                    isOpen={showEditEmployeeForm}
                    title="Edit Employee"
                    onClose={() => setShowEditEmployeeForm(false)}
                >
                    <form className="flex flex-col gap-3" onSubmit={handleUpdateEmployee}>
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Employee name"
                            value={editingEmployeeName}
                            onChange={(e) => setEditingEmployeeName(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="email"
                            placeholder="Employee email"
                            value={editingEmployeeEmail}
                            onChange={(e) => setEditingEmployeeEmail(e.target.value)}
                        />
                        <select
                            className="border-2 border-gray-100 rounded-full px-3 py-2 bg-white"
                            value={editingEmployeeRole}
                            onChange={(e) => setEditingEmployeeRole(e.target.value)}
                            disabled={isLoadingRoles}
                        >
                            {displayedRoles.map((role) => (
                                <option key={role.key} value={role.key}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                        <select
                            className="border-2 border-gray-100 rounded-full px-3 py-2 bg-white"
                            value={editingEmployeeStatus}
                            onChange={(e) => setEditingEmployeeStatus(e.target.value)}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <button className="bg-gray-100 rounded-full p-2" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Changes"}
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
            </div>
        </section>
    )
}

export default EmployeesPage
