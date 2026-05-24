import { useEffect, useState } from "react"
import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom"
import { getClientById } from "../../services/clients.service"
import { signOut } from "../../services/auth.service"
import { useAuth } from "../../contexts/auth.context"
import { useNotification } from "../../contexts/notification.context"
import { useFeature } from "../../hooks/useFeature"
import { hasPermission } from "../../utils/permissions"
import {
  readMenuVisibility,
  VISIBILITY_CHANGED_EVENT,
} from "../../utils/clientMenuVisibility"

const SIDEBAR_SECTIONS_STORAGE_KEY = "sidebar-sections-collapsed"

function readCollapsedSections() {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage?.getItem(SIDEBAR_SECTIONS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeCollapsedSections(value) {
  if (typeof window === "undefined") return
  try {
    window.localStorage?.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(value || {}))
  } catch {
    /* ignore */
  }
}

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

const boardNavItem = {
  to: "/board",
  label: "Board",
  feature: "crmTasks",
  permission: "board:read",
  icon: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="10" rx="1" />
      <rect x="17" y="4" width="4" height="13" rx="1" />
    </svg>
  ),
}

const overviewNavItem = {
  to: "/overview",
  label: "Overview",
  icon: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
}

const bookkeepingNavItems = [
  {
    to: "/clients",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M12 6h.01" />
        <path d="M16 6h.01" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
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
    to: "/crm/tasks",
    label: "Tasks Manager",
    feature: "crmTasks",
    permission: "tasks:read",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M9 3v4" />
        <path d="M15 3v4" />
        <path d="m8 13 2.5 2.5L16 10" />
      </svg>
    ),
  },
  {
    to: "/crm/chat",
    label: "Team Chat Manager",
    feature: "crmChat",
    permission: "chat:manage",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
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

function Sidebar({ isCollapsed: rawCollapsed, isMobileOpen = false, onCloseMobile }) {
  // The mobile drawer is wide enough to always show labels, regardless of the
  // collapse state used on desktop. On desktop, the sidebar stays at the rail
  // width and only expands while the pointer is hovering it (no button).
  const [isHovering, setIsHovering] = useState(false)
  const isCollapsed = isMobileOpen ? false : rawCollapsed && !isHovering
  const location = useLocation()
  const navigate = useNavigate()
  const { success, error } = useNotification()
  const { profile: currentProfile, clearAuth } = useAuth()
  const isCrmEnabled = useFeature("crm")
  const isCrmTasksEnabled = useFeature("crmTasks")
  const isCrmChatEnabled = useFeature("crmChat")
  const featureFlagValues = { crm: isCrmEnabled, crmTasks: isCrmTasksEnabled, crmChat: isCrmChatEnabled }
  const visibleCrmNavItems = crmNavItems.filter((item) => {
    if (item.feature && !featureFlagValues[item.feature]) return false
    if (item.permission && !hasPermission(currentProfile?.permissions, item.permission)) return false
    return true
  })
  const clientScopeMatch = matchPath("/clients/:clientId/*", location.pathname)
  const clientId = clientScopeMatch?.params?.clientId
  const [selectedClient, setSelectedClient] = useState(null)
  const [menuVisibility, setMenuVisibility] = useState(() => readMenuVisibility(clientId))
  const [collapsedSections, setCollapsedSections] = useState(() => readCollapsedSections())

  const toggleSection = (label) => {
    const key = String(label || "").toLowerCase()
    setCollapsedSections((current) => {
      const next = { ...current, [key]: !current[key] }
      writeCollapsedSections(next)
      return next
    })
  }
  const isSectionCollapsed = (label) =>
    Boolean(collapsedSections?.[String(label || "").toLowerCase()])

  // Subscribe to the client-menu-visibility changes dispatched by the
  // Info page so toggling a switch immediately updates the sidebar.
  useEffect(() => {
    setMenuVisibility(readMenuVisibility(clientId))
    const handler = (event) => {
      if (!clientId) return
      if (event?.detail?.clientId && String(event.detail.clientId) !== String(clientId)) return
      setMenuVisibility(readMenuVisibility(clientId))
    }
    window.addEventListener(VISIBILITY_CHANGED_EVENT, handler)
    return () => window.removeEventListener(VISIBILITY_CHANGED_EVENT, handler)
  }, [clientId])

  const isItemVisible = (id) => !id || menuVisibility?.[id] !== false

  const clientMenuItems = clientId
    ? [
        {
          to: `/clients/${clientId}/home`,
          label: "Dashboard",
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
          to: `/clients/${clientId}/transactions`,
          label: "Transactions",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 11 21 7 17 3" />
              <line x1="21" y1="7" x2="9" y2="7" />
              <polyline points="7 21 3 17 7 13" />
              <line x1="15" y1="17" x2="3" y2="17" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/recurring`,
          label: "Recurring",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7l3 2.7" />
              <path d="M21 4v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7l-3-2.7" />
              <path d="M3 20v-5h5" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/chart-of-accounts`,
          label: "Chart of Accounts",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16" />
              <path d="M4 5v14" />
              <path d="M9 8v11" />
              <path d="M9 12h11" />
              <path d="M9 16h11" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/reconciliation`,
          label: "Reconciliation",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7l4 4 4-4" />
              <path d="M7 11V3" />
              <path d="M21 17l-4-4-4 4" />
              <path d="M17 13v8" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/period-close`,
          label: "Period Close",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="6" width="16" height="14" rx="2" />
              <path d="M9 3v4" />
              <path d="M15 3v4" />
              <path d="M4 12h16" />
              <path d="M9 16l2 2 4-4" />
            </svg>
          ),
        },
        { kind: "section", label: "Reports" },
        {
          to: `/clients/${clientId}/reports/profit-loss`,
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
          to: `/clients/${clientId}/reports/account-balances`,
          label: "Account Balances",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="14" x2="12" y2="14" />
              <line x1="14" y1="14" x2="18" y2="14" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/reports/balance-sheet`,
          label: "Balance Sheet",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18" />
              <path d="M6 7l-3 4 3 4" />
              <path d="M18 7l3 4-3 4" />
              <path d="M3 11h18" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/reports/trial-balance`,
          label: "Trial Balance",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h7" />
              <path d="M14 12h7" />
              <path d="M12 4v16" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          ),
        },
        {
          to: `/clients/${clientId}/reports/general-ledger`,
          label: "General Ledger",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" />
              <path d="M4 17a3 3 0 0 1 3-3h13" />
              <path d="M8 8h7" />
              <path d="M8 12h5" />
            </svg>
          ),
        },
        { kind: "divider" },
        {
          to: `/clients/${clientId}/settings`,
          label: "Info",
          icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01" />
              <path d="M11 12h1v5h1" />
            </svg>
          ),
        },
      ].filter((item) => {
        // Section headers, dividers, Overview and Info are always shown.
        // The rest are derived to an id from the URL and gated on the
        // per-client visibility map.
        if (item.kind === "section" || item.kind === "divider") return true
        if (!item.to) return true
        if (item.to.endsWith("/settings")) return true
        if (item.to.endsWith("/home")) return true
        const id = item.to.split("/").pop()
        return isItemVisible(id)
      })
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
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`flex h-full flex-col border-r border-gray-200 bg-white p-3 transition-all duration-200 ${
          isMobileOpen
            ? "fixed inset-y-0 left-0 z-50 w-72 md:static md:z-auto"
            : "fixed inset-y-0 left-0 z-50 w-72 -translate-x-full md:static md:z-auto md:translate-x-0"
        } md:flex ${isCollapsed ? "md:w-16" : "md:w-60 md:shadow-lg"}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={(event) => {
          if (!onCloseMobile) return
          const target = event.target.closest("a")
          if (target && window.matchMedia("(max-width: 767px)").matches) {
            onCloseMobile()
          }
        }}
      >
        <div className="mb-2 flex items-center justify-end md:justify-start">
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 md:hidden"
              aria-label="Close navigation"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
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
          {isCrmEnabled && isCrmTasksEnabled && hasPermission(currentProfile?.permissions, boardNavItem.permission) && (
            <NavLink
              to={boardNavItem.to}
              className={({ isActive }) =>
                `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                  isCollapsed ? "justify-center px-2" : "gap-3 px-3"
                } ${
                  isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                }`
              }
              title={isCollapsed ? boardNavItem.label : undefined}
            >
              <span>{boardNavItem.icon}</span>
              {!isCollapsed && <span>{boardNavItem.label}</span>}
            </NavLink>
          )}
          <NavLink
            to={overviewNavItem.to}
            className={({ isActive }) =>
              `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                isCollapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`
            }
            title={isCollapsed ? overviewNavItem.label : undefined}
          >
            <span>{overviewNavItem.icon}</span>
            {!isCollapsed && <span>{overviewNavItem.label}</span>}
          </NavLink>
        </nav>

        {clientId ? (() => {
          // Split the client menu into three independent groups so the
          // user can collapse the client name (operational items) and the
          // Reports section separately.
          const sectionIdx = clientMenuItems.findIndex((it) => it.kind === "section")
          const dividerAfterSectionIdx =
            sectionIdx >= 0
              ? clientMenuItems.findIndex(
                  (it, i) => i > sectionIdx && it.kind === "divider",
                )
              : -1

          const operationalBefore =
            sectionIdx >= 0 ? clientMenuItems.slice(0, sectionIdx) : clientMenuItems
          const reportsGroup =
            sectionIdx >= 0
              ? clientMenuItems.slice(
                  sectionIdx,
                  dividerAfterSectionIdx > sectionIdx ? dividerAfterSectionIdx : undefined,
                )
              : []
          // Items after the divider that follows Reports (typically just
          // Info) live in their own standalone block at the bottom, so
          // they aren't hidden when the client name section collapses.
          const infoGroup =
            dividerAfterSectionIdx > sectionIdx
              ? clientMenuItems.slice(dividerAfterSectionIdx + 1) // skip the divider
              : []

          // Render a flat list of menu items honoring the activeSection
          // folding rules. Used for the operational group AND the reports
          // group (which has its own section header inside it).
          const renderItems = (items) => {
            let activeSection = null
            return items.map((clientItem, idx) => {
              if (clientItem.kind === "divider") {
                activeSection = null
                return <div key={`divider-${idx}`} className="my-2 border-t border-gray-100" />
              }
              if (clientItem.kind === "section") {
                const sectionLabel = clientItem.label
                activeSection = sectionLabel
                if (isCollapsed) {
                  // Invisible placeholder matching the expanded header
                  // height so the nav icons stay anchored when the
                  // sidebar grows on hover.
                  return (
                    <div
                      key={`section-${idx}`}
                      className="h-6"
                      aria-hidden="true"
                    />
                  )
                }
                const folded = isSectionCollapsed(sectionLabel)
                return (
                  <button
                    key={`section-${idx}`}
                    type="button"
                    onClick={() => toggleSection(sectionLabel)}
                    className="flex h-6 w-full items-center justify-between rounded-md px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 transition hover:text-gray-700"
                    aria-expanded={!folded}
                  >
                    <span>{sectionLabel}</span>
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-3 w-3 transition-transform ${folded ? "-rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                )
              }
              if (!isCollapsed && activeSection && isSectionCollapsed(activeSection)) {
                return null
              }
              return (
                <NavLink
                  key={clientItem.to}
                  to={clientItem.to}
                  end
                  className={({ isActive }) =>
                    `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                      isCollapsed ? "justify-center px-2" : "gap-3 px-3"
                    } ${
                      isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                  title={isCollapsed ? clientItem.label : undefined}
                >
                  <span>{clientItem.icon}</span>
                  {!isCollapsed && <span>{clientItem.label}</span>}
                </NavLink>
              )
            })
          }

          const clientHeaderKey = "__client__"
          const clientFolded = isSectionCollapsed(clientHeaderKey)

          return (
            <>
              <div className="mt-4 border-t border-gray-100 pt-4">
                {isCollapsed ? (
                  // Invisible placeholder so the icons sit at the same Y
                  // position whether the sidebar is hovered or not.
                  <div className="h-6" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(clientHeaderKey)}
                    className="flex h-6 w-full items-center justify-between rounded-md px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 transition hover:text-gray-700"
                    aria-expanded={!clientFolded}
                  >
                    <span className="truncate">
                      {selectedClient ? selectedClient.name : "Client"}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-3 w-3 shrink-0 transition-transform ${clientFolded ? "-rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                )}
                {!isCollapsed && clientFolded ? null : (
                  <nav className="flex flex-col gap-1">{renderItems(operationalBefore)}</nav>
                )}
              </div>

              {reportsGroup.length > 0 && (
                <div className="mt-3">
                  <nav className="flex flex-col gap-1">{renderItems(reportsGroup)}</nav>
                </div>
              )}

              {infoGroup.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <nav className="flex flex-col gap-1">{renderItems(infoGroup)}</nav>
                </div>
              )}
            </>
          )
        })() : (
          <>
            <div className="mt-4 border-t border-gray-100 pt-4">
              {isCrmEnabled && !isCollapsed && (
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Bookkeeping
                </p>
              )}
              <nav className="flex flex-col gap-2">
                {bookkeepingNavItems.map((item) => (
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

            {isCrmEnabled && visibleCrmNavItems.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                {!isCollapsed && (
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    CRM Operacional
                  </p>
                )}
                <nav className="flex flex-col gap-2">
                  {visibleCrmNavItems.map((item) => (
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
          </>
        )}

      </div>

      {!clientId && (
        <>
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
        </>
      )}

      {clientId && (
        <NavLink
          to="/clients"
          end
          className={`mt-4 flex items-center rounded-lg py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 ${
            isCollapsed ? "justify-center px-2" : "gap-3 px-3"
          }`}
          title={isCollapsed ? "Back to Clients" : undefined}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          {!isCollapsed && <span>Back to Clients</span>}
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
    </>
  )
}

export default Sidebar
