import { useEffect, useMemo, useState } from "react"
import PopupModal from "../components/ui/PopupModal"
import ConfirmModal from "../components/ui/ConfirmModal"
import { useAuth } from "../contexts/auth.context"
import { useResolvedOfficeContext } from "../hooks/useResolvedOfficeContext"
import {
    createCustomRole,
    createEmployeeAccount,
    clearAvailableRolesCache,
    clearEmployeesCache,
    deleteCustomRoleById,
    deleteEmployeeById,
    getCachedAvailableRoles,
    getCachedEmployeesByOfficeId,
    getCachedRolePermissions,
    listAvailableRoles,
    listRolePermissions,
    listEmployeesByOfficeId,
    resetEmployeePasswordById,
    updateCustomRoleById,
    updateEmployeeById,
} from "../services/employees.service"
import { listClientsByOfficeId } from "../services/clients.service"
import { useNotification } from "../contexts/notification.context"

const fallbackRoles = [
    { id: "system_viewer", key: "viewer", label: "Viewer", description: "Can only view data. Cannot create, update or delete records.", permissions: [], isSystem: true },
    { id: "system_staff", key: "staff", label: "Staff", description: "Can manage operational data, but cannot manage office settings or full team permissions.", permissions: [], isSystem: true },
    { id: "system_manager", key: "manager", label: "Manager", description: "Can manage most accounting operations and employee profiles, except owner-level full control.", permissions: [], isSystem: true },
    { id: "system_owner", key: "owner", label: "Owner", description: "Full access to all resources and actions.", permissions: ["*"], isSystem: true },
]

const fallbackPermissionCatalog = [
    { key: "offices:read", group: "Offices", label: "Read offices" },
    { key: "offices:create", group: "Offices", label: "Create offices" },
    { key: "offices:update", group: "Offices", label: "Update offices" },
    { key: "clients:read", group: "Clients", label: "Read clients" },
    { key: "clients:create", group: "Clients", label: "Create clients" },
    { key: "clients:update", group: "Clients", label: "Update clients" },
    { key: "clients:delete", group: "Clients", label: "Delete clients" },
    { key: "clientsOwnerInfo:read", group: "Clients", label: "View owner contact info" },
    { key: "clientsOwnerInfo:update", group: "Clients", label: "Edit owner contact info" },
    { key: "accounts:read", group: "Accounts", label: "Read accounts" },
    { key: "accounts:create", group: "Accounts", label: "Create accounts" },
    { key: "accounts:update", group: "Accounts", label: "Update accounts" },
    { key: "accounts:delete", group: "Accounts", label: "Delete accounts" },
    { key: "transactions:read", group: "Transactions", label: "Read transactions" },
    { key: "transactions:create", group: "Transactions", label: "Create transactions" },
    { key: "transactions:update", group: "Transactions", label: "Update transactions" },
    { key: "transactions:delete", group: "Transactions", label: "Delete transactions" },
    { key: "profitLoss:read", group: "Profit & Loss", label: "Read profit & loss" },
    { key: "userProfiles:read", group: "Employees", label: "Read employees" },
    { key: "userProfiles:create", group: "Employees", label: "Create employees" },
    { key: "userProfiles:update", group: "Employees", label: "Update employees" },
    { key: "userProfiles:delete", group: "Employees", label: "Delete employees" },
    { key: "roles:read", group: "Roles", label: "Read roles" },
    { key: "roles:create", group: "Roles", label: "Create roles" },
    { key: "roles:update", group: "Roles", label: "Update roles" },
    { key: "roles:delete", group: "Roles", label: "Delete roles" },
    { key: "tasks:read", group: "Tasks", label: "Read tasks" },
    { key: "tasks:create", group: "Tasks", label: "Create tasks" },
    { key: "tasks:update", group: "Tasks", label: "Update tasks" },
    { key: "tasks:delete", group: "Tasks", label: "Delete tasks" },
]

function normalizePermissions(value) {
    if (!Array.isArray(value)) return []
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
}

function permissionListHasPermission(permissions, permission) {
    const safePermissions = normalizePermissions(permissions)
    if (safePermissions.includes("*")) return true
    if (safePermissions.includes(permission)) return true

    const [resource] = String(permission || "").split(":")
    return safePermissions.includes(`${resource}:*`)
}

function mapEmployeeItem(item = {}) {
    return {
        id: item?._id || item?.id || `${Date.now()}`,
        officeId: item?.officeId || "",
        name: item?.name || "",
        email: item?.email || "",
        role: item?.role || "staff",
        status: item?.status || "active",
        clientScope: item?.clientScope === "assigned" ? "assigned" : "all",
        assignedClientIds: Array.isArray(item?.assignedClientIds)
            ? item.assignedClientIds.map((id) => String(id))
            : [],
    }
}

function mapRoleItem(item = {}) {
    return {
        id: String(item?.id || item?._id || ""),
        key: String(item?.key || ""),
        label: String(item?.label || ""),
        description: String(item?.description || ""),
        permissions: normalizePermissions(item?.permissions),
        isSystem: Boolean(item?.isSystem),
    }
}

function EmployeesPage() {
    const { profile: currentUserProfile } = useAuth()

    const [showEmployeeForm, setShowEmployeeForm] = useState(false)
    const [newEmployeeName, setNewEmployeeName] = useState("")
    const [newEmployeeEmail, setNewEmployeeEmail] = useState("")
    const [newEmployeePassword, setNewEmployeePassword] = useState("")
    const [newEmployeeRole, setNewEmployeeRole] = useState("")
    const [newEmployeeClientScope, setNewEmployeeClientScope] = useState("all")
    const [newEmployeeAssignedClientIds, setNewEmployeeAssignedClientIds] = useState([])
    const [clientPickerQuery, setClientPickerQuery] = useState("")
    const [officeClients, setOfficeClients] = useState([])
    const [clientAccessEmployee, setClientAccessEmployee] = useState(null)
    const [clientAccessScope, setClientAccessScope] = useState("all")
    const [clientAccessIds, setClientAccessIds] = useState([])
    const [clientAccessQuery, setClientAccessQuery] = useState("")
    const [isSavingClientAccess, setIsSavingClientAccess] = useState(false)
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
    const [roleToDelete, setRoleToDelete] = useState(null)
    const [resetPasswordResult, setResetPasswordResult] = useState(null)
    const [employees, setEmployees] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
    const [roles, setRoles] = useState([])
    const [permissionCatalog, setPermissionCatalog] = useState(fallbackPermissionCatalog)
    const [isLoadingRoles, setIsLoadingRoles] = useState(false)
    const [isRolesSectionExpanded, setIsRolesSectionExpanded] = useState(false)
    const [showRoleForm, setShowRoleForm] = useState(false)
    const [editingRoleId, setEditingRoleId] = useState("")
    const [roleDraft, setRoleDraft] = useState({
        label: "",
        description: "",
        permissions: [],
    })
    const displayedRoles = roles.length > 0 ? roles : fallbackRoles
    const { success, error } = useNotification()
    const { officeId, isResolvingOfficeContext } = useResolvedOfficeContext()
    const roleLabelByKey = useMemo(
        () =>
            displayedRoles.reduce((acc, item) => {
                acc[item.key] = item.label
                return acc
            }, {}),
        [displayedRoles]
    )
    const groupedPermissionCatalog = useMemo(() => {
        return permissionCatalog.reduce((acc, item) => {
            const group = String(item.group || "General")
            if (!acc[group]) acc[group] = []
            acc[group].push(item)
            return acc
        }, {})
    }, [permissionCatalog])
    // Nested view: module → group → items. Preserves the order in which each
    // module and group first appear in the catalog so the UI stays predictable.
    const modulesPermissionCatalog = useMemo(() => {
        const modules = []
        const moduleIndex = new Map()
        const groupIndexByModule = new Map()

        for (const item of permissionCatalog) {
            const moduleName = String(item.module || "Other")
            const groupName = String(item.group || "General")

            if (!moduleIndex.has(moduleName)) {
                moduleIndex.set(moduleName, modules.length)
                modules.push({ name: moduleName, groups: [] })
                groupIndexByModule.set(moduleName, new Map())
            }

            const moduleEntry = modules[moduleIndex.get(moduleName)]
            const groupIndex = groupIndexByModule.get(moduleName)

            if (!groupIndex.has(groupName)) {
                groupIndex.set(groupName, moduleEntry.groups.length)
                moduleEntry.groups.push({ name: groupName, items: [] })
            }

            moduleEntry.groups[groupIndex.get(groupName)].items.push(item)
        }

        return modules
    }, [permissionCatalog])
    const currentRolePermissions = useMemo(() => {
        const currentRoleKey = String(currentUserProfile?.role || "").toLowerCase()
        if (!currentRoleKey) return []
        const roleItem = displayedRoles.find((role) => String(role.key || "").toLowerCase() === currentRoleKey)
        return normalizePermissions(roleItem?.permissions)
    }, [displayedRoles, currentUserProfile?.role])
    const canManageRoles = useMemo(() => {
        return (
            permissionListHasPermission(currentRolePermissions, "roles:create") ||
            permissionListHasPermission(currentRolePermissions, "roles:update") ||
            permissionListHasPermission(currentRolePermissions, "roles:delete")
        )
    }, [currentRolePermissions])
    const canSubmitRole = useMemo(() => {
        return (
            !isSubmitting &&
            !isResolvingOfficeContext &&
            Boolean(String(roleDraft.label || "").trim())
        )
    }, [isResolvingOfficeContext, isSubmitting, roleDraft.label])
    const canSubmitNewEmployee = useMemo(() => {
        return (
            !isSubmitting &&
            !isResolvingOfficeContext &&
            Boolean(String(newEmployeeName || "").trim()) &&
            Boolean(String(newEmployeeEmail || "").trim()) &&
            Boolean(String(newEmployeePassword || "")) &&
            Boolean(String(newEmployeeRole || "").trim())
        )
    }, [
        isResolvingOfficeContext,
        isSubmitting,
        newEmployeeEmail,
        newEmployeeName,
        newEmployeePassword,
        newEmployeeRole,
    ])

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

    // Load the office's client directory for the per-employee client picker.
    // Pull a large page (500) — way past the size of a typical accounting
    // office. Silent on failure since the picker just stays empty.
    useEffect(() => {
        if (!officeId) return undefined
        let active = true
        listClientsByOfficeId(officeId, { limit: 500 })
            .then((payload) => {
                if (!active) return
                const items = Array.isArray(payload?.items)
                    ? payload.items
                    : Array.isArray(payload)
                        ? payload
                        : []
                setOfficeClients(items)
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [officeId])

    useEffect(() => {
        let active = true
        if (!officeId) {
            setRoles([])
            return () => {
                active = false
            }
        }

        const cachedRoles = getCachedAvailableRoles(officeId)
        if (cachedRoles) {
            const safeCachedRoles = Array.isArray(cachedRoles) ? cachedRoles : []
            setRoles(safeCachedRoles)
            const defaultRole = safeCachedRoles.find((item) => item.key === "staff")?.key || safeCachedRoles[0]?.key || "staff"
            setNewEmployeeRole(defaultRole)
            setIsLoadingRoles(false)
            return () => {
                active = false
            }
        } else {
            setIsLoadingRoles(true)
        }

        listAvailableRoles(officeId, {
            backgroundLoadingMessage: cachedRoles ? "Updating cached employee roles..." : "",
        })
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
    }, [officeId, error])

    useEffect(() => {
        let active = true
        const cachedPermissions = getCachedRolePermissions()
        if (Array.isArray(cachedPermissions) && cachedPermissions.length > 0) {
            setPermissionCatalog(cachedPermissions)
            return () => {
                active = false
            }
        }

        listRolePermissions()
            .then((items) => {
                if (!active) return
                const safeItems = Array.isArray(items) ? items : []
                if (safeItems.length === 0) return
                setPermissionCatalog(safeItems)
            })
            .catch(() => {
                if (!active) return
                setPermissionCatalog(fallbackPermissionCatalog)
            })

        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        let active = true

        if (!officeId) {
            return () => {
                active = false
            }
        }

        const cachedEmployees = getCachedEmployeesByOfficeId(officeId)
        if (cachedEmployees) {
            const mappedCachedEmployees = Array.isArray(cachedEmployees)
                ? cachedEmployees.map((profile) => ({
                    id: profile?._id || `${Date.now()}`,
                    officeId: profile?.officeId || officeId,
                    name: profile?.name || "",
                    email: profile?.email || "Email not available",
                    role: profile?.role || "staff",
                    status: profile?.status || "active",
                }))
                : []
            setEmployees(mappedCachedEmployees)
            setIsLoadingEmployees(false)
        } else {
            setIsLoadingEmployees(true)
        }

        listEmployeesByOfficeId(officeId, {
            backgroundLoadingMessage: cachedEmployees ? "Updating cached employees..." : "",
        })
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
                if (!cachedEmployees) {
                    setEmployees([])
                }
            })
            .finally(() => {
                if (!active) return
                setIsLoadingEmployees(false)
            })

        return () => {
            active = false
        }
    }, [officeId, error])

    const handleCreateEmployee = async (e) => {
        e.preventDefault()

        if (!officeId) {
            error("Office context is not available yet. Refresh the page and try again.")
            return
        }

        try {
            setIsSubmitting(true)

            const result = await createEmployeeAccount({
                officeId,
                name: newEmployeeName,
                email: newEmployeeEmail,
                password: newEmployeePassword,
                role: newEmployeeRole || "staff",
                clientScope: newEmployeeClientScope,
                assignedClientIds: newEmployeeAssignedClientIds,
            })

            setEmployees((current) => [
                ...current,
                mapEmployeeItem({
                    ...(result?.userProfile || {}),
                    officeId,
                    name: result?.userProfile?.name || newEmployeeName,
                    email: result?.userProfile?.email || newEmployeeEmail,
                    role: result?.userProfile?.role || newEmployeeRole || "staff",
                    status: result?.userProfile?.status || "active",
                }),
            ])
            clearEmployeesCache(officeId)

            success("Employee created successfully")
            setNewEmployeeName("")
            setNewEmployeeEmail("")
            setNewEmployeePassword("")
            setNewEmployeeRole("staff")
            setNewEmployeeClientScope("all")
            setNewEmployeeAssignedClientIds([])
            setClientPickerQuery("")
            setShowEmployeeForm(false)
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

    const openClientAccessModal = (employeeItem) => {
        setClientAccessEmployee(employeeItem)
        setClientAccessScope(employeeItem.clientScope === "assigned" ? "assigned" : "all")
        setClientAccessIds(Array.isArray(employeeItem.assignedClientIds) ? employeeItem.assignedClientIds : [])
        setClientAccessQuery("")
    }

    const closeClientAccessModal = () => {
        if (isSavingClientAccess) return
        setClientAccessEmployee(null)
        setClientAccessScope("all")
        setClientAccessIds([])
        setClientAccessQuery("")
    }

    const handleSaveClientAccess = async () => {
        if (!clientAccessEmployee) return
        setIsSavingClientAccess(true)
        try {
            const updated = await updateEmployeeById(clientAccessEmployee.id, {
                clientScope: clientAccessScope,
                assignedClientIds: clientAccessScope === "assigned" ? clientAccessIds : [],
            })
            setEmployees((current) =>
                current.map((item) =>
                    item.id === clientAccessEmployee.id
                        ? {
                            ...item,
                            clientScope: updated?.clientScope || clientAccessScope,
                            assignedClientIds: updated?.assignedClientIds || clientAccessIds,
                        }
                        : item,
                ),
            )
            clearEmployeesCache(officeId)
            success("Client access updated")
            setClientAccessEmployee(null)
            setClientAccessScope("all")
            setClientAccessIds([])
            setClientAccessQuery("")
        } catch (err) {
            error(err?.message || "Failed to update client access")
        } finally {
            setIsSavingClientAccess(false)
        }
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
            clearEmployeesCache(officeId)

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
            clearEmployeesCache(officeId)
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

    const openCreateRoleForm = () => {
        setEditingRoleId("")
        setRoleDraft({
            label: "",
            description: "",
            permissions: [],
        })
        setShowRoleForm(true)
    }

    const openEditRoleForm = (roleItem) => {
        if (!roleItem || roleItem.isSystem) return
        setEditingRoleId(String(roleItem.id || ""))
        setRoleDraft({
            label: String(roleItem.label || ""),
            description: String(roleItem.description || ""),
            permissions: normalizePermissions(roleItem.permissions),
        })
        setShowRoleForm(true)
    }

    const closeRoleForm = () => {
        setShowRoleForm(false)
        setEditingRoleId("")
        setRoleDraft({
            label: "",
            description: "",
            permissions: [],
        })
    }

    const toggleRolePermission = (permissionKey) => {
        const key = String(permissionKey || "").trim()
        if (!key) return

        setRoleDraft((current) => {
            const hasKey = current.permissions.includes(key)
            return {
                ...current,
                permissions: hasKey
                    ? current.permissions.filter((item) => item !== key)
                    : [...current.permissions, key],
            }
        })
    }

    const toggleRolePermissionGroup = (groupName, shouldEnable) => {
        const groupItems = groupedPermissionCatalog[groupName] || []
        const groupKeys = groupItems.map((item) => item.key)
        if (groupKeys.length === 0) return

        setRoleDraft((current) => {
            const without = current.permissions.filter((key) => !groupKeys.includes(key))
            return {
                ...current,
                permissions: shouldEnable ? [...without, ...groupKeys] : without,
            }
        })
    }

    const toggleRolePermissionModule = (moduleName, shouldEnable) => {
        const moduleEntry = modulesPermissionCatalog.find((mod) => mod.name === moduleName)
        if (!moduleEntry) return
        const moduleKeys = moduleEntry.groups.flatMap((group) => group.items.map((item) => item.key))
        if (moduleKeys.length === 0) return

        setRoleDraft((current) => {
            const without = current.permissions.filter((key) => !moduleKeys.includes(key))
            return {
                ...current,
                permissions: shouldEnable ? [...without, ...moduleKeys] : without,
            }
        })
    }

    const handleSaveRole = async (e) => {
        e.preventDefault()

        if (!officeId) {
            error("Office is required")
            return
        }

        try {
            setIsSubmitting(true)

            const payload = {
                officeId,
                label: roleDraft.label,
                description: roleDraft.description,
                permissions: normalizePermissions(roleDraft.permissions),
            }

            if (editingRoleId) {
                const updated = await updateCustomRoleById(editingRoleId, payload)
                setRoles((current) =>
                    current.map((item) => (String(item.id || "") === editingRoleId ? mapRoleItem(updated) : item))
                )
                clearAvailableRolesCache(officeId)
                success("Role updated successfully")
            } else {
                const created = await createCustomRole(payload)
                setRoles((current) => [...current, mapRoleItem(created)])
                clearAvailableRolesCache(officeId)
                success("Role created successfully")
            }

            closeRoleForm()
        } catch (err) {
            error(err.message || "Failed to save role")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteRole = async () => {
        if (!roleToDelete?.id) return

        try {
            setIsSubmitting(true)
            await deleteCustomRoleById(roleToDelete.id)
            setRoles((current) =>
                current.filter((item) => String(item.id || "") !== String(roleToDelete.id || ""))
            )
            clearAvailableRolesCache(officeId)
            success("Role deleted successfully")
            setRoleToDelete(null)
        } catch (err) {
            error(err.message || "Failed to delete role")
        } finally {
            setIsSubmitting(false)
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
        <section className="w-full px-12 py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <h1 className="text-2xl font-bold sm:text-3xl">Employees</h1>
                    <div className="flex shrink-0 items-center gap-2">
                        {canManageRoles && (
                            <button
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-100 sm:px-4"
                                onClick={openCreateRoleForm}
                            >
                                <span className="hidden sm:inline">+ New Role</span>
                                <span className="sm:hidden">+ Role</span>
                            </button>
                        )}
                        <button
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-100 sm:px-4"
                            onClick={() => setShowEmployeeForm(true)}
                        >
                            <span className="hidden sm:inline">+ New Employee</span>
                            <span className="sm:hidden">+ Employee</span>
                        </button>
                    </div>
                </header>

                <section className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">Roles</h2>
                            <p className="text-sm text-gray-500">Create custom roles and choose permissions for employee accounts</p>
                        </div>
                        <button
                            type="button"
                            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            onClick={() => setIsRolesSectionExpanded((current) => !current)}
                            title={isRolesSectionExpanded ? "Collapse roles" : "Expand roles"}
                            aria-label={isRolesSectionExpanded ? "Collapse roles" : "Expand roles"}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className={`h-5 w-5 transition-transform ${isRolesSectionExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                    </div>

                    {isRolesSectionExpanded && (
                        <>
                            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_130px_110px] gap-3 border-b border-gray-200 px-1 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
                                <span>Role</span>
                                <span>Description</span>
                                <span>Permissions</span>
                                <span className="text-right">Actions</span>
                            </div>

                            <div className="md:divide-y md:divide-gray-100">
                                {displayedRoles.map((roleItem) => {
                                    const permsLabel = Array.isArray(roleItem.permissions) && roleItem.permissions.includes("*")
                                        ? "All"
                                        : `${normalizePermissions(roleItem.permissions).length}`
                                    const canEditRole = !roleItem.isSystem && canManageRoles
                                    return (
                                        <div key={roleItem.id || roleItem.key} className="mt-2 flex flex-col gap-1.5 rounded-lg border border-gray-100 bg-gray-50/50 p-3 text-sm md:mt-0 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_130px_110px] md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:px-1 md:py-2.5 md:text-base">
                                            <div className="flex items-start justify-between gap-2 md:block md:min-w-0">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-gray-900">{roleItem.label}</p>
                                                    <p className="text-xs text-gray-500">{roleItem.isSystem ? "System role" : "Custom role"}</p>
                                                </div>
                                                {canEditRole && (
                                                    <div className="flex items-center gap-1 md:hidden">
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                                            onClick={() => openEditRoleForm(roleItem)}
                                                            aria-label="Edit role"
                                                        >
                                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 20h9" />
                                                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                                                            onClick={() => setRoleToDelete(roleItem)}
                                                            aria-label="Delete role"
                                                        >
                                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M3 6h18" />
                                                                <path d="M8 6V4h8v2" />
                                                                <path d="M19 6l-1 14H6L5 6" />
                                                                <path d="M10 11v6M14 11v6" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-700 md:truncate">
                                                {roleItem.description || "-"}
                                            </p>
                                            <p className="text-xs text-gray-500 md:text-sm md:text-gray-700">
                                                <span className="md:hidden">Permissions: </span>{permsLabel}
                                            </p>
                                            <div className="hidden items-center justify-end gap-1 md:flex">
                                                {canEditRole && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                                            onClick={() => openEditRoleForm(roleItem)}
                                                            aria-label="Edit role"
                                                        >
                                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 20h9" />
                                                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                                                            onClick={() => setRoleToDelete(roleItem)}
                                                            aria-label="Delete role"
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
                                    )
                                })}
                            </div>
                        </>
                    )}
                </section>

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
                    <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_120px_120px] gap-3 border-b border-gray-200 px-1 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
                        <span>Name</span>
                        <span>Email</span>
                        <span>Role</span>
                        <span>Status</span>
                        <div className="flex items-center justify-end">
                            <span>Actions</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-gray-100">
                        {filteredEmployees.map((employeeItem) => {
                            const isCurrent = isCurrentUser(employeeItem)
                            const isEditing = editingEmployeeId === employeeItem.id

                            return (
                                <div key={employeeItem.id}>
                                    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3 text-sm hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_120px_120px] md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:px-1 md:py-3 md:text-base">
                                        <div className="min-w-0 max-md:col-start-1 max-md:row-start-1">
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

                                        <div className="min-w-0 max-md:col-span-2 max-md:row-start-2 md:flex md:items-center">
                                            <p className="truncate text-xs text-gray-500 md:text-base md:text-gray-700">{employeeItem.email}</p>
                                        </div>

                                        <div className="min-w-0 max-md:col-span-2 max-md:row-start-3">
                                            {isEditing ? (
                                                <div className="relative">
                                                    <select
                                                        className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3 py-1.5 pr-8 text-sm md:rounded-full md:border-2 md:border-gray-100"
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
                                                <p className="text-xs text-gray-500 md:text-base md:text-gray-700 md:truncate">
                                                    <span className="md:hidden">Role: </span>
                                                    <span className="font-medium text-gray-700 md:font-normal">{roleLabelByKey[employeeItem.role] || employeeItem.role}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex min-w-[96px] items-center max-md:col-start-2 max-md:row-start-1 max-md:justify-end md:justify-start">
                                            {(() => {
                                                const currentStatus = isEditing ? editingDraft.status : employeeItem.status
                                                const isActive = String(currentStatus || "").toLowerCase() === "active"

                                                if (!isEditing) {
                                                    return (
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                                                                isActive
                                                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                                                    : "bg-gray-100 text-gray-600 ring-gray-200"
                                                            }`}
                                                            title={`Status: ${isActive ? "Active" : "Inactive"}`}
                                                        >
                                                            <span
                                                                className={`h-1.5 w-1.5 rounded-full ${
                                                                    isActive ? "bg-emerald-500" : "bg-gray-400"
                                                                }`}
                                                            />
                                                            {isActive ? "Active" : "Inactive"}
                                                        </span>
                                                    )
                                                }

                                                return (
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={isActive}
                                                        onClick={() => {
                                                            setEditingDraft((current) => ({
                                                                ...current,
                                                                status: current.status === "active" ? "inactive" : "active",
                                                            }))
                                                        }}
                                                        title={isActive ? "Active — click to deactivate" : "Inactive — click to activate"}
                                                        aria-label="Toggle employee status"
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                            isActive
                                                                ? "bg-emerald-500 focus:ring-emerald-400"
                                                                : "bg-gray-300 focus:ring-gray-400"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                                                                isActive ? "translate-x-5" : "translate-x-0.5"
                                                            }`}
                                                        />
                                                    </button>
                                                )
                                            })()}
                                        </div>

                                        <div className="flex items-center justify-end gap-2 max-md:col-span-2 max-md:row-start-4 max-md:mt-1 max-md:border-t max-md:border-gray-100 max-md:pt-2">
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
                                                                className={`rounded-md p-1 transition hover:bg-gray-200 ${
                                                                    employeeItem.clientScope === "assigned"
                                                                        ? "text-amber-700 hover:text-amber-900"
                                                                        : "text-gray-500 hover:text-emerald-700"
                                                                }`}
                                                                onClick={() => openClientAccessModal(employeeItem)}
                                                                title={employeeItem.clientScope === "assigned"
                                                                    ? `Restricted to ${employeeItem.assignedClientIds?.length || 0} clients — click to manage`
                                                                    : "All clients — click to restrict"}
                                                                aria-label="Manage client access"
                                                            >
                                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <rect x="4" y="2" width="16" height="20" rx="2" />
                                                                    <path d="M9 22v-4h6v4" />
                                                                    <path d="M8 6h.01M12 6h.01M16 6h.01" />
                                                                    <path d="M8 10h.01M12 10h.01M16 10h.01" />
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
                    isOpen={showRoleForm}
                    title={editingRoleId ? "Edit Role" : "Create Custom Role"}
                    onClose={closeRoleForm}
                    maxWidthClass="max-w-3xl"
                >
                    <form className="flex flex-col gap-4" onSubmit={handleSaveRole}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role name</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="Reviewer"
                                    value={roleDraft.label}
                                    onChange={(e) => setRoleDraft((current) => ({ ...current, label: e.target.value }))}
                                />
                            </label>
                            <label className="flex flex-col gap-1 sm:col-span-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="Can review categorized transactions"
                                    value={roleDraft.description}
                                    onChange={(e) => setRoleDraft((current) => ({ ...current, description: e.target.value }))}
                                />
                            </label>
                        </div>

                        <div className="max-h-[44vh] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Permissions
                            </p>
                            <div className="flex flex-col gap-5">
                                {modulesPermissionCatalog.map((moduleEntry) => {
                                    const moduleKeys = moduleEntry.groups.flatMap((group) =>
                                        group.items.map((item) => item.key)
                                    )
                                    const enabledInModule = moduleKeys.filter((key) =>
                                        roleDraft.permissions.includes(key)
                                    ).length
                                    const allModuleEnabled = enabledInModule === moduleKeys.length
                                    const noneModuleEnabled = enabledInModule === 0
                                    const moduleIsPartial = !allModuleEnabled && !noneModuleEnabled

                                    return (
                                        <section key={moduleEntry.name} className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between gap-3 px-1">
                                                <div className="flex min-w-0 items-baseline gap-2">
                                                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                                                        {moduleEntry.name}
                                                    </h3>
                                                    <span className="text-[11px] uppercase tracking-wide text-gray-400">
                                                        {enabledInModule}/{moduleKeys.length}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 hover:text-gray-700"
                                                    onClick={() => toggleRolePermissionModule(moduleEntry.name, !allModuleEnabled)}
                                                    aria-pressed={allModuleEnabled}
                                                    title={allModuleEnabled ? `Disable all in ${moduleEntry.name}` : `Enable all in ${moduleEntry.name}`}
                                                >
                                                    <span className="hidden sm:inline">
                                                        {allModuleEnabled ? "All on" : moduleIsPartial ? "Partial" : "All off"}
                                                    </span>
                                                    <span
                                                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                                                            allModuleEnabled
                                                                ? "bg-emerald-500"
                                                                : moduleIsPartial
                                                                    ? "bg-amber-400"
                                                                    : "bg-gray-300"
                                                        }`}
                                                        aria-hidden="true"
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                                allModuleEnabled ? "translate-x-5" : moduleIsPartial ? "translate-x-3" : "translate-x-1"
                                                            }`}
                                                        />
                                                    </span>
                                                </button>
                                            </div>
                                            <div className="h-px bg-gray-200" />
                                            <div className="flex flex-col gap-3">
                                                {moduleEntry.groups.map((groupEntry) => {
                                                    const items = groupEntry.items
                                                    const groupName = groupEntry.name
                                                    const groupKeys = items.map((item) => item.key)
                                                    const enabledInGroup = groupKeys.filter((key) => roleDraft.permissions.includes(key)).length
                                                    const allEnabled = enabledInGroup === groupKeys.length
                                                    const noneEnabled = enabledInGroup === 0
                                                    const partial = !allEnabled && !noneEnabled

                                                    return (
                                                        <section
                                                            key={`${moduleEntry.name}-${groupName}`}
                                                            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                                                        >
                                                            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-3 py-2">
                                                                <div className="flex min-w-0 items-baseline gap-2">
                                                                    <h4 className="text-sm font-semibold text-gray-800">{groupName}</h4>
                                                                    <span className="text-[11px] uppercase tracking-wide text-gray-400">
                                                                        {enabledInGroup}/{groupKeys.length}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 hover:text-gray-700"
                                                                    onClick={() => toggleRolePermissionGroup(groupName, !allEnabled)}
                                                                    aria-pressed={allEnabled}
                                                                    title={allEnabled ? "Disable all in this group" : "Enable all in this group"}
                                                                >
                                                                    <span className="hidden sm:inline">
                                                                        {allEnabled ? "All on" : partial ? "Partial" : "All off"}
                                                                    </span>
                                                                    <span
                                                                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                                                                            allEnabled
                                                                                ? "bg-emerald-500"
                                                                                : partial
                                                                                    ? "bg-amber-400"
                                                                                    : "bg-gray-300"
                                                                        }`}
                                                                        aria-hidden="true"
                                                                    >
                                                                        <span
                                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                                                allEnabled ? "translate-x-5" : partial ? "translate-x-3" : "translate-x-1"
                                                                            }`}
                                                                        />
                                                                    </span>
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                                                                {items.map((permissionItem) => {
                                                                    const checked = roleDraft.permissions.includes(permissionItem.key)
                                                                    return (
                                                                        <button
                                                                            key={permissionItem.key}
                                                                            type="button"
                                                                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                                                                                checked
                                                                                    ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50"
                                                                                    : "border-gray-200 bg-white hover:bg-gray-50"
                                                                            }`}
                                                                            onClick={() => toggleRolePermission(permissionItem.key)}
                                                                        >
                                                                            <span className="text-sm text-gray-700">{permissionItem.label}</span>
                                                                            <span
                                                                                className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition ${
                                                                                    checked ? "bg-emerald-500" : "bg-gray-300"
                                                                                }`}
                                                                                aria-hidden="true"
                                                                            >
                                                                                <span
                                                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                                                        checked ? "translate-x-5" : "translate-x-1"
                                                                                    }`}
                                                                                />
                                                                            </span>
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </section>
                                                    )
                                                })}
                                            </div>
                                        </section>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="mt-1 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={closeRoleForm}
                            >
                                Cancel
                            </button>
                            {!officeId && (
                                <span className="mr-auto text-xs text-gray-500">
                                    {isResolvingOfficeContext ? "Loading office..." : "Office context unavailable"}
                                </span>
                            )}
                            <button
                                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                                type="submit"
                                disabled={!canSubmitRole}
                            >
                                {isSubmitting ? "Saving..." : "Save Role"}
                            </button>
                        </div>
                    </form>
                </PopupModal>

                <PopupModal
                    isOpen={showEmployeeForm}
                    title="Create Employee Account"
                    onClose={() => setShowEmployeeForm(false)}
                    maxWidthClass="max-w-3xl"
                >
                    <form className="flex flex-col gap-4" onSubmit={handleCreateEmployee}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Employee name</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="text"
                                    placeholder="John Doe"
                                    value={newEmployeeName}
                                    onChange={(e) => setNewEmployeeName(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="email"
                                    placeholder="john@company.com"
                                    value={newEmployeeEmail}
                                    onChange={(e) => setNewEmployeeEmail(e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Password</span>
                                <input
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                                    type="password"
                                    placeholder="Password"
                                    value={newEmployeePassword}
                                    onChange={(e) => setNewEmployeePassword(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role</span>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-8 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
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
                            </label>
                        </div>
                        {displayedRoles.length > 0 && (
                            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                {displayedRoles.find((role) => role.key === newEmployeeRole)?.description || "Select a role"}
                            </div>
                        )}

                        <ClientScopeSection
                            scope={newEmployeeClientScope}
                            onScopeChange={setNewEmployeeClientScope}
                            assignedIds={newEmployeeAssignedClientIds}
                            onAssignedChange={setNewEmployeeAssignedClientIds}
                            clients={officeClients}
                            query={clientPickerQuery}
                            onQueryChange={setClientPickerQuery}
                        />

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
                                onClick={() => {
                                    setShowEmployeeForm(false)
                                    setNewEmployeeClientScope("all")
                                    setNewEmployeeAssignedClientIds([])
                                    setClientPickerQuery("")
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                                type="submit"
                                disabled={!canSubmitNewEmployee}
                            >
                                {isSubmitting ? "Saving..." : "Save Employee"}
                            </button>
                        </div>
                    </form>
                </PopupModal>

                <PopupModal
                    isOpen={Boolean(clientAccessEmployee)}
                    title={`Client access — ${clientAccessEmployee?.name || ""}`}
                    onClose={closeClientAccessModal}
                    maxWidthClass="max-w-2xl"
                >
                    <div className="flex flex-col gap-4">
                        <ClientScopeSection
                            scope={clientAccessScope}
                            onScopeChange={setClientAccessScope}
                            assignedIds={clientAccessIds}
                            onAssignedChange={setClientAccessIds}
                            clients={officeClients}
                            query={clientAccessQuery}
                            onQueryChange={setClientAccessQuery}
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={closeClientAccessModal}
                                disabled={isSavingClientAccess}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                                onClick={handleSaveClientAccess}
                                disabled={isSavingClientAccess}
                            >
                                {isSavingClientAccess ? "Saving…" : "Save access"}
                            </button>
                        </div>
                    </div>
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
                    isOpen={Boolean(roleToDelete)}
                    title="Delete Role"
                    message={`Delete role ${roleToDelete?.label || ""}? Employees using this role must be moved first.`}
                    confirmLabel="Delete Role"
                    onConfirm={handleDeleteRole}
                    onClose={() => setRoleToDelete(null)}
                    isLoading={isSubmitting}
                />

                <ConfirmModal
                    isOpen={Boolean(employeeToResetPassword)}
                    title="Reset Employee Password"
                    message={`Generate a temporary password for ${employeeToResetPassword?.name || "this employee"}?`}
                    confirmLabel="Generate Temporary Password"
                    variant="neutral"
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
                        <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 text-sm shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                                Employee
                            </p>
                            <p className="mt-2 text-base font-semibold text-gray-900">
                                {resetPasswordResult?.name}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">{resetPasswordResult?.email}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                                        Temporary password
                                    </p>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Share this once. The employee will change it after login.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                                    onClick={handleCopyTemporaryPassword}
                                >
                                    Copy
                                </button>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                                <p className="break-all font-mono text-base text-gray-900">
                                    {resetPasswordResult?.temporaryPassword}
                                </p>
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

function ClientScopeSection({ scope, onScopeChange, assignedIds, onAssignedChange, clients, query, onQueryChange }) {
    const safeAssigned = new Set((assignedIds || []).map(String))
    const filtered = (clients || []).filter((client) => {
        const q = String(query || "").trim().toLowerCase()
        if (!q) return true
        return String(client?.name || "").toLowerCase().includes(q)
    })

    const toggle = (clientId) => {
        const id = String(clientId)
        const next = new Set(safeAssigned)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onAssignedChange([...next])
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Client access
            </p>
            <p className="mt-1 text-xs text-gray-500">
                Restrict this employee to specific clients (great for freelancers). Office-wide
                chat and tasks tied to their assigned clients stay accessible.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={() => onScopeChange("all")}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        scope === "all"
                            ? "border-gray-900 bg-white ring-2 ring-gray-100"
                            : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                >
                    <p className="font-medium text-gray-900">All clients in the office</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                        Default. Full access to every client.
                    </p>
                </button>
                <button
                    type="button"
                    onClick={() => onScopeChange("assigned")}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        scope === "assigned"
                            ? "border-gray-900 bg-white ring-2 ring-gray-100"
                            : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                >
                    <p className="font-medium text-gray-900">Specific clients only</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                        Pick which clients this employee can see and work on.
                    </p>
                </button>
            </div>

            {scope === "assigned" && (
                <div className="mt-3 flex flex-col gap-2">
                    <input
                        type="text"
                        value={query || ""}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder="Search clients…"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    />
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-gray-500">
                                {clients?.length === 0 ? "No clients in this office yet." : "No clients match the search."}
                            </p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {filtered.map((client) => {
                                    const id = String(client?._id)
                                    const checked = safeAssigned.has(id)
                                    return (
                                        <li key={id}>
                                            <button
                                                type="button"
                                                onClick={() => toggle(id)}
                                                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
                                                    checked ? "bg-gray-100" : "hover:bg-gray-50"
                                                }`}
                                            >
                                                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                                                    checked ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white"
                                                }`}>
                                                    {checked && (
                                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M5 12l5 5L20 7" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-gray-900">{client?.name || "Unnamed client"}</span>
                                                {client?.businessType && (
                                                    <span className="shrink-0 text-[11px] text-gray-500">{client.businessType}</span>
                                                )}
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                    <p className="text-[11px] text-gray-500">
                        {safeAssigned.size} client{safeAssigned.size === 1 ? "" : "s"} selected
                        {safeAssigned.size === 0 && " — they'll be locked out until you pick at least one."}
                    </p>
                </div>
            )}
        </div>
    )
}

export default EmployeesPage
