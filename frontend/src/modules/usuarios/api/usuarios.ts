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

/** Todos los usuarios con rol del sistema: el backend entrega máximo 100 por página, así que se piden todas las páginas. */
export async function listarTodosLosUsuarios(): Promise<UsuarioListado[]> {
  const primera = await listarUsuarios({ page: 1, limit: 100 })
  const resto = await Promise.all(
    Array.from({ length: Math.max(0, primera.meta.totalPages - 1) }, (_, i) => listarUsuarios({ page: i + 2, limit: 100 }))
  )
  return [primera, ...resto].flatMap((r) => r.data)
}

export interface HojaVidaUsuario {
  /** Correo institucional y personal de quien firma: el personal recibe los enlaces de firma y el código de verificación. */
  correo_institucional: string | null
  correo_personal: string | null
  lugar_nacimiento: string | null
  fecha_nacimiento: string | null
  nacionalidad: string | null
  tipo_documento: string | null
  numero_documento: string | null
  direccion: string | null
  telefono: string | null
  celular: string | null
  orcid: string | null
  google_academico: string | null
  categoria_minciencias: string | null
  cargo_actual: string | null
  cargos_desempenados: string | null
  titulos_academicos: string | null
  produccion_cientifica: string | null
  usuario: { nombre: string; apellido: string; correo: string; cedula: string | null }
}

export function obtenerHojaVida(id_usuario: number): Promise<HojaVidaUsuario> {
  return apiFetch(`/usuarios/${id_usuario}/hoja-vida`)
}

export function guardarHojaVida(id_usuario: number, datos: Record<string, string | null | undefined>): Promise<unknown> {
  return apiFetch(`/usuarios/${id_usuario}/hoja-vida`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}
