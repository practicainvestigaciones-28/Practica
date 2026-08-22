export type Role = 'administrador' | 'usuario'

const ROLE_KEY = 'rol'

export function setRole(role: Role) {
  sessionStorage.setItem(ROLE_KEY, role)
}

export function getRole(): Role {
  return (sessionStorage.getItem(ROLE_KEY) as Role) ?? 'usuario'
}