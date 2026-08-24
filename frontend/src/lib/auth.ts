export type Role = 'administrador' | 'usuario'

interface UsuarioGuardado {
  roles: string[]
}

function leerUsuarioGuardado(): UsuarioGuardado | null {
  const raw = localStorage.getItem('usuario') ?? sessionStorage.getItem('usuario')
  if (!raw) return null
  try {
    return JSON.parse(raw) as UsuarioGuardado
  } catch {
    return null
  }
}

/**
 * Deriva el rol simplificado (administrador | usuario) a partir de los
 * roles reales que devuelve el backend (Administrador, Investigador, ...).
 */
export function getRole(): Role {
  const usuario = leerUsuarioGuardado()
  if (usuario?.roles.includes('Administrador')) return 'administrador'
  return 'usuario'
}