import { useEffect, useMemo, useState } from "react"
import PopupModal from "../components/ui/PopupModal"
import { getEmployeesByOfficeId } from "../mocks/employees.mock"
import {
    createEmployeeAccount,
    getMyUserProfile,
    listAvailableRoles,
    listEmployeesByOfficeId,
} from "../services/employees.service"

const fallbackRoles = [
    { key: "viewer", label: "Viewer", description: "Can only view data. Cannot create, update or delete records." },
    { key: "staff", label: "Staff", description: "Can manage operational data, but cannot manage office settings or full team permissions." },
    { key: "manager", label: "Manager", description: "Can manage most accounting operations and employee profiles, except owner-level full control." },
    { key: "owner", label: "Owner", description: "Full access to all resources and actions." },
]

function EmployeesPage() {
    const [officeId, setOfficeId] = useState("")

    const [showEmployeeForm, setShowEmployeeForm] = useState(false)
    const [newEmployeeName, setNewEmployeeName] = useState("")
    const [newEmployeeEmail, setNewEmployeeEmail] = useState("")
    const [newEmployeePassword, setNewEmployeePassword] = useState("")
    const [newEmployeeRole, setNewEmployeeRole] = useState("")
    const [employees, setEmployees] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
    const [formError, setFormError] = useState("")
    const [formSuccess, setFormSuccess] = useState("")
    const [loadError, setLoadError] = useState("")
    const [profileError, setProfileError] = useState("")
    const [isLoadingProfile, setIsLoadingProfile] = useState(true)
    const [roles, setRoles] = useState([])
    const [rolesError, setRolesError] = useState("")
    const [isLoadingRoles, setIsLoadingRoles] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const displayedRoles = roles.length > 0 ? roles : fallbackRoles

    const employeesFromMocks = useMemo(() => {
        if (!officeId) return []
        return getEmployeesByOfficeId(officeId)
    }, [officeId])

    useEffect(() => {
        setEmployees(employeesFromMocks)
    }, [employeesFromMocks])

    useEffect(() => {
        let active = true
        setIsLoadingProfile(true)
        setProfileError("")

        getMyUserProfile()
            .then((profile) => {
                if (!active) return
                setOfficeId(profile?.officeId || "")
            })
            .catch((error) => {
                if (!active) return
                setProfileError(error.message || "Failed to load current profile")
                setOfficeId("")
            })
            .finally(() => {
                if (!active) return
                setIsLoadingProfile(false)
            })

        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        let active = true
        setIsLoadingRoles(true)
        setRolesError("")

        listAvailableRoles()
            .then((items) => {
                if (!active) return
                const safeItems = Array.isArray(items) ? items : []
                setRoles(safeItems)

                const defaultRole = safeItems.find((item) => item.key === "staff")?.key || safeItems[0]?.key || "staff"
                setNewEmployeeRole(defaultRole)
            })
            .catch((error) => {
                if (!active) return
                setRolesError(error.message || "Failed to load roles")
                setNewEmployeeRole("staff")
            })
            .finally(() => {
                if (!active) return
                setIsLoadingRoles(false)
            })

        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        let active = true

        if (!officeId) {
            setLoadError("")
            return () => {
                active = false
            }
        }

        setIsLoadingEmployees(true)
        setLoadError("")

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
                        status: "active",
                    }))
                    : []

                setEmployees(mapped)
            })
            .catch((error) => {
                if (!active) return
                setLoadError(error.message || "Failed to load employees")
                setEmployees(employeesFromMocks)
            })
            .finally(() => {
                if (!active) return
                setIsLoadingEmployees(false)
            })

        return () => {
            active = false
        }
    }, [officeId, employeesFromMocks, refreshKey])

    const handleCreateEmployee = async (e) => {
        e.preventDefault()
        setFormError("")
        setFormSuccess("")

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

            setFormSuccess("Employee created successfully")
            setNewEmployeeName("")
            setNewEmployeeEmail("")
            setNewEmployeePassword("")
            setNewEmployeeRole("staff")
            setShowEmployeeForm(false)
            setRefreshKey((current) => current + 1)
        } catch (error) {
            setFormError(error.message || "Failed to create employee")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section className="w-full p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">Employees</h1>
                        <p className="text-sm text-gray-500">
                            Office: {officeId || "not defined"}
                        </p>
                    </div>
                    <button
                        className="bg-gray-100 rounded-full px-4 py-2 text-sm font-medium"
                        onClick={() => setShowEmployeeForm(true)}
                    >
                        New Employee
                    </button>
                </header>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employees.map((employeeItem) => (
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
                        </article>
                    ))}
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

                {loadError && (
                    <p className="text-sm text-amber-700">{loadError}</p>
                )}

                {profileError && (
                    <p className="text-sm text-amber-700">{profileError}</p>
                )}

                {formSuccess && (
                    <p className="text-sm text-emerald-700">{formSuccess}</p>
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
                        {rolesError && <p className="text-sm text-amber-700">{rolesError}</p>}
                        {displayedRoles.length > 0 && (
                            <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                {displayedRoles.find((role) => role.key === newEmployeeRole)?.description || "Select a role"}
                            </div>
                        )}
                        {formError && <p className="text-sm text-red-600">{formError}</p>}
                        <button className="bg-gray-100 rounded-full p-2" type="submit" disabled={isSubmitting || isLoadingProfile || !officeId}>
                            {isSubmitting ? "Saving..." : "Save Employee"}
                        </button>
                    </form>
                </PopupModal>
            </div>
        </section>
    )
}

export default EmployeesPage
