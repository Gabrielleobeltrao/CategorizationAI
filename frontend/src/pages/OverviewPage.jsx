import { lazy, Suspense, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useFeature } from "../hooks/useFeature"

const BookkeepingDashboardPage = lazy(() => import("./BookkeepingDashboardPage.jsx"))
const CrmDashboardPage = lazy(() => import("./CrmDashboardPage.jsx"))

// Single "Overview" landing that flips between Bookkeeping metrics and
// the CRM Operacional dashboard via folder-style tabs at the top. The
// scope filter is hoisted here so switching tabs preserves the picked
// office/client/user filter instead of resetting it.

function OverviewPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const isCrmEnabled = useFeature("crm")

    // CRM tab only available when the feature is on; bookkeeping is the default.
    const requestedTab = searchParams.get("tab")
    const activeTab =
        requestedTab === "crm" && isCrmEnabled ? "crm" : "bookkeeping"

    const setTab = (tab) => {
        const next = new URLSearchParams(searchParams)
        next.set("tab", tab)
        setSearchParams(next, { replace: true })
    }

    // Shared scope filter — passed as controlled props to both child
    // pages so flipping tabs keeps the same office/client/user lens.
    const [scopeMode, setScopeMode] = useState("team")
    const [scopeId, setScopeId] = useState("")
    const handleScopeChange = ({ mode, scopeId: nextScopeId }) => {
        setScopeMode(mode)
        setScopeId(nextScopeId || "")
    }

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-gray-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-end gap-1 px-12 pt-4">
                    <TabButton
                        label="Bookkeeping"
                        isActive={activeTab === "bookkeeping"}
                        onClick={() => setTab("bookkeeping")}
                    />
                    {isCrmEnabled && (
                        <TabButton
                            label="CRM Operacional"
                            isActive={activeTab === "crm"}
                            onClick={() => setTab("crm")}
                        />
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
                <Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center px-12 py-8 text-sm text-gray-500">
                            Loading…
                        </div>
                    }
                >
                    {activeTab === "crm" ? (
                        <CrmDashboardPage
                            scopeMode={scopeMode}
                            scopeId={scopeId}
                            onScopeChange={handleScopeChange}
                        />
                    ) : (
                        <BookkeepingDashboardPage
                            scopeMode={scopeMode}
                            scopeId={scopeId}
                            onScopeChange={handleScopeChange}
                        />
                    )}
                </Suspense>
            </div>
        </div>
    )
}

function TabButton({ label, isActive, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={`-mb-px rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold transition ${
                isActive
                    ? "border-gray-200 bg-white text-gray-900"
                    : "border-transparent bg-transparent text-gray-500 hover:text-gray-900"
            }`}
        >
            {label}
        </button>
    )
}

export default OverviewPage
