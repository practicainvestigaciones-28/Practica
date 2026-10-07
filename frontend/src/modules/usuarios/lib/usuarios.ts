import { apiFetch, type RespuestaPaginada } from '../../../shared/api/client'

export interface UsuarioBuscado {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  cedula: string | null
  roles: string[]
}

export function buscarUsuarios(q: string): Promise<UsuarioBuscado[]> {
  return apiFetch(`/usuarios/buscar?q=${encodeURIComponent(q)}`)
}

export interface UsuarioListado {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  codigo: string | null
  cedula: string | null
  roles: string[]
  totalProyectos: number
  activo: boolean
}

export function listarUsuarios(
  filtros: { page?: number; limit?: number } = {}
): Promise<RespuestaPaginada<UsuarioListado>> {
  const params = new URLSearchParams()
  if (filtros.page) params.set('page', String(filtros.page))
  if (filtros.limit) params.set('limit', String(filtros.limit))

  const qs = params.toString()
  return apiFetch(`/usuarios${qs ? `?${qs}` : ''}`)
}

interface RespuestaUsuario {
  mensaje: string
  usuario: UsuarioListado
}

export interface DatosCrearUsuario {
  nombre: string
  apellido: string
  correo: string
  contraseña: string

  rol: string
  codigo?: string
  cedula?: string
}

export async function crearUsuario(datos: DatosCrearUsuario): Promise<UsuarioListado> {
  const respuesta = await apiFetch<RespuestaUsuario>('/usuarios', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
  return respuesta.usuario
}

export interface DatosActualizarUsuario {
  nombre?: string
  apellido?: string
  correo?: string
  codigo?: string
  cedula?: string

  contraseña?: string

  rol?: string
}

export async function actualizarUsuario(
  id_usuario: number,
  cambios: DatosActualizarUsuario
): Promise<UsuarioListado> {
  const respuesta = await apiFetch<RespuestaUsuario>(`/usuarios/${id_usuario}`, {
    method: 'PUT',
    body: JSON.stringify(cambios),
  })
  return respuesta.usuario
}

export async function cambiarEstadoUsuario(id_usuario: number, activo: boolean): Promise<UsuarioListado> {
  const respuesta = await apiFetch<RespuestaUsuario>(`/usuarios/${id_usuario}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
  return respuesta.usuario
}

export interface HojaVidaUsuario {
  lugar_nacimiento: string | null
  fecha_nacimiento: string | null
  nacionalidad: string | null
  tipo_documento: string | null
  numero_documento: string | null
  direccion: string | null
  telefono: string | null
  celular: string | null
  cargo_actual: string | null
  cargos_desempenados: string | null
  titulos_academicos: string | null
  produccion_cientifica: string | null
  usuario: { nombre: string; apellido: string; correo: string; cedula: string | null }
}

export function obtenerHojaVida(id_usuario: number): Promise<HojaVidaUsuario> {
  return apiFetch(`/usuarios/${id_usuario}/hoja-vida`)
}

export function guardarHojaVida(id_usuario: number, datos: Record<string, string | undefined>): Promise<unknown> {
  return apiFetch(`/usuarios/${id_usuario}/hoja-vida`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}

export function obtenerRolesUsuario(id_usuario: number): Promise<RolSistema[]> {
  return apiFetch(`/usuarios/${id_usuario}/roles`)
}

// PUT /usuarios/:id/roles exige ids reales del catálogo de roles del
// backend (tabla Rol), no los nombres — ver RolSistema/listarRolesSistema.
export function actualizarRolesUsuario(id_usuario: number, idsRoles: number[]): Promise<{ mensaje: string }> {
  return apiFetch(`/usuarios/${id_usuario}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roles: idsRoles }),
  })
}

/** Catálogo real de roles del sistema (tabla Rol) — distinto del catálogo local de "permisos" en lib/roles.ts. */
export interface RolSistema {
  id_rol: number
  nombre: string
  descripcion: string | null
  estado: boolean
}

export function listarRolesSistema(): Promise<RolSistema[]> {
  return apiFetch('/roles')
}

export function crearRolSistema(nombre: string, descripcion?: string): Promise<{ mensaje: string; rol: RolSistema }> {
  return apiFetch('/roles', { method: 'POST', body: JSON.stringify({ nombre, descripcion }) })
}

export function actualizarRolSistema(
  id_rol: number,
  cambios: { nombre?: string; descripcion?: string }
): Promise<{ mensaje: string; rol: RolSistema }> {
  return apiFetch(`/roles/${id_rol}`, { method: 'PUT', body: JSON.stringify(cambios) })
}

export function cambiarEstadoRolSistema(id_rol: number, estado: boolean): Promise<{ mensaje: string; rol: RolSistema }> {
  return apiFetch(`/roles/${id_rol}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) })
}

export interface PermisoSistema {
  id_permiso: number
  nombre: string
  descripcion: string | null
}

/** Catálogo de permisos del sistema (crear/editar/ver/eliminar/exportar). */
export function listarPermisosSistema(): Promise<PermisoSistema[]> {
  return apiFetch('/permisos')
}

/** Permisos actualmente asignados a un rol. */
export function listarPermisosDeRol(id_rol: number): Promise<PermisoSistema[]> {
  return apiFetch(`/roles/${id_rol}/permisos`)
}

/** Reemplaza el conjunto completo de permisos de un rol (un arreglo vacío lo deja sin ninguno). */
export function asignarPermisosRol(id_rol: number, idsPermisos: number[]): Promise<{ mensaje: string; permisos: PermisoSistema[] }> {
  return apiFetch(`/roles/${id_rol}/permisos`, { method: 'PUT', body: JSON.stringify({ permisos: idsPermisos }) })
}