import { apiFetch, type RespuestaPaginada } from './client'

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
