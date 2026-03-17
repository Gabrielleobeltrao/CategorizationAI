import { useMemo } from "react"
import { useParams } from "react-router-dom"
import { getClientById } from "../mocks/clients.mock"

function ProfitLossPage() {
  const { clientId } = useParams()

  const client = useMemo(() => {
    if (!clientId) return null
    return getClientById(clientId)
  }, [clientId])

  return (
    <section className="w-full h-full min-h-0 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Profit & Loss</h1>
        <p className="text-sm text-gray-500">
          Client: {client ? client.name : "Unknown client"}
        </p>

        <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
          P&L screen placeholder. Here we will show revenue, expenses and net profit by period.
        </div>
      </div>
    </section>
  )
}

export default ProfitLossPage
