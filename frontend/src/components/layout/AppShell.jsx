import { useState } from "react"
import { Outlet } from "react-router-dom"
import Header from "./Header"
import Footer from "./Footer"
import Sidebar from "./Sidebar"

function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="bg-white">
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
          />
          <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}

export default AppShell
