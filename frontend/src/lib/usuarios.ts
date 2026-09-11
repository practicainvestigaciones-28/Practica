import { apiFetch, type RespuestaPaginada } from '../api/client'

export interface UsuarioBuscado {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  cedula: string | null
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
  /** Nombre del rol (ej. "Administrador", "Investigador") */
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
  /** Si viene, reemplaza la contraseña actual */
  contraseña?: string
  /** Si viene, reemplaza el rol actual del usuario por este */
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

/** RQF05 — activa o desactiva la cuenta. No existe endpoint de eliminar a propósito. */
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

// RQF08 — multirol. Todavía no hay pantalla que use esto (el formulario de
// creación de usuarios sigue usando un solo rol, sin cambios); queda listo
// para cuando se construya la pantalla de asignación de varios roles por
// usuario.
export function obtenerRolesUsuario(id_usuario: number): Promise<{ roles: string[] }> {
  return apiFetch(`/usuarios/${id_usuario}/roles`)
}

export function actualizarRolesUsuario(id_usuario: number, roles: string[]): Promise<{ mensaje: string }> {
  return apiFetch(`/usuarios/${id_usuario}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roles }),
  })
}