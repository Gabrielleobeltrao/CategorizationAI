import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { getHomeDashboardByOfficeId } from "../mocks/homeDashboard.mock"

function Home() {
  const navigate = useNavigate()

  // mock local até integrar com backend/auth
  const employee = {
    id: "usr_1",
    name: "Gabriel",
    officeId: "off_1",
    role: "Owner",
  }

  const dashboard = useMemo(() => {
    return getHomeDashboardByOfficeId(employee.officeId)
  }, [employee.officeId])

  return (
    <section className="w-full h-full min-h-0 overflow-auto p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Office Dashboard</h1>
          <p className="text-sm text-gray-500">
            {employee.name} ({employee.role}) · workspace {employee.officeId}
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.kpis.map((kpi) => (
            <article key={kpi.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">{kpi.value}</h2>
              <p className="mt-1 text-sm text-gray-600">{kpi.trend}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Monthly Close Progress</h2>
            <p className="text-sm text-gray-500">How much of each month is already closed</p>

            <div className="mt-4 flex flex-col gap-3">
              {dashboard.closeProgress.map((item) => (
                <div key={item.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.month}</span>
                    <span className="font-medium text-gray-900">{item.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Workflow Queue</h2>
            <p className="text-sm text-gray-500">Current processing status</p>

            <div className="mt-4 flex flex-col gap-3">
              {dashboard.workflowQueue.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className={`h-2 w-2 rounded-full ${item.colorClass}`} />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Team Capacity</h2>
            <p className="text-sm text-gray-500">Completed tasks per assignee</p>

            <div className="mt-4 flex flex-col gap-3">
              {dashboard.teamCapacity.map((member) => {
                const progress = Math.round((member.completed / member.assigned) * 100)
                return (
                  <div key={member.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{member.name}</span>
                      <span className="font-medium text-gray-900">
                        {member.completed}/{member.assigned}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Office Alerts</h2>
            <p className="text-sm text-gray-500">Items requiring action</p>

            <ul className="mt-4 flex flex-col gap-2">
              {dashboard.alerts.map((alert) => (
                <li key={alert} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {alert}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <p className="text-sm text-gray-500">Office-level shortcuts</p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {dashboard.quickActions.map((action) => (
              <button
                key={action.id}
                className="rounded-lg border border-gray-100 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => navigate(action.to)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export default Home
