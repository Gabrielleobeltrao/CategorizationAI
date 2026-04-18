import { useRef, useState } from "react"
import { Outlet } from "react-router-dom"
import Header from "./Header"
import Footer from "./Footer"
import Sidebar from "./Sidebar"

function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const contentScrollRef = useRef(null)

  return (
    <div className="h-dvh overflow-hidden bg-white">
      <div className="flex h-full flex-col">
        <Header />
        <main className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
          />
          <div
            ref={contentScrollRef}
            className="flex flex-1 min-w-0 min-h-0 flex-col overflow-y-auto"
          >
            <div className="flex-1 min-w-0">
              <Outlet context={{ contentScrollRef }} />
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppShell
