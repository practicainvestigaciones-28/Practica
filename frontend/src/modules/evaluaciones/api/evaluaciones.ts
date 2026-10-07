import { apiFetch } from '../../../shared/api/client'

export interface Etapa {
  id_etapa: number
  nombre: string
  descripcion: string | null
}

export interface EstadoCatalogo {
  id_estado: number
  nombre: string
  descripcion: string | null
}

export function listarEstados(): Promise<EstadoCatalogo[]> {
  return apiFetch('/evaluaciones/estados')
}

export function listarTransicionesEtapa(): Promise<
  { id_transicion: number; etapaOrigen: Etapa; etapaDestino: Etapa }[]
> {
  return apiFetch('/evaluaciones/transiciones-etapa')
}

export interface AsignacionRevision {
  id_asignacion: number
  id_proyecto: number
  id_etapa: number
  fecha_asignacion: string
  fecha_limite: string | null
  fecha_finalizacion: string | null
  proyecto: {
    id_proyecto: number
    titulo: string
    estado_actual: string
    creador: { id_usuario: number; nombre: string; apellido: string }
    convocatoria: { id_convocatoria: number; nombre: string } | null
  }
  etapa: Etapa
  estado: EstadoCatalogo
  asignadoA: { id_usuario: number; nombre: string; apellido: string } | null
}

export function listarAsignaciones(filtros: {
  id_etapa?: number
  asignado_a?: number
  pendientes?: boolean
  /** true = la bandeja propia del usuario logueado (no requiere ser Administrador). */
  mias?: boolean
} = {}): Promise<AsignacionRevision[]> {
  const params = new URLSearchParams()
  if (filtros.id_etapa) params.set('id_etapa', String(filtros.id_etapa))
  if (filtros.asignado_a) params.set('asignado_a', String(filtros.asignado_a))
  if (filtros.pendientes) params.set('pendientes', 'true')
  if (filtros.mias) params.set('mias', 'true')

  const qs = params.toString()
  return apiFetch(`/evaluaciones/asignaciones${qs ? `?${qs}` : ''}`)
}

interface RespuestaAsignacion {
  mensaje: string
  asignacion: AsignacionRevision
}

export function asignarProyectoAEtapa(
  id_proyecto: number,
  datos: { id_etapa: number; asignado_a?: number; fecha_limite?: string }
): Promise<RespuestaAsignacion> {
  return apiFetch(`/proyectos/${id_proyecto}/asignaciones`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

interface RespuestaAsignacionMultiple {
  mensaje: string
  asignaciones: AsignacionRevision[]
}

/**
 * Fija el conjunto de responsables de la asignación que el admin ya envió a
 * la etapa (sin integrante aún, o para reemplazar a quien ya estuviera). La
 * mayoría de etapas admiten un solo evaluador, pero Pares admite 2 — se
 * manda la lista completa que debe quedar asignada, no solo el que se agrega.
 */
export function asignarResponsable(
  id_proyecto: number,
  id_etapa: number,
  asignados_a: number[]
): Promise<RespuestaAsignacionMultiple> {
  return apiFetch(`/proyectos/${id_proyecto}/etapas/${id_etapa}/responsable`, {
    method: 'PATCH',
    body: JSON.stringify({ asignados_a }),
  })
}

/** Rechaza un proyecto en revisión inicial (antes de enviarlo a cualquier comité). */
export function rechazarProyectoInicial(id_proyecto: number, motivo?: string): Promise<{ mensaje: string }> {
  return apiFetch(`/proyectos/${id_proyecto}/rechazar-inicial`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  })
}

export type ResultadoEvaluacion = 'aprobado' | 'aprobado_con_correcciones' | 'rechazado' | 'no_cumple'

export interface EvaluacionEtapa {
  id_evaluacion: number
  id_proyecto: number
  id_etapa: number
  comentarios: string | null
  puntaje: number | null
  fecha_evaluacion: string
  etapa: Etapa
  estado: EstadoCatalogo
}

interface RespuestaEvaluacion {
  mensaje: string
  evaluacion: EvaluacionEtapa
}

export function registrarEvaluacion(
  id_proyecto: number,
  id_etapa: number,
  datos: { resultado: ResultadoEvaluacion; comentarios?: string; puntaje?: number; formato_evaluacion?: string }
): Promise<RespuestaEvaluacion> {
  return apiFetch(`/proyectos/${id_proyecto}/etapas/${id_etapa}/evaluacion`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function validarCorrecciones(
  id_proyecto: number,
  id_etapa: number,
  datos: { aprobadas: boolean; comentarios?: string }
): Promise<RespuestaEvaluacion> {
  return apiFetch(`/proyectos/${id_proyecto}/etapas/${id_etapa}/correcciones`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

interface RespuestaReenvioCorrecciones {
  mensaje: string
  asignaciones: AsignacionRevision[]
}

/** El investigador reenvía el proyecto ya corregido (estado "aprobado_con_correcciones"). */
export function reenviarCorrecciones(id_proyecto: number, id_etapa: number): Promise<RespuestaReenvioCorrecciones> {
  return apiFetch(`/proyectos/${id_proyecto}/etapas/${id_etapa}/reenvio`, {
    method: 'POST',
  })
}

export interface EstadoConsolidado {
  proyecto: { id_proyecto: number; titulo: string; estado_actual: string; fecha_registro: string }
  etapa_actual: Etapa | null
  estado_actual: EstadoCatalogo | null

  espera_correcciones: boolean

  en_revision: boolean
  asignacion_abierta: AsignacionRevision | null
  siguiente_etapa: Etapa | null
  etapas_evaluadas: {
    etapa: Etapa
    resultado: EstadoCatalogo
    comentarios: string | null
    evaluado_por: { id_usuario: number; nombre: string; apellido: string }
    fecha_evaluacion: string
    /** Solo tiene valor cuando resultado = "aprobado_con_correcciones". */
    fecha_limite_correccion: string | null
  }[]
}

export function obtenerEstadoConsolidado(id_proyecto: number): Promise<EstadoConsolidado> {
  return apiFetch(`/proyectos/${id_proyecto}/estado-consolidado`)
}

export interface HistorialItem {
  id_historial: number
  id_etapa: number
  observacion: string | null
  fecha_cambio: string
  etapa: Etapa
  estado: EstadoCatalogo
  cambiadoPor: { id_usuario: number; nombre: string; apellido: string }
}

export function obtenerHistorialProyecto(id_proyecto: number): Promise<HistorialItem[]> {
  return apiFetch(`/proyectos/${id_proyecto}/historial`)
}

// ---------------------------------------------------------------------------
// RQF52/53 - Calificaciones de Pares: el promedio ya no se aplica solo en
// cuanto ambos evaluadores terminan. El Administrador revisa las
// calificaciones individuales y confirma con "Enviar resultado".
// ---------------------------------------------------------------------------

export interface ProyectoConCalificacionPendiente {
  id_proyecto: number
  titulo: string
  fecha_registro: string
  creador: { id_usuario: number; nombre: string; apellido: string }
}

/** Bandeja del Administrador: proyectos con calificación de Pares lista para revisar. */
export function listarProyectosConCalificacionPendiente(): Promise<ProyectoConCalificacionPendiente[]> {
  return apiFetch('/evaluaciones/pares-pendientes')
}

export interface CalificacionPar {
  evaluador: { id_usuario: number; nombre: string; apellido: string }
  puntaje: number | null
  comentarios: string | null
  fecha_evaluacion: string
}

export interface CalificacionesParesPendientes {
  proyecto: { id_proyecto: number; titulo: string }
  calificaciones: CalificacionPar[]
  promedio: number | null
  resultado_sugerido: ResultadoEvaluacion | null
}

/** Vista previa (sin aplicar nada): qué calificó cada par y el resultado que se aplicaría. */
export function obtenerCalificacionesParesPendientes(id_proyecto: number, id_etapa: number): Promise<CalificacionesParesPendientes> {
  return apiFetch(`/proyectos/${id_proyecto}/etapas/${id_etapa}/calificaciones-pares`)
}

interface RespuestaEnvioResultadoPares {
  mensaje: string
  promedio: number
  resultado: ResultadoEvaluacion
}

/** Aplica el promedio, actualiza el estado del proyecto y notifica al investigador. */
export function enviarResultadoPares(id_proyecto: number, id_etapa: number): Promise<RespuestaEnvioResultadoPares> {
  return apiFetch(`/proyectos/${id_proyecto}/etapas/${id_etapa}/calificaciones-pares/enviar`, {
    method: 'POST',
  })
}
