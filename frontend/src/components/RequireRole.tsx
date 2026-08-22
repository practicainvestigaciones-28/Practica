import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface RequireRoleProps {
  /** Nombres de rol EXACTOS del backend, ej. ['Administrador'] */
  allowed: string[]
  children: ReactNode
}

function RequireRole({ allowed, children }: RequireRoleProps) {
  const { tieneRol } = useAuth()

  if (!tieneRol(...allowed)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default RequireRole