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
 * Se conserva esta función con la misma firma para no tener que tocar
 * Sidebar/Dashboard/Perfil/Proyectos, que ya la consumen.
 */
export function getRole(): Role {
  const usuario = leerUsuarioGuardado()
  if (usuario?.roles.includes('Administrador')) return 'administrador'
  return 'usuario'
}