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

export interface BienvenidasPendientes {
  pendientes: number
  /** El servidor tiene habilitado el envío (RUAH_ENVIAR_CORREOS). */
  correos_activos: boolean
  en_curso: boolean
}

/** GET /ruah/bienvenidas-pendientes — cuántas cuentas recibirían hoy el correo de bienvenida. */
export function bienvenidasPendientes(): Promise<BienvenidasPendientes> {
  return apiFetch<BienvenidasPendientes>('/ruah/bienvenidas-pendientes')
}

/** POST /ruah/enviar-bienvenidas — se envían en segundo plano; devuelve cuántos quedaron programados. */
export function enviarBienvenidas(): Promise<{ mensaje: string; programados: number }> {
  return apiFetch<{ mensaje: string; programados: number }>('/ruah/enviar-bienvenidas', { method: 'POST' })
}

/** POST /ruah/sincronizar-estudiantes */
export function sincronizarEstudiantes(): Promise<RespuestaSincronizacion<ResumenEstudiantes>> {
  return apiFetch<RespuestaSincronizacion<ResumenEstudiantes>>('/ruah/sincronizar-estudiantes', { method: 'POST' })
}
