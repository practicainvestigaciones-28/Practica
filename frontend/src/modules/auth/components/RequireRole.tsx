import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getRolesEfectivos, type Role } from '../lib/auth'

interface RequireRoleProps {
  allowed: Role[]
  children: ReactNode
}

function RequireRole({ allowed, children }: RequireRoleProps) {
  const rolesActivos = getRolesEfectivos()

  if (!allowed.some((r) => rolesActivos.includes(r))) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default RequireRole