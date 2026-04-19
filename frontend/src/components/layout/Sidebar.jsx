import { useEffect, useState } from "react"
import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom"
import { getClientById } from "../../services/clients.service"
import { getMyProfile, signOut } from "../../services/auth.service"
import { useNotification } from "../../contexts/notification.context"
import { hasPermission } from "../../utils/permissions"

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
  const clientScopeMatch = matchPath("/clients/:clientId/*", location.pathname)
  const clientId = clientScopeMatch?.params?.clientId
  const [selectedClient, setSelectedClient] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(null)

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

  const ledgerSubItems = clientId
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
      ]
    : []

  const canReadSettings = hasPermission(currentProfile?.permissions || [], "offices:read")

  const handleLogout = async () => {
    try {
      await signOut()
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

  useEffect(() => {
    let active = true

    getMyProfile()
      .then((profile) => {
        if (!active) return
        setCurrentProfile(profile || null)
      })
      .catch(() => {
        if (!active) return
        setCurrentProfile(null)
      })

    return () => {
      active = false
    }
  }, [])

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

      <div className="min-h-0 flex-1">
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
                <div key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.label !== "Ledger"}
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

                  {item.label === "Ledger" && (
                    <div className={`mt-1 flex flex-col gap-1 ${isCollapsed ? "items-center" : "ml-9"}`}>
                      {ledgerSubItems.map((subItem) => (
                        <NavLink
                          key={subItem.to}
                          to={subItem.to}
                          end={subItem.to.endsWith("/ledger")}
                          title={isCollapsed ? subItem.label : undefined}
                          className={({ isActive }) =>
                            `rounded-md font-medium transition-colors ${
                              isCollapsed ? "flex h-10 w-10 items-center justify-center" : "flex items-center gap-2 px-2 py-2 text-xs"
                            } ${
                              isActive ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            }`
                          }
                        >
                          <span>{subItem.icon}</span>
                          {!isCollapsed && <span>{subItem.label}</span>}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>

      {canReadSettings && (
        <NavLink
          to={settingsNavItem.to}
          className={({ isActive }) =>
            `mt-4 flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
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
