import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import FeatureGate from './components/auth/FeatureGate.jsx'
import PermissionGate from './components/auth/PermissionGate.jsx'
import { NotificationProvider } from './contexts/notification.context.jsx'
import { CategorizationJobsProvider } from './contexts/categorizationJobs.context.jsx'
import { OpenTestProvider } from './contexts/openTest.context.jsx'
import GlobalLoadingOverlay from './components/ui/GlobalLoadingOverlay.jsx'

const loadLandingPage = () => import('./pages/LandingPage.jsx')
const loadLoginPage = () => import('./pages/Login.jsx')
const loadRegisterPage = () => import('./pages/Register.jsx')
const loadCompleteRegistrationPage = () => import('./pages/CompleteRegistration.jsx')
const loadHomePage = () => import('./pages/Home.jsx')
const loadClientsPage = () => import('./pages/ClientsPage.jsx')
const loadEmployeesPage = () => import('./pages/EmployeesPage.jsx')
const loadProfitLossPage = () => import('./pages/ProfitLossPage.jsx')
const loadAccountBalancesPage = () => import('./pages/AccountBalancesPage.jsx')
const loadBalanceSheetPage = () => import('./pages/BalanceSheetPage.jsx')
const loadTrialBalancePage = () => import('./pages/TrialBalancePage.jsx')
const loadGeneralLedgerPage = () => import('./pages/GeneralLedgerPage.jsx')
const loadChartOfAccountsPage = () => import('./pages/ChartOfAccountsPage.jsx')
const loadReconciliationPage = () => import('./pages/ReconciliationPage.jsx')
const loadTransactionsPage = () => import('./pages/LedgerPage.jsx')
const loadSettingsPage = () => import('./pages/SettingsPage.jsx')
const loadClientSettingsPage = () => import('./pages/ClientSettingsPage.jsx')
const loadBookkeepingDashboardPage = () => import('./pages/BookkeepingDashboardPage.jsx')
const loadCrmDashboardPage = () => import('./pages/CrmDashboardPage.jsx')
const loadTasksPage = () => import('./pages/TasksPage.jsx')
const loadBoardPage = () => import('./pages/BoardPage.jsx')
const loadUpdatePasswordPage = () => import('./pages/UpdatePassword.jsx')
const loadAppShell = () => import('./components/layout/AppShell.jsx')

const LandingPage = lazy(loadLandingPage)
const Login = lazy(loadLoginPage)
const Register = lazy(loadRegisterPage)
const CompleteRegistration = lazy(loadCompleteRegistrationPage)
const Home = lazy(loadHomePage)
const ClientsPage = lazy(loadClientsPage)
const EmployeesPage = lazy(loadEmployeesPage)
const ProfitLossPage = lazy(loadProfitLossPage)
const AccountBalancesPage = lazy(loadAccountBalancesPage)
const BalanceSheetPage = lazy(loadBalanceSheetPage)
const TrialBalancePage = lazy(loadTrialBalancePage)
const GeneralLedgerPage = lazy(loadGeneralLedgerPage)
const ChartOfAccountsPage = lazy(loadChartOfAccountsPage)
const ReconciliationPage = lazy(loadReconciliationPage)
const TransactionsPage = lazy(loadTransactionsPage)
const SettingsPage = lazy(loadSettingsPage)
const ClientSettingsPage = lazy(loadClientSettingsPage)
const BookkeepingDashboardPage = lazy(loadBookkeepingDashboardPage)
const CrmDashboardPage = lazy(loadCrmDashboardPage)
const TasksPage = lazy(loadTasksPage)
const BoardPage = lazy(loadBoardPage)
const UpdatePassword = lazy(loadUpdatePasswordPage)
const AppShell = lazy(loadAppShell)

// Legacy URL redirects — the Bank Accounts / P&L Categories pages were
// folded into the Chart of Accounts, and the old Ledger page into the
// new Transactions page. Bookmarks to the old URLs keep working.
function RedirectToTransactions() {
  const { clientId } = useParams()
  return <Navigate to={`/clients/${clientId}/transactions`} replace />
}
function RedirectToCoa() {
  const { clientId } = useParams()
  return <Navigate to={`/clients/${clientId}/chart-of-accounts`} replace />
}

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-6">
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  )
}

function App() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const preload = () => {
      loadClientsPage()
      loadEmployeesPage()
      loadSettingsPage()
    }

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 1200 })
      return () => window.cancelIdleCallback?.(id)
    }

    const timeoutId = window.setTimeout(preload, 400)
    return () => window.clearTimeout(timeoutId)
  }, [])

  return (
    <NotificationProvider>
      <OpenTestProvider>
        <CategorizationJobsProvider>
          <GlobalLoadingOverlay />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>

              <Route
                path="/"
                element={<LandingPage />}
              />

              <Route
                path="/login"
                element={<Login />}
              />

              <Route
                path="/register"
                element={<Register />}
              />

              <Route
                path="/complete-registration"
                element={
                  <ProtectedRoute>
                    <CompleteRegistration />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/update-password"
                element={
                  <ProtectedRoute>
                    <UpdatePassword />
                  </ProtectedRoute>
                }
              />

              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/home" element={<Home />} />
                <Route path="/bookkeeping" element={<BookkeepingDashboardPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route
                  path="/crm"
                  element={
                    <FeatureGate flag="crm" fallback={<Navigate to="/home" replace />}>
                      <CrmDashboardPage />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/crm/tasks"
                  element={
                    <FeatureGate flag="crmTasks" fallback={<Navigate to="/home" replace />}>
                      <PermissionGate permission="tasks:read" fallback={<Navigate to="/home" replace />}>
                        <TasksPage />
                      </PermissionGate>
                    </FeatureGate>
                  }
                />
                <Route
                  path="/board"
                  element={
                    /* Board requires the parent Operations CRM add-on AND the
                     * Tasks sub-feature. The CRM gate is technically redundant
                     * (normalizeOfficeFeatures forces crmTasks=false when
                     * crm=false) but kept here to make the contract explicit. */
                    <FeatureGate flag="crm" fallback={<Navigate to="/home" replace />}>
                      <FeatureGate flag="crmTasks" fallback={<Navigate to="/home" replace />}>
                        <BoardPage />
                      </FeatureGate>
                    </FeatureGate>
                  }
                />
                <Route path="/clients/:clientId/ledger" element={<RedirectToTransactions />} />
                <Route path="/clients/:clientId/ledger/accounts" element={<RedirectToCoa />} />
                <Route path="/clients/:clientId/ledger/categories" element={<RedirectToCoa />} />
                <Route path="/clients/:clientId/profit-loss" element={<ProfitLossPage />} />
                <Route path="/clients/:clientId/reports/profit-loss" element={<ProfitLossPage />} />
                <Route path="/clients/:clientId/reports/account-balances" element={<AccountBalancesPage />} />
                <Route path="/clients/:clientId/reports/balance-sheet" element={<BalanceSheetPage />} />
                <Route path="/clients/:clientId/reports/trial-balance" element={<TrialBalancePage />} />
                <Route path="/clients/:clientId/reports/general-ledger" element={<GeneralLedgerPage />} />
                <Route path="/clients/:clientId/chart-of-accounts" element={<ChartOfAccountsPage />} />
                <Route path="/clients/:clientId/reconciliation" element={<ReconciliationPage />} />
                <Route path="/clients/:clientId/transactions" element={<TransactionsPage />} />
                <Route path="/clients/:clientId/inbox" element={<RedirectToTransactions />} />
                <Route path="/clients/:clientId/settings" element={<ClientSettingsPage />} />
              </Route>

              </Routes>
            </Suspense>
          </BrowserRouter>
        </CategorizationJobsProvider>
      </OpenTestProvider>
    </NotificationProvider>
  )
}

export default App
