import { NavLink } from "react-router-dom"

const navItems = [
  {
    to: "/home",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10.5 12 3l9 7.5V21H3z" />
      </svg>
    ),
  },
  {
    to: "/clients",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1" />
        <circle cx="12" cy="7" r="3" />
      </svg>
    ),
  },
  {
    to: "/employees",
    label: "Employees",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="3" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a3 3 0 0 1 0 5.74" />
      </svg>
    ),
  },
  {
    to: "/transactions",
    label: "Transactions",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5h18M3 12h18M3 19h18" />
      </svg>
    ),
  },
]

function Sidebar({ isCollapsed, onToggleCollapse }) {
  return (
    <aside
      className={`h-full border-r border-gray-200 bg-white p-3 transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="mb-3 border-b border-gray-100 pb-3">
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
    </aside>
  )
}

export default Sidebar
