import { BrowserRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import LandingPage from './pages/LandingPage.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Transactions from './pages/Transactions.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'
import ProfitLossPage from './pages/ProfitLossPage.jsx'
import AppShell from './components/layout/AppShell.jsx'

function App() {
  return (
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
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/clients/:clientId/transactions" element={<Transactions />} />
          <Route path="/clients/:clientId/profit-loss" element={<ProfitLossPage />} />
        </Route>

      </Routes>
    </BrowserRouter>
  )
}

export default App
