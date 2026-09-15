export type Role = 'administrador' | 'usuario' | 'par_evaluador' | 'comite_etica'

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

export function getRole(): Role {
  const usuario = leerUsuarioGuardado()
  if (usuario?.roles.includes('Administrador')) return 'administrador'
  if (usuario?.roles.includes('Par Evaluador')) return 'par_evaluador'
  if (usuario?.roles.includes('Comité de Ética')) return 'comite_etica'
  return 'usuario'
}