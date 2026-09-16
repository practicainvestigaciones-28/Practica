export interface RolPermisos {
  editar: boolean
  ver: boolean
}

export interface Rol {
  id: number
  nombre: string
  permisos: RolPermisos
  activo: boolean
}

// v2: los nombres de los roles semilla se corrigieron para calzar
// exactamente con los roles reales del backend — se cambia la clave para
// no arrastrar nombres viejos (que ya no matchean) desde localStorage.
const STORAGE_KEY = 'sgpvie_roles_v2'

// Los nombres deben coincidir exactamente con los roles reales del backend
// (ver NOMBRES_ROL_REAL en modules/auth/lib/auth.ts) — de este catálogo
// salen las opciones para asignar roles a un usuario y para elegir rol al
// iniciar sesión, así que un nombre distinto rompe esa conexión.
const rolesSemilla: Rol[] = [
  { id: 1, nombre: 'Administrador', permisos: { editar: true, ver: true }, activo: true },
  { id: 2, nombre: 'Comité de Ética', permisos: { editar: true, ver: true }, activo: true },
  { id: 3, nombre: 'Par Evaluador', permisos: { editar: true, ver: true }, activo: true },
  { id: 4, nombre: 'Investigador', permisos: { editar: true, ver: true }, activo: true },
]

function cargarInicial(): Rol[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Rol[]
  } catch {

  }
  return rolesSemilla
}

function guardar(lista: Rol[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

  }
}

let roles: Rol[] = cargarInicial()

export function getRoles(): Rol[] {
  return roles
}

export function addRol(nombre: string, permisos: RolPermisos): void {
  roles = [...roles, { id: Date.now(), nombre, permisos, activo: false }]
  guardar(roles)
}

export function editarRol(id: number, nombre: string, permisos: RolPermisos): void {
  roles = roles.map((r) => (r.id === id ? { ...r, nombre, permisos } : r))
  guardar(roles)
}

export function eliminarRol(id: number): void {
  roles = roles.filter((r) => r.id !== id)
  guardar(roles)
}

export function toggleRolActivo(id: number): void {
  roles = roles.map((r) => (r.id === id ? { ...r, activo: !r.activo } : r))
  guardar(roles)
}

export function togglePermiso(id: number, tipo: keyof RolPermisos): void {
  roles = roles.map((r) =>
    r.id === id ? { ...r, permisos: { ...r.permisos, [tipo]: !r.permisos[tipo] } } : r
  )
  guardar(roles)
}