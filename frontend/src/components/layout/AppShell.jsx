import { useEffect, useRef, useState } from "react"
import { Outlet } from "react-router-dom"
import Header from "./Header"
import Footer from "./Footer"
import Sidebar from "./Sidebar"
import PopupModal from "../ui/PopupModal"
import { getOpenTestConfig } from "../../services/openTest.service"

function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [openTestConfig, setOpenTestConfig] = useState(null)
  const [isOpenTestModalOpen, setIsOpenTestModalOpen] = useState(false)
  const [isOpenTestBannerVisible, setIsOpenTestBannerVisible] = useState(true)
  const contentScrollRef = useRef(null)

  useEffect(() => {
    let active = true

    getOpenTestConfig()
      .then((config) => {
        if (!active) return
        setOpenTestConfig(config || null)
        if (config?.enabled) {
          setIsOpenTestModalOpen(true)
        }
      })
      .catch(() => {
        if (!active) return
        setOpenTestConfig(null)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="h-dvh overflow-hidden bg-white">
      <div className="flex h-full flex-col">
        <Header />
        {openTestConfig?.enabled && (
          isOpenTestBannerVisible && (
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">Open test environment</p>
                  <p className="mt-1">
                    {openTestConfig?.notices?.banner || "Review every AI categorization carefully during the test period."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpenTestBannerVisible(false)}
                  className="rounded-md p-1.5 text-amber-900 transition hover:bg-amber-100"
                  title="Close notice"
                  aria-label="Close notice"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )
        )}
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

        <PopupModal
          isOpen={isOpenTestModalOpen}
          onClose={() => setIsOpenTestModalOpen(false)}
          title={openTestConfig?.notices?.modalTitle || "Open test environment"}
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-gray-700">
              {openTestConfig?.notices?.modalMessage || "AI categorization is still being tested. Review all generated results carefully."}
            </p>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Confirm categories, splits, uncategorized transactions and profit & loss totals before using them in real work.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpenTestModalOpen(false)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
              >
                I understand
              </button>
            </div>
          </div>
        </PopupModal>
      </div>
    </div>
  )
}

export default AppShell
