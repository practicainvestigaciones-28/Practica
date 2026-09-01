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

const STORAGE_KEY = 'sgpvie_roles'

const rolesSemilla: Rol[] = [
  { id: 1, nombre: 'Administrador', permisos: { editar: true, ver: true }, activo: true },
  { id: 2, nombre: 'Comité de investigación', permisos: { editar: true, ver: true }, activo: false },
  { id: 3, nombre: 'Comité de ética', permisos: { editar: true, ver: true }, activo: true },
  { id: 4, nombre: 'Investigador', permisos: { editar: true, ver: true }, activo: false },
  { id: 5, nombre: 'Par calificador', permisos: { editar: true, ver: true }, activo: false },
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