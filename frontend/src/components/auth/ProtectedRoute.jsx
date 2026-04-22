import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../../contexts/auth.context"

export default function ProtectedRoute({ children }) {
  const { isBootstrapping, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isBootstrapping) return <p>Loading...</p>

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
