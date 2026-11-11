import { apiFetch } from '../../../shared/api/client'

export interface ResumenDocentes {
  total_en_ruah: number
  creados: number
  actualizados: number
  sin_cambios: number
  omitidos_sin_correo: number
  omitidos_sin_cedula: number
  omitidos_inactivos: number
  conflictos: { cedula: string; nombre: string; motivo: string }[]
  programas_creados: string[]
  programas_sin_ubicar: string[]
  correos_bienvenida: 'enviando' | 'desactivados'
  correos_programados: number
}

export interface ResumenEstudiantes {
  total_en_ruah: number
  creados: number
  actualizados: number
  sin_cambios: number
  matriculados: number
  no_matriculados: number
  sin_programa: number
  programas_creados: string[]
  programas_sin_ubicar: string[]
}

export interface EstudianteRuah {
  codigo: string
  nombres: string
  apellidos: string
  correo_institucional: string | null
  programa: string | null
  matriculado: boolean
}

/** GET /ruah/estudiantes/:codigo — 404 (ApiError) si el código no está en el catálogo de Ruah. */
export function buscarEstudiante(codigo: string): Promise<EstudianteRuah> {
  return apiFetch<EstudianteRuah>(`/ruah/estudiantes/${encodeURIComponent(codigo.trim())}`)
}

interface RespuestaSincronizacion<T> {
  mensaje: string
  resumen: T
}

/** POST /ruah/sincronizar-docentes */
export function sincronizarDocentes(): Promise<RespuestaSincronizacion<ResumenDocentes>> {
  return apiFetch<RespuestaSincronizacion<ResumenDocentes>>('/ruah/sincronizar-docentes', { method: 'POST' })
}

/** POST /ruah/sincronizar-estudiantes */
export function sincronizarEstudiantes(): Promise<RespuestaSincronizacion<ResumenEstudiantes>> {
  return apiFetch<RespuestaSincronizacion<ResumenEstudiantes>>('/ruah/sincronizar-estudiantes', { method: 'POST' })
}
