import { BrowserRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import LandingPage from './pages/LandingPage.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import LedgerPage from './pages/LedgerPage.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'
import ProfitLossPage from './pages/ProfitLossPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import UpdatePassword from './pages/UpdatePassword.jsx'
import AppShell from './components/layout/AppShell.jsx'
import { NotificationProvider } from './contexts/notification.context.jsx'
import { CategorizationJobsProvider } from './contexts/categorizationJobs.context.jsx'
import { OpenTestProvider } from './contexts/openTest.context.jsx'
import GlobalLoadingOverlay from './components/ui/GlobalLoadingOverlay.jsx'

function App() {
  return (
    <NotificationProvider>
      <OpenTestProvider>
        <CategorizationJobsProvider>
          <GlobalLoadingOverlay />
          <BrowserRouter>
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
          </BrowserRouter>
        </CategorizationJobsProvider>
      </OpenTestProvider>
    </NotificationProvider>
  )
}

export default App
