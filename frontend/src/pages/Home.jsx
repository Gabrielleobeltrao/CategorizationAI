import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { getClientsByOfficeId } from "../mocks/clients.mock"

function Home() {
    const navigate = useNavigate()

    // mock local até integrar com backend/auth
    const employee = {
        id: "usr_1",
        name: "Gabriel",
        officeId: "off_1",
    }

    const clients = useMemo(() => {
        return getClientsByOfficeId(employee.officeId)
    }, [employee.officeId])

    return (
        <section className="w-full min-h-dvh p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <header className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold">Clients</h1>
                    <p className="text-sm text-gray-500">
                        Office: {employee.officeId}
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
        </section>
    )
}

export default Home
