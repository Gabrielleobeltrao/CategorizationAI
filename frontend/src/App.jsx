import { BrowserRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import LandingPage from './pages/LandingPage.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Transactions from './pages/Transactions.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'

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
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>}
        />

        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <ClientsPage />
            </ProtectedRoute>}
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <EmployeesPage />
            </ProtectedRoute>}
        />

        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App
