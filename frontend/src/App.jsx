import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import FeatureGate from './components/auth/FeatureGate.jsx'
import { NotificationProvider } from './contexts/notification.context.jsx'
import { CategorizationJobsProvider } from './contexts/categorizationJobs.context.jsx'
import { OpenTestProvider } from './contexts/openTest.context.jsx'
import GlobalLoadingOverlay from './components/ui/GlobalLoadingOverlay.jsx'

const loadLandingPage = () => import('./pages/LandingPage.jsx')
const loadLoginPage = () => import('./pages/Login.jsx')
const loadRegisterPage = () => import('./pages/Register.jsx')
const loadCompleteRegistrationPage = () => import('./pages/CompleteRegistration.jsx')
const loadHomePage = () => import('./pages/Home.jsx')
const loadLedgerPage = () => import('./pages/LedgerPage.jsx')
const loadClientsPage = () => import('./pages/ClientsPage.jsx')
const loadEmployeesPage = () => import('./pages/EmployeesPage.jsx')
const loadProfitLossPage = () => import('./pages/ProfitLossPage.jsx')
const loadSettingsPage = () => import('./pages/SettingsPage.jsx')
const loadClientSettingsPage = () => import('./pages/ClientSettingsPage.jsx')
const loadBookkeepingDashboardPage = () => import('./pages/BookkeepingDashboardPage.jsx')
const loadCrmDashboardPage = () => import('./pages/CrmDashboardPage.jsx')
const loadTasksPage = () => import('./pages/TasksPage.jsx')
const loadUpdatePasswordPage = () => import('./pages/UpdatePassword.jsx')
const loadAppShell = () => import('./components/layout/AppShell.jsx')

const LandingPage = lazy(loadLandingPage)
const Login = lazy(loadLoginPage)
const Register = lazy(loadRegisterPage)
const CompleteRegistration = lazy(loadCompleteRegistrationPage)
const Home = lazy(loadHomePage)
const LedgerPage = lazy(loadLedgerPage)
const ClientsPage = lazy(loadClientsPage)
const EmployeesPage = lazy(loadEmployeesPage)
const ProfitLossPage = lazy(loadProfitLossPage)
const SettingsPage = lazy(loadSettingsPage)
const ClientSettingsPage = lazy(loadClientSettingsPage)
const BookkeepingDashboardPage = lazy(loadBookkeepingDashboardPage)
const CrmDashboardPage = lazy(loadCrmDashboardPage)
const TasksPage = lazy(loadTasksPage)
const UpdatePassword = lazy(loadUpdatePasswordPage)
const AppShell = lazy(loadAppShell)

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
                    <FeatureGate flag="crm" fallback={<Navigate to="/home" replace />}>
                      <TasksPage />
                    </FeatureGate>
                  }
                />
                <Route path="/ledger" element={<LedgerPage />} />
                <Route path="/ledger/accounts" element={<LedgerPage />} />
                <Route path="/ledger/categories" element={<LedgerPage />} />
                <Route path="/clients/:clientId/ledger" element={<LedgerPage />} />
                <Route path="/clients/:clientId/ledger/accounts" element={<LedgerPage />} />
                <Route path="/clients/:clientId/ledger/categories" element={<LedgerPage />} />
                <Route path="/clients/:clientId/profit-loss" element={<ProfitLossPage />} />
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
