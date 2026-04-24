import { Suspense, lazy } from 'react'
import { BrowserRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import { NotificationProvider } from './contexts/notification.context.jsx'
import { CategorizationJobsProvider } from './contexts/categorizationJobs.context.jsx'
import { OpenTestProvider } from './contexts/openTest.context.jsx'
import GlobalLoadingOverlay from './components/ui/GlobalLoadingOverlay.jsx'

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const CompleteRegistration = lazy(() => import('./pages/CompleteRegistration.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const LedgerPage = lazy(() => import('./pages/LedgerPage.jsx'))
const ClientsPage = lazy(() => import('./pages/ClientsPage.jsx'))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage.jsx'))
const ProfitLossPage = lazy(() => import('./pages/ProfitLossPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const UpdatePassword = lazy(() => import('./pages/UpdatePassword.jsx'))
const AppShell = lazy(() => import('./components/layout/AppShell.jsx'))

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-6">
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  )
}

function App() {
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
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/ledger" element={<LedgerPage />} />
                <Route path="/ledger/accounts" element={<LedgerPage />} />
                <Route path="/ledger/categories" element={<LedgerPage />} />
                <Route path="/clients/:clientId/ledger" element={<LedgerPage />} />
                <Route path="/clients/:clientId/ledger/accounts" element={<LedgerPage />} />
                <Route path="/clients/:clientId/ledger/categories" element={<LedgerPage />} />
                <Route path="/clients/:clientId/profit-loss" element={<ProfitLossPage />} />
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
