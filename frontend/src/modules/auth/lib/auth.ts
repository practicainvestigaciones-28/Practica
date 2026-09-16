export type Role = 'administrador' | 'usuario' | 'par_evaluador' | 'comite_etica'

export const NOMBRES_ROL_REAL = {
  administrador: 'Administrador',
  comite_etica: 'Comité de Ética',
  par_evaluador: 'Par Evaluador',
  usuario: 'Investigador',
} as const satisfies Record<Role, string>

// Orden de prioridad cuando hace falta UN solo rol "principal" (ej. qué
// variante de Dashboard mostrar) aunque la sesión tenga varios activos.
const PRIORIDAD_ROL: Role[] = ['administrador', 'par_evaluador', 'comite_etica', 'usuario']

const CLAVE_ROLES_ACTIVOS = 'rolesActivos'

function mapearNombreRol(nombre: string): Role | null {
  if (nombre === NOMBRES_ROL_REAL.administrador) return 'administrador'
  if (nombre === NOMBRES_ROL_REAL.par_evaluador) return 'par_evaluador'
  if (nombre === NOMBRES_ROL_REAL.comite_etica) return 'comite_etica'
  if (nombre === NOMBRES_ROL_REAL.usuario) return 'usuario'
  return null
}

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

/** Roles reales (nombres del backend) que tiene la cuenta que inició sesión. */
export function getRolesDeCuenta(): string[] {
  return leerUsuarioGuardado()?.roles ?? []
}

/** Guarda los roles que la persona eligió para esta sesión (cuando su
 * cuenta tiene más de uno, o es administrador y puede elegir cualquiera).
 * Se guarda en el mismo storage que ya esté usando la sesión (localStorage
 * si "recordarme", sessionStorage si no). */
export function setRolesActivos(nombresRoles: string[]): void {
  const storage = localStorage.getItem('usuario') ? localStorage : sessionStorage
  storage.setItem(CLAVE_ROLES_ACTIVOS, JSON.stringify(nombresRoles))
}

export function limpiarRolActivo(): void {
  localStorage.removeItem(CLAVE_ROLES_ACTIVOS)
  sessionStorage.removeItem(CLAVE_ROLES_ACTIVOS)
}

function leerRolesActivosGuardados(): string[] {
  const raw = localStorage.getItem(CLAVE_ROLES_ACTIVOS) ?? sessionStorage.getItem(CLAVE_ROLES_ACTIVOS)
  if (!raw) return []
  try {
    const valores = JSON.parse(raw) as unknown
    return Array.isArray(valores) ? valores.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Los roles con los que la persona realmente puede operar en esta sesión:
 * los que eligió en /elegir-rol si eligió algo, o si no, los que tiene su
 * cuenta de forma automática (sin pantalla de elección de por medio). */
export function getRolesEfectivos(): Role[] {
  const usuario = leerUsuarioGuardado()
  if (!usuario) return ['usuario']

  const elegidos = leerRolesActivosGuardados()
  if (elegidos.length > 0) {
    const mapeados = elegidos.map(mapearNombreRol).filter((r): r is Role => r !== null)
    if (mapeados.length > 0) return [...new Set(mapeados)]
  }

  const automaticos = (Object.entries(NOMBRES_ROL_REAL) as [Role, string][])
    .filter(([, nombre]) => usuario.roles.includes(nombre))
    .map(([rol]) => rol)

  return automaticos.length > 0 ? automaticos : ['usuario']
}

/** El rol "principal" para decisiones que solo admiten uno a la vez (ej.
 * qué variante de Dashboard mostrar) — el de mayor prioridad entre los
 * roles activos de la sesión. */
export function getRole(): Role {
  const activos = getRolesEfectivos()
  return PRIORIDAD_ROL.find((r) => activos.includes(r)) ?? 'usuario'
}
