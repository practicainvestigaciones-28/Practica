import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getRole, type Role } from '../lib/auth'

interface RequireRoleProps {
  allowed: Role[]
  children: ReactNode
}

function RequireRole({ allowed, children }: RequireRoleProps) {
  const role = getRole()

  if (!allowed.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default RequireRole