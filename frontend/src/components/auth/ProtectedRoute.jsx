import { Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { api } from "../../lib/api"

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [isAuthed, setIsAuthed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let active = true

    api("/api/auth/get-session")
      .then((data) => {
        if (!active) return;
        setIsAuthed(Boolean(data?.session && data?.user))
      })
      .catch(() => {
        if (!active) return
        setIsAuthed(false)
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, []);

  if (loading) return <p>Loading...</p>

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}