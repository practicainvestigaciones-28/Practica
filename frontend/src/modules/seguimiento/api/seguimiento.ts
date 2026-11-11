import { apiFetch } from '../../../shared/api/client'
import type {
  CierreProyecto,
  DetalleAvance,
  EstadoNovedad,
  InformeFinal,
  ProductoComprometido,
  ProyectoSeguimiento,
  TipoArticulacion,
  TipoNovedad,
} from './tipos'

// Capa de acceso a datos de la etapa de seguimiento (M-02 a M-08): todo pasa por el backend (/api/seguimiento). Cada función
// indica la ruta HTTP que usa; las reglas de turno, código de firma y roles las valida el servidor.

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

/** GET /seguimiento/proyectos — proyectos con acta de inicio legalizada (ya resuelto por el backend: visibilidad por rol, datos ensamblados). */
export function listarProyectosSeguimiento(): Promise<ProyectoSeguimiento[]> {
  return apiFetch('/seguimiento/proyectos')
}

/** GET /seguimiento/proyectos/:id */
export function obtenerProyectoSeguimiento(id_proyecto: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}`)
}

// ---------------------------------------------------------------------------
// Parametrización (catálogos del Administrador)
// ---------------------------------------------------------------------------

/** GET /seguimiento/tipos-novedad */
export const listarTiposNovedad = (): Promise<TipoNovedad[]> => apiFetch('/seguimiento/tipos-novedad')
/** POST|PUT /seguimiento/tipos-novedad */
export const guardarTipoNovedad = (t: TipoNovedad): Promise<TipoNovedad[]> =>
  apiFetch('/seguimiento/tipos-novedad', { method: t.id ? 'PUT' : 'POST', body: JSON.stringify(t) })
/** DELETE /seguimiento/tipos-novedad/:id */
export const eliminarTipoNovedad = (id: number): Promise<TipoNovedad[]> =>
  apiFetch(`/seguimiento/tipos-novedad/${id}`, { method: 'DELETE' })

/** GET /seguimiento/tipos-articulacion */
export const listarTiposArticulacion = (): Promise<TipoArticulacion[]> => apiFetch('/seguimiento/tipos-articulacion')
/** POST|PUT /seguimiento/tipos-articulacion */
export const guardarTipoArticulacion = (t: TipoArticulacion): Promise<TipoArticulacion[]> =>
  apiFetch('/seguimiento/tipos-articulacion', { method: t.id ? 'PUT' : 'POST', body: JSON.stringify(t) })
/** DELETE /seguimiento/tipos-articulacion/:id */
export const eliminarTipoArticulacion = (id: number): Promise<TipoArticulacion[]> =>
  apiFetch(`/seguimiento/tipos-articulacion/${id}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// M-03 Informes de avance
// ---------------------------------------------------------------------------

/** POST /seguimiento/proyectos/:id/periodos/regenerar */
export function regenerarPeriodos(id_proyecto: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/regenerar`, { method: 'POST' })
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero/fechas — el Administrador ajusta la apertura y el límite de un periodo
 * (o, con `restablecer`, lo devuelve a las fechas que salen del acta de inicio). */
export function ajustarFechasPeriodo(
  id_proyecto: number,
  numero: number,
  cambios: { apertura: string; limite: string } | { restablecer: true }
): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/fechas`, { method: 'PUT', body: JSON.stringify(cambios) })
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/solicitud — el Administrador solicita el informe de avance del periodo
 * al investigador: queda habilitado y al investigador le llega una notificación y un correo. Se solicita en orden: el periodo
 * anterior debe estar aprobado. */
export function solicitarAvance(id_proyecto: number, numero: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/solicitud`, { method: 'POST' })
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero — guarda el borrador. */
export function guardarAvance(id_proyecto: number, numero: number, detalle: DetalleAvance[]): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}`, { method: 'PUT', body: JSON.stringify({ detalle }) })
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/firmas/:indice — firman, en orden, el investigador principal y el
 * co-investigador (formato INV-IC-FR-018), cada uno con el código de su correo personal. La firma queda con su ID de transacción
 * y el hash de lo firmado. */
export function firmarAvance(id_proyecto: number, numero: number, indice: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/firmas/${indice}`, { method: 'POST' })
}

/** DELETE /seguimiento/proyectos/:id/periodos/:numero/firmas — borra las firmas para volver a editar. */
export function reabrirAvance(id_proyecto: number, numero: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/firmas`, { method: 'DELETE' })
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/radicar */
export function radicarAvance(id_proyecto: number, numero: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/radicar`, { method: 'POST' })
}

/** PATCH /seguimiento/proyectos/:id/periodos/:numero/revision — quien revisa es la cuenta de la sesión. */
export function revisarAvance(id_proyecto: number, numero: number, decision: 'Aprobado' | 'Devuelto', observacion: string, _revisor = ''): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/revision`, { method: 'PATCH', body: JSON.stringify({ decision, observacion }) })
}

// ---------------------------------------------------------------------------
// M-05 Novedades
// ---------------------------------------------------------------------------

export interface DatosNovedad {
  id_tipo: number
  justificacion: string
  soporte: string
  meses_prorroga: number
  participante_saliente: string
  participante_entrante: string
  acto_administrativo: string
}

/** POST /seguimiento/proyectos/:id/novedades */
export function registrarNovedad(id_proyecto: number, datos: DatosNovedad): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/novedades`, { method: 'POST', body: JSON.stringify(datos) })
}

/** PATCH /seguimiento/proyectos/:id/novedades/:idNovedad — la VIE decide.
 * Una prórroga aprobada amplía la duración y reprograma los periodos pendientes. */
export function decidirNovedad(id_proyecto: number, id_novedad: number, estado: Exclude<EstadoNovedad, 'Pendiente'>, observacion: string): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/novedades/${id_novedad}`, { method: 'PATCH', body: JSON.stringify({ decision: estado, observacion }) })
}

// ---------------------------------------------------------------------------
// M-06 Informe técnico final
// ---------------------------------------------------------------------------

export type CambiosInformeFinal = Partial<
  Pick<InformeFinal, 'info' | 'resumen' | 'objetivos' | 'observaciones_objetivos' | 'equipos' | 'materiales' | 'actividades_apoyos' | 'evidencias_apoyos'>
> & {
  productos?: ProductoComprometido[]
}

/** POST /seguimiento/proyectos/:id/informe-final/solicitud — el Administrador solicita el informe técnico final al investigador
 * (con todos los avances aprobados): queda habilitado y al investigador le llega una notificación y un correo. */
export function solicitarInformeFinal(id_proyecto: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/informe-final/solicitud`, { method: 'POST' })
}

/** PUT /seguimiento/proyectos/:id/informe-final */
export function guardarInformeFinal(id_proyecto: number, cambios: CambiosInformeFinal): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/informe-final`, { method: 'PUT', body: JSON.stringify(cambios) })
}

/** POST /seguimiento/proyectos/:id/informe-final/firmas/:indice — queda con su ID de transacción y el hash de lo firmado. */
export function firmarInformeFinal(id_proyecto: number, indice: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/informe-final/firmas/${indice}`, { method: 'POST' })
}

/** POST /seguimiento/proyectos/:id/informe-final/radicar */
export function radicarInformeFinal(id_proyecto: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/informe-final/radicar`, { method: 'POST' })
}

/** PATCH /seguimiento/proyectos/:id/informe-final/revision — una devolución borra las firmas. Quien revisa es la cuenta de la sesión. */
export function revisarInformeFinal(id_proyecto: number, decision: 'Aprobado' | 'Devuelto', observacion: string, _revisor = ''): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/informe-final/revision`, { method: 'PATCH', body: JSON.stringify({ decision, observacion }) })
}

// ---------------------------------------------------------------------------
// M-07 Cierre y paz y salvo
// ---------------------------------------------------------------------------

export type CambiosCierre = Partial<Omit<CierreProyecto, 'firmas' | 'finalizado'>>

/** PUT /seguimiento/proyectos/:id/cierre */
export function guardarCierre(id_proyecto: number, cambios: CambiosCierre): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/cierre`, { method: 'PUT', body: JSON.stringify(cambios) })
}

/** POST /seguimiento/proyectos/:id/cierre/firmas/:indice — queda con su ID de transacción y el hash de lo firmado. */
export function firmarCierre(id_proyecto: number, indice: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/cierre/firmas/${indice}`, { method: 'POST' })
}

/** POST /seguimiento/proyectos/:id/cierre/finalizar */
export function finalizarProyecto(id_proyecto: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/cierre/finalizar`, { method: 'POST' })
}
