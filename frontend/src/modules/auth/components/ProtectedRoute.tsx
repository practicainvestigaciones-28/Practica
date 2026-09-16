import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute() {
  const { token, cargando } = useAuth()

  if (cargando) return null
  if (!token) return <Navigate to="/" replace />

  return <Outlet />
}

export default ProtectedRoute
