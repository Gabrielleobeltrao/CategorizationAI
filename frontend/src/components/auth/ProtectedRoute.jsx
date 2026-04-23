import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../../contexts/auth.context"

export default function ProtectedRoute({ children }) {
  const { isBootstrapping, isAuthenticated, profile } = useAuth()
  const location = useLocation()

  if (isBootstrapping) return <p>Loading...</p>

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!profile && location.pathname !== "/complete-registration") {
    return <Navigate to="/complete-registration" replace />
  }

  return children
}
