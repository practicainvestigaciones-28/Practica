import { apiFetch, ApiError } from '../../../shared/api/client'
import { getNombreUsuarioActual } from '../../auth/lib/auth'
import { modificarAlmacen, type EstadoAlmacen } from '../lib/almacen'
import { hoyISO } from '../lib/formato'
import {
  anteriorAprobado,
  detalleDesde,
  estadoPorPorcentaje,
  faltantesCierre,
  camposFaltantes,
  MENSAJE_EVIDENCIA_MINIMA,
  faltanEvidencias,
  generarPeriodos,
  informeListoParaFirmar,
  firmasInforme,
  siguienteFirma,
  informeFinalBloqueadoPorAvances,
  informeFinalSinHabilitar,
  mensajeSinHabilitarInformeFinal,
  mensajeBloqueoInformeFinal,
  mensajeBloqueoPeriodo,
  periodoAbierto,
  periodoBloqueadoPorOrden,
  periodoEditable,
  periodoHabilitado,
  proyectoBloqueado,
  puedeCerrar,
} from '../lib/reglas'
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

// Capa de acceso a datos de la etapa de seguimiento (M-02 a M-08).
// Mientras el backend no exponga /api/seguimiento opera sobre un almacenamiento
// local provisional (lib/almacen.ts), que guarda solo en este navegador. Cada
// función indica la ruta HTTP equivalente; al existir en el backend, basta con
// reemplazar el cuerpo por apiFetch(...) sin tocar las pantallas.

const respuesta = <T>(valor: T) => Promise.resolve(valor)

function buscarProyecto(s: EstadoAlmacen, id_proyecto: number): ProyectoSeguimiento {
  const p = s.proyectos.find((x) => x.id_proyecto === id_proyecto)
  if (!p) throw new ApiError(404, 'El proyecto no está en etapa de seguimiento.')
  return p
}

/** Modifica un proyecto rechazando cualquier cambio si ya está finalizado o cancelado. */
function modificarProyecto(id_proyecto: number, cambio: (p: ProyectoSeguimiento, s: EstadoAlmacen) => void) {
  try {
    const s = modificarAlmacen((estado) => {
      const p = buscarProyecto(estado, id_proyecto)
      if (proyectoBloqueado(p)) throw new ApiError(409, 'El proyecto está finalizado o cancelado y no admite cambios.')
      cambio(p, estado)
    })
    return respuesta(buscarProyecto(s, id_proyecto))
  } catch (err) {
    return Promise.reject(err)
  }
}

const exigir = (condicion: unknown, mensaje: string, faltantes?: string[]) => {
  if (!condicion) throw new ApiError(422, mensaje, faltantes)
}

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

/** POST /seguimiento/proyectos/:id/periodos/:numero/solicitud — el investigador solicita el informe de avance del
 * periodo para empezar a diligenciarlo. Se habilita en orden: el periodo anterior debe estar aprobado. */
export function solicitarAvance(id_proyecto: number, numero: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/solicitud`, { method: 'POST' })
}

/** PATCH /seguimiento/proyectos/:id/periodos/:numero/solicitud — el Administrador habilita el informe solicitado (el
 * investigador ya puede diligenciarlo) o rechaza la solicitud con una observación (puede volver a solicitarlo). */
export function decidirSolicitudAvance(
  id_proyecto: number,
  numero: number,
  decision: 'Habilitar' | 'Rechazar',
  observacion: string
): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/periodos/${numero}/solicitud`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, observacion }),
  })
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero — guarda el borrador. */
export function guardarAvance(id_proyecto: number, numero: number, detalle: DetalleAvance[]) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(!periodoBloqueadoPorOrden(p.periodos, numero), mensajeBloqueoPeriodo(numero))
    exigir(pe && periodoAbierto(pe), 'Este informe ya fue radicado y no se puede editar.')
    exigir(periodoHabilitado(pe!), 'El Administrador debe habilitar el informe de avance antes de diligenciarlo.')
    exigir(periodoEditable(pe!), 'El informe ya tiene firmas: reábrelo para poder editarlo.')
    // Cada actividad continúa desde el avance con que cerró el periodo anterior aprobado: no se puede bajar de ahí.
    const previos = detalleDesde(anteriorAprobado(p.periodos, numero), p.metas.length).map((d) => d.previo ?? 0)
    pe!.detalle = detalle.map((d, i) => {
      const previo = previos[i] ?? 0
      const porcentaje = Math.max(0, Math.min(100, Math.round(d.porcentaje) || 0))
      exigir(porcentaje >= previo, `«${p.metas[i]?.actividad ?? `Actividad ${i + 1}`}» no puede quedar por debajo del avance del periodo anterior (${previo} %).`)
      return { ...d, previo, porcentaje, estado: d.estado === 'Aplazada' ? 'Aplazada' : estadoPorPorcentaje(porcentaje) }
    })
    // No se guarda un informe con campos vacíos: es el que se firma y se envía a revisión.
    const faltan = camposFaltantes(pe!)
    exigir(faltan.length === 0, 'Completa los campos del informe antes de guardarlo.', faltan)
    pe!.estado = 'Borrador'
  })
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/firmas/:indice — firman, en orden,
 * el investigador principal y el co-investigador (formato INV-IC-FR-018). */
export function firmarAvance(id_proyecto: number, numero: number, indice: number) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(pe, 'El periodo no existe.')
    exigir(!periodoBloqueadoPorOrden(p.periodos, numero), mensajeBloqueoPeriodo(numero))
    exigir(pe && periodoAbierto(pe), 'Este informe ya fue radicado.')
    exigir(periodoHabilitado(pe!), 'El Administrador debe habilitar este informe de avance antes de continuar: solicítalo primero.')
    exigir(pe!.estado !== 'Programado', 'Guarda el informe antes de firmarlo.')
    exigir(!faltanEvidencias(pe!), MENSAJE_EVIDENCIA_MINIMA)
    exigir(siguienteFirma(pe!.firmas) === indice, 'No es el turno de esta firma.')
    pe!.firmas[indice] = { ...pe!.firmas[indice], firmado: true, fecha: hoyISO() }
  })
}

/** DELETE /seguimiento/proyectos/:id/periodos/:numero/firmas — borra las firmas para volver a editar. */
export function reabrirAvance(id_proyecto: number, numero: number) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(!periodoBloqueadoPorOrden(p.periodos, numero), mensajeBloqueoPeriodo(numero))
    exigir(pe && periodoAbierto(pe), 'Este informe ya fue radicado.')
    exigir(periodoHabilitado(pe!), 'El Administrador debe habilitar este informe de avance antes de continuar: solicítalo primero.')
    pe!.firmas = firmasInforme()
  })
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/radicar */
export function radicarAvance(id_proyecto: number, numero: number) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(!periodoBloqueadoPorOrden(p.periodos, numero), mensajeBloqueoPeriodo(numero))
    exigir(pe && periodoAbierto(pe), 'Este informe ya fue radicado.')
    exigir(periodoHabilitado(pe!), 'El Administrador debe habilitar este informe de avance antes de continuar: solicítalo primero.')
    exigir(!faltanEvidencias(pe!), MENSAJE_EVIDENCIA_MINIMA)
    exigir(siguienteFirma(pe!.firmas) === -1, 'Faltan firmas para radicar el informe.')
    pe!.estado = 'Radicado'
    pe!.fecha_radicacion = hoyISO()
    pe!.observacion_revision = ''
  })
}

/** PATCH /seguimiento/proyectos/:id/periodos/:numero/revision */
export function revisarAvance(id_proyecto: number, numero: number, decision: 'Aprobado' | 'Devuelto', observacion: string, revisor = '') {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(pe && pe.estado === 'Radicado', 'Solo se revisan informes radicados.')
    exigir(decision === 'Aprobado' || observacion.trim(), 'Indica las observaciones de la devolución.')
    exigir(decision === 'Devuelto' || revisor.trim(), 'Indica el nombre de quien revisa el informe.')
    pe!.estado = decision
    pe!.observacion_revision = decision === 'Devuelto' ? observacion.trim() : ''
    // Aprobar es la firma del Administrador: el informe queda "revisado por" ese nombre.
    pe!.revisado_por = decision === 'Aprobado' ? { nombre: revisor.trim(), fecha: hoyISO() } : null
    // Aprobado el avance, el siguiente informe arranca con lo que quedó hecho y lo que falta por hacer.
    if (decision === 'Aprobado') {
      const siguiente = p.periodos.find((x) => x.numero === numero + 1)
      if (siguiente && siguiente.estado === 'Programado') siguiente.detalle = detalleDesde(pe, p.metas.length)
    }
    // Un informe devuelto se corrige y se vuelve a firmar.
    if (decision === 'Devuelto') pe!.firmas = firmasInforme()
  })
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
export function registrarNovedad(id_proyecto: number, datos: DatosNovedad) {
  return modificarProyecto(id_proyecto, (p, s) => {
    const tipo = s.tipos_novedad.find((t) => t.id === datos.id_tipo && t.activo)
    exigir(tipo, 'Selecciona un tipo de novedad.')
    exigir(datos.justificacion.trim(), 'La justificación es obligatoria.')
    exigir(datos.soporte.trim(), 'El soporte es obligatorio.')
    const cancelacion = tipo!.nombre === 'Cancelación'
    if (cancelacion) exigir(datos.acto_administrativo.trim(), 'El acto administrativo es obligatorio.')
    if (tipo!.afecta_fechas && !cancelacion) exigir(datos.meses_prorroga >= 1, 'Indica los meses de ampliación.')
    if (tipo!.afecta_participantes && !cancelacion) exigir(datos.participante_saliente, 'Selecciona el participante saliente.')
    p.novedades.unshift({
      ...datos,
      id: Date.now(),
      tipo: tipo!.nombre,
      fecha: hoyISO(),
      estado: 'Pendiente',
      observacion: '',
      meses_prorroga: tipo!.afecta_fechas && !cancelacion ? datos.meses_prorroga : 0,
      participante_saliente: tipo!.afecta_participantes && !cancelacion ? datos.participante_saliente : '',
      participante_entrante: tipo!.afecta_participantes && !cancelacion ? datos.participante_entrante : '',
      acto_administrativo: cancelacion ? datos.acto_administrativo.trim() : '',
    })
  })
}

/** PATCH /seguimiento/proyectos/:id/novedades/:idNovedad — la VIE decide.
 * Una prórroga aprobada amplía la duración y reprograma los periodos pendientes. */
export function decidirNovedad(id_proyecto: number, id_novedad: number, estado: Exclude<EstadoNovedad, 'Pendiente'>, observacion: string) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(observacion.trim(), 'La observación es obligatoria.')
    const n = p.novedades.find((x) => x.id === id_novedad)
    exigir(n && n.estado === 'Pendiente', 'La novedad ya fue decidida.')
    n!.estado = estado
    n!.observacion = observacion.trim()
    if (estado === 'Aprobada' && n!.meses_prorroga > 0 && n!.tipo === 'Prórroga') {
      p.prorroga_meses += n!.meses_prorroga
      p.periodos = generarPeriodos(p)
    }
    if (estado === 'Aprobada' && n!.participante_saliente) {
      // El saliente conserva su histórico: se marca como retirado en vez de borrarse.
      p.participantes = p.participantes.map((x) => (x === n!.participante_saliente ? `${x} (retirado)` : x))
      if (n!.participante_entrante) p.participantes.push(n!.participante_entrante)
    }
  })
}

// ---------------------------------------------------------------------------
// M-06 Informe técnico final
// ---------------------------------------------------------------------------

export type CambiosInformeFinal = Partial<
  Pick<InformeFinal, 'info' | 'resumen' | 'objetivos' | 'observaciones_objetivos' | 'equipos' | 'materiales' | 'actividades_apoyos' | 'evidencias_apoyos'>
> & {
  productos?: ProductoComprometido[]
}

/** POST /seguimiento/proyectos/:id/informe-final/solicitud — el investigador solicita el informe técnico final (con todos
 * los avances aprobados) y el Administrador lo habilita para que pueda diligenciarlo. */
export function solicitarInformeFinal(id_proyecto: number): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/informe-final/solicitud`, { method: 'POST' })
}

/** PATCH /seguimiento/proyectos/:id/informe-final/solicitud — el Administrador habilita el informe final o rechaza la
 * solicitud con una observación (el investigador puede volver a solicitarlo). */
export function decidirSolicitudInformeFinal(
  id_proyecto: number,
  decision: 'Habilitar' | 'Rechazar',
  observacion: string
): Promise<ProyectoSeguimiento> {
  return apiFetch(`/seguimiento/proyectos/${id_proyecto}/informe-final/solicitud`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, observacion }),
  })
}

/** PUT /seguimiento/proyectos/:id/informe-final */
export function guardarInformeFinal(id_proyecto: number, cambios: CambiosInformeFinal) {
  return modificarProyecto(id_proyecto, (p) => {
    const f = p.informe_final
    exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p))
    exigir(!informeFinalSinHabilitar(p), mensajeSinHabilitarInformeFinal)
    exigir(f.estado === 'Borrador' || f.estado === 'Devuelto', 'El informe ya fue radicado y no se puede editar.')
    exigir(!f.firmas.some((x) => x.firmado), 'Ya hay firmas registradas: el informe no se puede modificar.')
    const { productos, ...resto } = cambios
    Object.assign(f, resto)
    if (productos) p.productos = productos
  })
}

/** POST /seguimiento/proyectos/:id/informe-final/firmas/:indice */
export function firmarInformeFinal(id_proyecto: number, indice: number) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p))
    exigir(!informeFinalSinHabilitar(p), mensajeSinHabilitarInformeFinal)
    const faltan = informeListoParaFirmar(p)
    exigir(faltan.length === 0, 'El informe aún no está completo.', faltan)
    exigir(siguienteFirma(p.informe_final.firmas) === indice, 'No es el turno de esta firma.')
    p.informe_final.firmas[indice] = { ...p.informe_final.firmas[indice], firmado: true, fecha: hoyISO() }
  })
}

/** POST /seguimiento/proyectos/:id/informe-final/radicar */
export function radicarInformeFinal(id_proyecto: number) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p))
    exigir(!informeFinalSinHabilitar(p), mensajeSinHabilitarInformeFinal)
    exigir(siguienteFirma(p.informe_final.firmas) === -1, 'Faltan firmas para radicar el informe.')
    p.informe_final.estado = 'Radicado'
    p.informe_final.fecha_entrega = hoyISO()
    p.informe_final.observacion_devolucion = ''
  })
}

/** PATCH /seguimiento/proyectos/:id/informe-final/revision — una devolución borra las firmas. */
export function revisarInformeFinal(id_proyecto: number, decision: 'Aprobado' | 'Devuelto', observacion: string, revisor = '') {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(p.informe_final.estado === 'Radicado', 'Solo se revisan informes radicados.')
    exigir(decision === 'Aprobado' || observacion.trim(), 'Indica las observaciones de la devolución.')
    exigir(decision === 'Devuelto' || revisor.trim(), 'Indica el nombre de quien revisa el informe.')
    p.informe_final.estado = decision
    // Aprobar es la firma del Administrador: el informe queda "revisado por" ese nombre.
    p.informe_final.revisado_por = decision === 'Aprobado' ? { nombre: revisor.trim(), fecha: hoyISO() } : null
    if (decision === 'Devuelto') {
      p.informe_final.observacion_devolucion = observacion.trim()
      p.informe_final.firmas = p.informe_final.firmas.map((f) => ({ ...f, firmado: false, fecha: null }))
    }
  })
}

// ---------------------------------------------------------------------------
// M-07 Cierre y paz y salvo
// ---------------------------------------------------------------------------

export type CambiosCierre = Partial<Omit<CierreProyecto, 'firmas' | 'finalizado'>>

/** PUT /seguimiento/proyectos/:id/cierre */
export function guardarCierre(id_proyecto: number, cambios: CambiosCierre) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(puedeCerrar(p), 'El cierre no está habilitado: hay prerrequisitos pendientes.')
    exigir(!p.cierre.firmas.some((x) => x.firmado), 'Ya hay firmas registradas: los datos del cierre no se pueden modificar.')
    Object.assign(p.cierre, cambios)
  })
}

/** POST /seguimiento/proyectos/:id/cierre/firmas/:indice */
export function firmarCierre(id_proyecto: number, indice: number) {
  return modificarProyecto(id_proyecto, (p) => {
    const c = p.cierre
    exigir(puedeCerrar(p), 'El cierre no está habilitado.')
    const faltan = faltantesCierre(c)
    exigir(faltan.length === 0, 'Al acta de cierre le faltan datos.', faltan)
    exigir(siguienteFirma(c.firmas) === indice, 'No es el turno de esta firma.')
    const firma = c.firmas[indice]
    // El Administrador firma de último como quien elaboró el acta, con el nombre de su cuenta.
    c.firmas[indice] = { ...firma, firmado: true, fecha: hoyISO(), ...(firma.rol === 'Administrador' ? { nombre: getNombreUsuarioActual() } : {}) }
  })
}

/** POST /seguimiento/proyectos/:id/cierre/finalizar */
export function finalizarProyecto(id_proyecto: number) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(siguienteFirma(p.cierre.firmas) === -1, 'Faltan firmas del acta de cierre.')
    p.cierre.finalizado = true
  })
}
