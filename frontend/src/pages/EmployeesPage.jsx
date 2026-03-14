import { useEffect, useMemo, useState } from "react"
import PopupModal from "../components/ui/PopupModal"
import { getEmployeesByOfficeId } from "../mocks/employees.mock"

function EmployeesPage() {
    // mock local até integrar com backend/auth
    const employee = {
        id: "usr_1",
        name: "Gabriel",
        officeId: "off_1",
    }

    const [showEmployeeForm, setShowEmployeeForm] = useState(false)
    const [newEmployeeName, setNewEmployeeName] = useState("")
    const [newEmployeeEmail, setNewEmployeeEmail] = useState("")
    const [newEmployeeRole, setNewEmployeeRole] = useState("")
    const [employees, setEmployees] = useState([])

    const employeesFromMocks = useMemo(() => {
        return getEmployeesByOfficeId(employee.officeId)
    }, [employee.officeId])

    useEffect(() => {
        setEmployees(employeesFromMocks)
    }, [employeesFromMocks])

    const handleCreateEmployee = (e) => {
        e.preventDefault()

        console.log({
            officeId: employee.officeId,
            name: newEmployeeName,
            email: newEmployeeEmail,
            role: newEmployeeRole,
        })

        setEmployees((current) => [
            ...current,
            {
                id: `${Date.now()}`,
                officeId: employee.officeId,
                name: newEmployeeName,
                email: newEmployeeEmail,
                role: newEmployeeRole || "staff",
                status: "invited",
            },
        ])

        setNewEmployeeName("")
        setNewEmployeeEmail("")
        setNewEmployeeRole("")
        setShowEmployeeForm(false)
    }

    return (
        <section className="w-full min-h-dvh p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">Employees</h1>
                        <p className="text-sm text-gray-500">
                            Office: {employee.officeId}
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

                {employees.length === 0 && (
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
                            type="text"
                            placeholder="Role (owner, manager, staff)"
                            value={newEmployeeRole}
                            onChange={(e) => setNewEmployeeRole(e.target.value)}
                        />
                        <button className="bg-gray-100 rounded-full p-2" type="submit">
                            Save Employee
                        </button>
                    </form>
                </PopupModal>
            </div>
        </section>
    )
}

export default EmployeesPage
