import { useEffect, useRef, useState } from "react"
import { Outlet } from "react-router-dom"
import Header from "./Header"
import Footer from "./Footer"
import Sidebar from "./Sidebar"
import PopupModal from "../ui/PopupModal"
import { useOpenTest } from "../../contexts/openTest.context"

const PRIVATE_BETA_REVIEW_EVENT = "app:private-beta-review-required"
const BETA_BANNER_DISMISSED_KEY = "private-beta-banner-dismissed-date"
const BETA_MODAL_DISMISSED_KEY = "private-beta-modal-dismissed-date"

function todayISO() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10)
}

function wasDismissedToday(storageKey) {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage?.getItem(storageKey) === todayISO()
  } catch {
    return false
  }
}

function markDismissedToday(storageKey) {
  if (typeof window === "undefined") return
  try {
    window.localStorage?.setItem(storageKey, todayISO())
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isOpenTestModalOpen, setIsOpenTestModalOpen] = useState(false)
  const [isOpenTestBannerVisible, setIsOpenTestBannerVisible] = useState(
    () => !wasDismissedToday(BETA_BANNER_DISMISSED_KEY),
  )
  const contentScrollRef = useRef(null)
  const { config: openTestConfig } = useOpenTest()

  useEffect(() => {
    if (!openTestConfig?.enabled) return
    if (wasDismissedToday(BETA_MODAL_DISMISSED_KEY)) return
    setIsOpenTestModalOpen(true)
  }, [openTestConfig?.enabled])

  useEffect(() => {
    const handlePrivateBetaReview = () => {
      setIsOpenTestModalOpen(true)
    }

    window.addEventListener(PRIVATE_BETA_REVIEW_EVENT, handlePrivateBetaReview)

    return () => {
      window.removeEventListener(PRIVATE_BETA_REVIEW_EVENT, handlePrivateBetaReview)
    }
  }, [])

  const dismissBetaBanner = () => {
    markDismissedToday(BETA_BANNER_DISMISSED_KEY)
    setIsOpenTestBannerVisible(false)
  }

  const dismissBetaModal = () => {
    markDismissedToday(BETA_MODAL_DISMISSED_KEY)
    setIsOpenTestModalOpen(false)
  }

  return (
    <div className="h-dvh overflow-hidden bg-white">
      <div className="flex h-full flex-col">
        <Header onOpenNav={() => setIsMobileNavOpen(true)} />
        {openTestConfig?.enabled && (
          isOpenTestBannerVisible && (
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">Private beta</p>
                  <p className="mt-1">
                    {openTestConfig?.notices?.banner || "AI categorization and generated financial outputs are still being validated, and some loads can take longer while the final infrastructure is not in place. Review every result before real use."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissBetaBanner}
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
            isMobileOpen={isMobileNavOpen}
            onCloseMobile={() => setIsMobileNavOpen(false)}
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
          onClose={dismissBetaModal}
          title={openTestConfig?.notices?.modalTitle || "Private beta"}
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-gray-700">
              {openTestConfig?.notices?.modalMessage || "AI categorization, transaction grouping and profit & loss outputs can still contain mistakes, so review every result carefully before relying on it in real work. Some loading delays can happen because the production infrastructure is still temporary."}
            </p>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Review categories, splits, uncategorized transactions and profit & loss totals before using them in real work. If a screen takes longer to load, wait for the current operation to finish before making business decisions from the data.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={dismissBetaModal}
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
