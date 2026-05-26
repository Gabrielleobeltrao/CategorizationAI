import { useEffect, useMemo, useRef, useState } from "react"

/**
 * Larger scope picker for the Overview pages.
 *
 * Renders a wide trigger button + a roomy dropdown with three clearly
 * separated sections (Team / Clients / Funcionários) and a search input.
 *
 * Props:
 * - mode: "team" | "client" | "user"
 * - scopeId: id when mode is "client" or "user"
 * - onChange({ mode, scopeId })
 * - clients: [{ _id|id, name }]
 * - users: [{ _id|id, name, email }]
 * - officeName: label shown for the Team option
 */
function OverviewScopeFilter({
  mode = "team",
  scopeId = "",
  onChange,
  clients = [],
  users = [],
  officeName = "Whole office",
  className = "",
}) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const wrapperRef = useRef(null)
  const searchInputRef = useRef(null)

  const teamLabel = String(officeName || "").trim() || "Whole office"

  const selectedLabel = useMemo(() => {
    if (mode === "team") return teamLabel
    if (mode === "client") {
      const found = clients.find((client) => String(client._id || client.id) === String(scopeId))
      return found ? `Client: ${found.name || "Unnamed"}` : "Select scope"
    }
    if (mode === "user") {
      const found = users.find((user) => String(user._id || user.id) === String(scopeId))
      const name = found?.name || found?.email
      return found ? `Funcionário: ${name || "—"}` : "Select scope"
    }
    return "Select scope"
  }, [mode, scopeId, clients, users, teamLabel])

  const term = searchTerm.trim().toLowerCase()
  const matchesTerm = (text) => !term || String(text || "").toLowerCase().includes(term)

  const filteredClients = useMemo(
    () => clients.filter((client) => matchesTerm(client.name)),
    [clients, term]
  )
  const filteredUsers = useMemo(
    () => users.filter((user) => matchesTerm(user.name) || matchesTerm(user.email)),
    [users, term]
  )
  const showTeam = matchesTerm(teamLabel)

  const closeDropdown = () => {
    setOpen(false)
    setSearchTerm("")
  }

  const handleSelect = (nextMode, nextScopeId = "") => {
    onChange?.({ mode: nextMode, scopeId: nextScopeId })
    closeDropdown()
  }

  useEffect(() => {
    if (!open) return undefined
    const timeoutId = window.setTimeout(() => searchInputRef.current?.focus(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onDocPointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        closeDropdown()
      }
    }
    function onKey(event) {
      if (event.key === "Escape") closeDropdown()
    }
    document.addEventListener("mousedown", onDocPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const renderItem = (key, label, isActive, onClick, sublabel = null) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        isActive ? "bg-gray-900 text-white" : "text-gray-800 hover:bg-gray-100"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        {sublabel ? (
          <p className={`truncate text-xs ${isActive ? "text-gray-300" : "text-gray-500"}`}>{sublabel}</p>
        ) : null}
      </div>
      {isActive && (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  )

  const SectionHeader = ({ title, count }) => (
    <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{count}</span>
    </div>
  )

  return (
    <div className={`w-full md:w-96 ${className}`}>
      <div className="relative" ref={wrapperRef}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left outline-none transition ${
            open ? "border-gray-500" : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Scope</p>
            <p className="truncate text-sm font-semibold text-gray-900">{selectedLabel}</p>
          </div>
          <svg
            className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-40 mt-2 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_48px_-12px_rgba(15,23,42,0.25)] md:left-auto md:w-[min(95vw,52rem)]">
            <div className="relative border-b border-gray-100 p-3">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search clients or funcionários"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-gray-500"
              />
              <svg
                className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {showTeam && (
              <div className="border-b border-gray-100 p-2">
                <SectionHeader title="Office" count={1} />
                {renderItem("team", teamLabel, mode === "team", () => handleSelect("team", ""))}
              </div>
            )}

            <div className="grid max-h-[26rem] grid-cols-1 gap-0 md:grid-cols-2">
              <section className="flex flex-col overflow-hidden md:border-r md:border-gray-100">
                <div className="border-b border-gray-100 px-2 pb-1">
                  <SectionHeader title="Clients" count={filteredClients.length} />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredClients.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-gray-400">No clients</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {filteredClients.map((client) => {
                        const id = String(client._id || client.id)
                        return renderItem(
                          `client:${id}`,
                          client.name || "Unnamed",
                          mode === "client" && String(scopeId) === id,
                          () => handleSelect("client", id)
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="flex flex-col overflow-hidden">
                <div className="border-b border-gray-100 px-2 pb-1">
                  <SectionHeader title="Funcionários" count={filteredUsers.length} />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredUsers.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-gray-400">No funcionários</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {filteredUsers.map((user) => {
                        const id = String(user._id || user.id)
                        const primary = user.name || user.email || "—"
                        const sublabel = user.name && user.email ? user.email : null
                        return renderItem(
                          `user:${id}`,
                          primary,
                          mode === "user" && String(scopeId) === id,
                          () => handleSelect("user", id),
                          sublabel
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {!showTeam && filteredClients.length === 0 && filteredUsers.length === 0 && (
              <p className="border-t border-gray-100 px-3 py-6 text-center text-sm text-gray-400">
                No matches
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default OverviewScopeFilter
