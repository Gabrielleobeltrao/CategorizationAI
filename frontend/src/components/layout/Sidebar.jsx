import { useEffect, useState } from "react"
import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom"
import { getClientById } from "../../services/clients.service"
import { signOut } from "../../services/auth.service"
import { useAuth } from "../../contexts/auth.context"
import { useNotification } from "../../contexts/notification.context"
import { useFeature } from "../../hooks/useFeature"
import { hasPermission } from "../../utils/permissions"

const homeNavItem = {
  to: "/home",
  label: "Home",
  icon: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  ),
}

const bookkeepingNavItems = [
  {
    to: "/bookkeeping",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7v7H3z" />
        <path d="M14 3h7v7h-7z" />
        <path d="M14 14h7v7h-7z" />
        <path d="M3 14h7v7H3z" />
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
]

const employeesNavItem = {
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
}

const crmNavItems = [
  {
    to: "/crm",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7v7H3z" />
        <path d="M14 3h7v7h-7z" />
        <path d="M14 14h7v7h-7z" />
        <path d="M3 14h7v7H3z" />
      </svg>
    ),
  },
  {
    to: "/crm/tasks",
    label: "Tasks",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M9 3v4" />
        <path d="M15 3v4" />
        <path d="m8 13 2.5 2.5L16 10" />
      </svg>
    ),
  },
]

const settingsNavItem = {
  to: "/settings",
  label: "Settings",
  icon: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8l-.1.1a2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-2 2h-.2a2 2 0 0 1-2-2v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8 0l-.1-.1a2 2 0 0 1 0-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1-2-2v-.2a2 2 0 0 1 2-2h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 0-2.8l.1-.1a2 2 0 0 1 2.8 0l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 0 1 2-2h.2a2 2 0 0 1 2 2v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 0l.1.1a2 2 0 0 1 0 2.8l-.1.1a1 1 0 0 0-.2 1.1V9c0 .4.2.7.6.9h.2H20a2 2 0 0 1 2 2v.2a2 2 0 0 1-2 2h-.2a1 1 0 0 0-.9.6Z" />
    </svg>
  ),
}

function Sidebar({ isCollapsed, onToggleCollapse }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { success, error } = useNotification()
  const { profile: currentProfile, clearAuth } = useAuth()
  const isCrmEnabled = useFeature("crm")
  const clientScopeMatch = matchPath("/clients/:clientId/*", location.pathname)
  const clientId = clientScopeMatch?.params?.clientId
  const [selectedClient, setSelectedClient] = useState(null)

  const clientMenuItems = clientId
    ? [
        {
          to: `/clients/${clientId}/ledger`,
          label: "Transactions",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h10" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/ledger/accounts`,
          label: "Accounts",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/ledger/categories`,
          label: "Categories",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h10" />
              <path d="M4 12h16" />
              <path d="M4 17h12" />
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
        {
          to: `/clients/${clientId}/settings`,
          label: "Settings",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
            </svg>
          ),
        },
      ]
    : []

  const canReadSettings = hasPermission(currentProfile?.permissions || [], "offices:read")

  const handleLogout = async () => {
    try {
      await signOut()
      clearAuth()
      success("Logged out successfully")
      navigate("/login", { replace: true })
    } catch (err) {
      error(err.message || "Failed to logout")
    }
  }

  useEffect(() => {
    let active = true

    if (!clientId) {
      return () => {
        active = false
      }
    }

    getClientById(clientId)
      .then((clientData) => {
        if (!active) return
        setSelectedClient(clientData || null)
      })
      .catch(() => {
        if (!active) return
        setSelectedClient(null)
      })

    return () => {
      active = false
    }
  }, [clientId])

  return (
    <aside
      className={`flex h-full flex-col border-r border-gray-200 bg-white p-3 transition-all duration-200 ${
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

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="flex flex-col gap-2">
          <NavLink
            to={homeNavItem.to}
            className={({ isActive }) =>
              `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                isCollapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`
            }
            title={isCollapsed ? homeNavItem.label : undefined}
          >
            <span>{homeNavItem.icon}</span>
            {!isCollapsed && <span>{homeNavItem.label}</span>}
          </NavLink>
        </nav>

        <div className="mt-4 border-t border-gray-100 pt-4">
          {isCrmEnabled && !isCollapsed && (
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Bookkeeping
            </p>
          )}
          <nav className="flex flex-col gap-2">
            {bookkeepingNavItems.map((item) => (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  end
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

                {item.to === "/clients" && clientMenuItems.length > 0 && (
                  <div className={`mt-1 flex flex-col gap-1 ${isCollapsed ? "items-center" : "ml-3 border-l border-gray-100 pl-3"}`}>
                    {!isCollapsed && (
                      <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {selectedClient ? selectedClient.name : "Client"}
                      </p>
                    )}
                    {clientMenuItems.map((clientItem) => (
                      <NavLink
                        key={clientItem.to}
                        to={clientItem.to}
                        end
                        className={({ isActive }) =>
                          `flex items-center rounded-md py-1.5 text-xs font-medium transition-colors ${
                            isCollapsed ? "justify-center px-2" : "gap-2 px-2"
                          } ${
                            isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                          }`
                        }
                        title={isCollapsed ? clientItem.label : undefined}
                      >
                        <span>{clientItem.icon}</span>
                        {!isCollapsed && <span>{clientItem.label}</span>}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {isCrmEnabled && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            {!isCollapsed && (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                CRM Operacional
              </p>
            )}
            <nav className="flex flex-col gap-2">
              {crmNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
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
          </div>
        )}

      </div>

      <NavLink
        to={employeesNavItem.to}
        end
        className={({ isActive }) =>
          `mt-4 flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
            isCollapsed ? "justify-center px-2" : "gap-3 px-3"
          } ${
            isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
          }`
        }
        title={isCollapsed ? employeesNavItem.label : undefined}
      >
        <span>{employeesNavItem.icon}</span>
        {!isCollapsed && <span>{employeesNavItem.label}</span>}
      </NavLink>

      {canReadSettings && (
        <NavLink
          to={settingsNavItem.to}
          end
          className={({ isActive }) =>
            `mt-2 flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
              isCollapsed ? "justify-center px-2" : "gap-3 px-3"
            } ${
              isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
            }`
          }
          title={isCollapsed ? settingsNavItem.label : undefined}
        >
          <span>{settingsNavItem.icon}</span>
          {!isCollapsed && <span>{settingsNavItem.label}</span>}
        </NavLink>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 ${
            isCollapsed ? "justify-center px-2" : "gap-3 px-3"
          }`}
          title={isCollapsed ? "Logout" : undefined}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
