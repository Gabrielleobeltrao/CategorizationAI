import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getClientsByOfficeId } from "../mocks/clients.mock"
import PopupModal from "../components/ui/PopupModal"

function Home() {
    const navigate = useNavigate()

    // mock local até integrar com backend/auth
    const employee = {
        id: "usr_1",
        name: "Gabriel",
        officeId: "off_1",
    }

    const [newUserEmail, setNewUserEmail] = useState("")
    const [newUserPassword, setNewUserPassword] = useState("")
    const [showUserForm, setShowUserForm] = useState(false)
    const [showClientForm, setShowClientForm] = useState(false)
    const [newClientName, setNewClientName] = useState("")
    const [newClientBusinessType, setNewClientBusinessType] = useState("")
    const [newClientDescription, setNewClientDescription] = useState("")
    const [newClientMainActivity, setNewClientMainActivity] = useState("")
    const [newClientState, setNewClientState] = useState("")

    const clients = useMemo(() => {
        return getClientsByOfficeId(employee.officeId)
    }, [employee.officeId])

    const handleCreateEmployeeAccount = (e) => {
        e.preventDefault()

        console.log({
            email: newUserEmail,
            password: newUserPassword,
            officeId: employee.officeId,
        })

        setNewUserEmail("")
        setNewUserPassword("")
        setShowUserForm(false)
    }

    const handleCreateClient = (e) => {
        e.preventDefault()

        console.log({
            officeId: employee.officeId,
            name: newClientName,
            businessType: newClientBusinessType,
            description: newClientDescription,
            mainActivity: newClientMainActivity,
            state: newClientState,
        })

        setNewClientName("")
        setNewClientBusinessType("")
        setNewClientDescription("")
        setNewClientMainActivity("")
        setNewClientState("")
        setShowClientForm(false)
    }

    return (
        <section className="w-full p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <section className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold">Home</h1>
                </section>

                <section className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">Create Employee Account</h2>
                            <p className="text-sm text-gray-500">
                                New account will be linked to office: {employee.officeId}
                            </p>
                        </div>
                        <button
                            className="bg-gray-100 rounded-full px-4 py-2 text-sm font-medium"
                            onClick={() => setShowUserForm(true)}
                        >
                            New User
                        </button>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        className="border border-gray-200 rounded-lg p-4 text-left"
                        onClick={() => setShowClientForm(true)}
                    >
                        <h2 className="text-lg font-semibold">+ New Client</h2>
                        <p className="text-sm text-gray-500">Create a new client for this office</p>
                    </button>

                    {clients.map((client) => (
                        <article
                            key={client.id}
                            className="border border-gray-200 rounded-lg p-4 cursor-pointer"
                            onClick={() => navigate(`/transactions?clientId=${client.id}`)}
                        >
                            <h2 className="text-lg font-semibold">{client.name}</h2>
                            <p className="text-sm text-gray-600">{client.businessType}</p>
                            <p className="text-sm text-gray-500">{client.state}</p>
                        </article>
                    ))}
                </div>

                {clients.length === 0 && (
                    <p className="text-sm text-gray-500">
                        No clients found for this office
                    </p>
                )}

                <PopupModal
                    isOpen={showUserForm}
                    title="Create Employee Account"
                    onClose={() => setShowUserForm(false)}
                >
                    <form className="flex flex-col gap-3" onSubmit={handleCreateEmployeeAccount}>
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="email"
                            placeholder="Employee email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="password"
                            placeholder="Password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                        />
                        <button className="bg-gray-100 rounded-full p-2" type="submit">
                            Create Employee
                        </button>
                    </form>
                </PopupModal>

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
                        <button className="bg-gray-100 rounded-full p-2" type="submit">
                            Save Client
                        </button>
                    </form>
                </PopupModal>
            </div>
        </section>
    )
}

export default Home
