import { apiFetch } from './client'

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

/** Catálogo de estados posibles de una evaluación/etapa (para labels/colores). */
export function listarEstados(): Promise<EstadoCatalogo[]> {
  return apiFetch('/evaluaciones/estados')
}

/** Qué etapa sigue a cuál (para saber a dónde avanza un proyecto aprobado). */
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
  proyecto: { id_proyecto: number; titulo: string; estado_actual: string }
  etapa: Etapa
  estado: EstadoCatalogo
  asignadoA: { id_usuario: number; nombre: string; apellido: string } | null
}

/** Bandeja de trabajo: qué proyectos están pendientes de revisión, por etapa/evaluador (solo Administrador). */
export function listarAsignaciones(filtros: {
  id_etapa?: number
  asignado_a?: number
  pendientes?: boolean
} = {}): Promise<AsignacionRevision[]> {
  const params = new URLSearchParams()
  if (filtros.id_etapa) params.set('id_etapa', String(filtros.id_etapa))
  if (filtros.asignado_a) params.set('asignado_a', String(filtros.asignado_a))
  if (filtros.pendientes) params.set('pendientes', 'true')

  const qs = params.toString()
  return apiFetch(`/evaluaciones/asignaciones${qs ? `?${qs}` : ''}`)
}

interface RespuestaAsignacion {
  mensaje: string
  asignacion: AsignacionRevision
}

/** RQF44 - Acepta el proyecto y lo asigna a una etapa (Comité de Investigación, Ética, Pares). Solo Administrador. */
export function asignarProyectoAEtapa(
  id_proyecto: number,
  datos: { id_etapa: number; asignado_a?: number; fecha_limite?: string }
): Promise<RespuestaAsignacion> {
  return apiFetch(`/proyectos/${id_proyecto}/asignaciones`, {
    method: 'POST',
    body: JSON.stringify(datos),
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

/** RQF45/49/57 - Registra el resultado de la evaluación de una etapa. Si aprueba, el backend
 * ya envía solo a la siguiente etapa — no hace falta otra llamada para eso. Solo Administrador. */
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

/** RQF47 - Valida si las correcciones que reenvió el investigador subsanan lo solicitado. Solo Administrador. */
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

export interface EstadoConsolidado {
  proyecto: { id_proyecto: number; titulo: string; estado_actual: string; fecha_registro: string }
  etapa_actual: Etapa | null
  estado_actual: EstadoCatalogo | null
  /** true = el comité ya se pronunció y ahora le toca al investigador corregir */
  espera_correcciones: boolean
  /** true = hay una revisión abierta esperando el pronunciamiento del comité */
  en_revision: boolean
  asignacion_abierta: AsignacionRevision | null
  siguiente_etapa: Etapa | null
  etapas_evaluadas: {
    etapa: Etapa
    resultado: EstadoCatalogo
    comentarios: string | null
    evaluado_por: { id_usuario: number; nombre: string; apellido: string }
    fecha_evaluacion: string
  }[]
}

/** RQF61 - Dónde está parado el proyecto en el flujo, ya masticado (sin calcular nada en el front). */
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

/** RQF59 - Línea de tiempo completa del proyecto. */
export function obtenerHistorialProyecto(id_proyecto: number): Promise<HistorialItem[]> {
  return apiFetch(`/proyectos/${id_proyecto}/historial`)
}
