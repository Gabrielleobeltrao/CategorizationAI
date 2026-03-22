import { NavLink, matchPath, useLocation } from "react-router-dom"
import { getClientById } from "../../mocks/clients.mock"

const navItems = [
  {
    to: "/home",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
      </svg>
    ),
  },
  {
    to: "/clients",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    ),
  },
  {
    to: "/employees",
    label: "Employees",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20v-1a5 5 0 0 1 5-5h1" />
        <path d="M13 20v-1a4 4 0 0 1 4-4h1" />
      </svg>
    ),
  },
]

function Sidebar({ isCollapsed, onToggleCollapse }) {
  const location = useLocation()
  const clientScopeMatch = matchPath("/clients/:clientId/*", location.pathname)
  const clientId = clientScopeMatch?.params?.clientId
  const selectedClient = clientId ? getClientById(clientId) : null

  const clientMenuItems = clientId
    ? [
        {
          to: `/clients/${clientId}/ledger`,
          label: "Ledger",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 8h8" />
              <path d="M8 12h8" />
              <path d="M8 16h5" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/profit-loss`,
          label: "Profit & Loss",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19h16" />
              <path d="M6 16V9" />
              <path d="M12 16V6" />
              <path d="M18 16v-4" />
            </svg>
          ),
        },
      ]
    : []

  return (
    <aside
      className={`h-full border-r border-gray-200 bg-white p-3 transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="mb-2">
        <button
          type="button"
          className="flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                isCollapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <span>{item.icon}</span>
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {clientMenuItems.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {!isCollapsed && (
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {selectedClient ? selectedClient.name : "Client"}
            </p>
          )}

          <nav className="flex flex-col gap-2">
            {clientMenuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                    isCollapsed ? "justify-center px-2" : "gap-2 px-3"
                  } ${
                    isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <span>{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
