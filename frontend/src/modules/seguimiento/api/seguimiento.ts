import { ApiError } from '../../../shared/api/client'
import { estadosActasInicio, obtenerActaInicio } from '../../acta-inicio/api/actaInicio'
import { leerAlmacen, modificarAlmacen, type EstadoAlmacen } from '../lib/almacen'
import { hoyISO } from '../lib/formato'
import {
  estadoPorPorcentaje,
  faltantesCierre,
  faltanEvidencias,
  generarPeriodos,
  informeListoParaFirmar,
  firmasInforme,
  informeFinalBloqueadoPorAvances,
  mensajeBloqueoInformeFinal,
  mensajeBloqueoPeriodo,
  periodoAbierto,
  periodoBloqueadoPorOrden,
  periodoEditable,
  proyectoBloqueado,
  puedeCerrar,
  siguienteFirma,
  validarSolicitudRubro,
  type DatosSolicitudRubro,
} from '../lib/reglas'
import type {
  CierreProyecto,
  ConceptoRubro,
  DetalleAvance,
  EstadoNovedad,
  EstadoSolicitud,
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

export type { DatosSolicitudRubro }

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

/** Un proyecto entra a seguimiento cuando su acta de inicio queda legalizada: si el acta se reinició o
 * aún no termina su proceso, el proyecto sale de la lista. Sin conexión no se quita nada. */
async function depurarSinActaLegalizada(): Promise<void> {
  try {
    const estados = await estadosActasInicio()
    // Una respuesta que no sea el mapa de estados no autoriza a quitar nada.
    if (!estados || typeof estados !== 'object' || Array.isArray(estados)) return
    const salen = leerAlmacen()
      .proyectos.filter((p) => estados[p.id_proyecto] !== 'legalizada')
      .map((p) => p.id_proyecto)
    if (salen.length > 0) {
      modificarAlmacen((s) => {
        s.proyectos = s.proyectos.filter((p) => !salen.includes(p.id_proyecto))
      })
    }
  } catch {
    // Sin conexión o sin sesión: se muestra lo que ya está guardado.
  }
}

/** Los proyectos que están en seguimiento sin cronograma lo traen de su formulación (vía el acta de inicio). */
async function completarCronogramas(proyectos: ProyectoSeguimiento[]): Promise<void> {
  const sinCronograma = proyectos.filter((p) => p.metas.length === 0)
  await Promise.all(
    sinCronograma.map((p) =>
      obtenerActaInicio(p.id_proyecto).catch(() => {
        // Sin permiso o sin conexión: se muestra lo que ya está guardado.
      })
    )
  )
}

/** GET /seguimiento/proyectos — proyectos con acta de inicio legalizada. */
export async function listarProyectosSeguimiento(): Promise<ProyectoSeguimiento[]> {
  await depurarSinActaLegalizada()
  await completarCronogramas(leerAlmacen().proyectos)
  return leerAlmacen().proyectos
}

/** GET /seguimiento/proyectos/:id */
export async function obtenerProyectoSeguimiento(id_proyecto: number): Promise<ProyectoSeguimiento> {
  await depurarSinActaLegalizada()
  await completarCronogramas([buscarProyecto(leerAlmacen(), id_proyecto)])
  return buscarProyecto(leerAlmacen(), id_proyecto)
}

// ---------------------------------------------------------------------------
// Parametrización (catálogos del Administrador)
// ---------------------------------------------------------------------------

type Catalogo = 'conceptos' | 'tipos_novedad' | 'tipos_articulacion'
type ItemCatalogo<C extends Catalogo> = EstadoAlmacen[C][number]

function guardarEnCatalogo<C extends Catalogo>(catalogo: C, item: ItemCatalogo<C>): Promise<ItemCatalogo<C>[]> {
  const nombre = item.nombre.trim()
  if (!nombre) return Promise.reject(new ApiError(422, 'El nombre es obligatorio.'))
  try {
    const s = modificarAlmacen((estado) => {
      const lista = estado[catalogo] as ItemCatalogo<C>[]
      const repetido = lista.some((x) => x.id !== item.id && x.nombre.trim().toLowerCase() === nombre.toLowerCase())
      if (repetido) throw new ApiError(409, `Ya existe un registro llamado "${nombre}".`)
      const i = lista.findIndex((x) => x.id === item.id)
      if (i >= 0) lista[i] = { ...item, nombre }
      else lista.push({ ...item, nombre, id: Date.now() })
    })
    return respuesta(s[catalogo] as ItemCatalogo<C>[])
  } catch (err) {
    return Promise.reject(err)
  }
}

function eliminarDeCatalogo<C extends Catalogo>(catalogo: C, id: number): Promise<ItemCatalogo<C>[]> {
  const s = modificarAlmacen((estado) => {
    const lista = estado[catalogo] as ItemCatalogo<C>[]
    const i = lista.findIndex((x) => x.id === id)
    if (i >= 0) lista.splice(i, 1)
  })
  return respuesta(s[catalogo] as ItemCatalogo<C>[])
}

/** GET /seguimiento/conceptos-rubro */
export const listarConceptosRubro = () => respuesta(leerAlmacen().conceptos)
/** POST|PUT /seguimiento/conceptos-rubro */
export function guardarConceptoRubro(c: ConceptoRubro) {
  if (!(c.antelacion_valor >= 0)) return Promise.reject(new ApiError(422, 'La antelación no puede ser negativa.'))
  return guardarEnCatalogo('conceptos', c)
}
/** DELETE /seguimiento/conceptos-rubro/:id */
export const eliminarConceptoRubro = (id: number) => eliminarDeCatalogo('conceptos', id)

/** GET /seguimiento/tipos-novedad */
export const listarTiposNovedad = () => respuesta(leerAlmacen().tipos_novedad)
/** POST|PUT /seguimiento/tipos-novedad */
export const guardarTipoNovedad = (t: TipoNovedad) => guardarEnCatalogo('tipos_novedad', t)
/** DELETE /seguimiento/tipos-novedad/:id */
export const eliminarTipoNovedad = (id: number) => eliminarDeCatalogo('tipos_novedad', id)

/** GET /seguimiento/tipos-articulacion */
export const listarTiposArticulacion = () => respuesta(leerAlmacen().tipos_articulacion)
/** POST|PUT /seguimiento/tipos-articulacion */
export const guardarTipoArticulacion = (t: TipoArticulacion) => guardarEnCatalogo('tipos_articulacion', t)
/** DELETE /seguimiento/tipos-articulacion/:id */
export const eliminarTipoArticulacion = (id: number) => eliminarDeCatalogo('tipos_articulacion', id)

// ---------------------------------------------------------------------------
// M-02 Rubros
// ---------------------------------------------------------------------------

/** POST /seguimiento/proyectos/:id/solicitudes-rubro */
export function crearSolicitudRubro(id_proyecto: number, datos: DatosSolicitudRubro) {
  return modificarProyecto(id_proyecto, (p, s) => {
    const concepto = s.conceptos.find((c) => c.id === datos.id_concepto && c.activo)
    const errores = validarSolicitudRubro(p, concepto, datos, hoyISO())
    exigir(Object.keys(errores).length === 0, 'La solicitud no es válida.', Object.values(errores) as string[])
    p.solicitudes.unshift({
      ...datos,
      id: Date.now(),
      concepto: concepto!.nombre,
      descripcion: datos.descripcion.trim(),
      fecha_solicitud: hoyISO(),
      estado: 'Pendiente',
      observacion: '',
    })
  })
}

/** PATCH /seguimiento/proyectos/:id/solicitudes-rubro/:idSolicitud — la VIE decide. */
export function decidirSolicitudRubro(id_proyecto: number, id_solicitud: number, estado: Exclude<EstadoSolicitud, 'Pendiente'>, observacion: string) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(observacion.trim(), 'La observación es obligatoria para decidir.')
    const sol = p.solicitudes.find((x) => x.id === id_solicitud)
    exigir(sol && sol.estado === 'Pendiente', 'La solicitud ya fue decidida.')
    if (estado === 'Aprobada') {
      const v = p.vigencias.find((x) => x.anio === sol!.anio)
      exigir(v && v.asignado - v.ejecutado >= sol!.valor, 'La vigencia ya no tiene saldo suficiente.')
      v!.ejecutado += sol!.valor
    }
    sol!.estado = estado
    sol!.observacion = observacion.trim()
  })
}

// ---------------------------------------------------------------------------
// M-03 Informes de avance
// ---------------------------------------------------------------------------

/** POST /seguimiento/proyectos/:id/periodos/regenerar */
export function regenerarPeriodos(id_proyecto: number) {
  return modificarProyecto(id_proyecto, (p) => {
    p.periodos = generarPeriodos(p)
  })
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero — guarda el borrador. */
export function guardarAvance(id_proyecto: number, numero: number, detalle: DetalleAvance[]) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(!periodoBloqueadoPorOrden(p.periodos, numero), mensajeBloqueoPeriodo(numero))
    exigir(pe && periodoAbierto(pe), 'Este informe ya fue radicado y no se puede editar.')
    exigir(periodoEditable(pe!), 'El informe ya tiene firmas: reábrelo para poder editarlo.')
    pe!.detalle = detalle.map((d) => {
      const porcentaje = Math.max(0, Math.min(100, Math.round(d.porcentaje) || 0))
      return { ...d, porcentaje, estado: d.estado === 'Aplazada' ? 'Aplazada' : estadoPorPorcentaje(porcentaje) }
    })
    pe!.estado = 'Borrador'
  })
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/firmas/:indice — firman, en orden,
 * el investigador principal y el co-investigador (formato INV-IC-FR-018). */
export function firmarAvance(id_proyecto: number, numero: number, indice: number) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(!periodoBloqueadoPorOrden(p.periodos, numero), mensajeBloqueoPeriodo(numero))
    exigir(pe && periodoAbierto(pe), 'Este informe ya fue radicado.')
    exigir(pe!.estado !== 'Programado', 'Guarda el informe antes de firmarlo.')
    exigir(!faltanEvidencias(pe!), 'Toda actividad con avance debe tener al menos una evidencia.')
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
    pe!.firmas = firmasInforme()
  })
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/radicar */
export function radicarAvance(id_proyecto: number, numero: number) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(!periodoBloqueadoPorOrden(p.periodos, numero), mensajeBloqueoPeriodo(numero))
    exigir(pe && periodoAbierto(pe), 'Este informe ya fue radicado.')
    exigir(!faltanEvidencias(pe!), 'Toda actividad con avance debe tener al menos una evidencia.')
    exigir(siguienteFirma(pe!.firmas) === -1, 'Faltan firmas para radicar el informe.')
    pe!.estado = 'Radicado'
    pe!.fecha_radicacion = hoyISO()
    pe!.observacion_revision = ''
  })
}

/** PATCH /seguimiento/proyectos/:id/periodos/:numero/revision */
export function revisarAvance(id_proyecto: number, numero: number, decision: 'Aprobado' | 'Devuelto', observacion: string) {
  return modificarProyecto(id_proyecto, (p) => {
    const pe = p.periodos.find((x) => x.numero === numero)
    exigir(pe && pe.estado === 'Radicado', 'Solo se revisan informes radicados.')
    exigir(decision === 'Aprobado' || observacion.trim(), 'Indica las observaciones de la devolución.')
    pe!.estado = decision
    pe!.observacion_revision = decision === 'Devuelto' ? observacion.trim() : ''
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

/** PUT /seguimiento/proyectos/:id/informe-final */
export function guardarInformeFinal(id_proyecto: number, cambios: CambiosInformeFinal) {
  return modificarProyecto(id_proyecto, (p) => {
    const f = p.informe_final
    exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p))
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
    exigir(siguienteFirma(p.informe_final.firmas) === -1, 'Faltan firmas para radicar el informe.')
    p.informe_final.estado = 'Radicado'
    p.informe_final.fecha_entrega = hoyISO()
    p.informe_final.observacion_devolucion = ''
  })
}

/** PATCH /seguimiento/proyectos/:id/informe-final/revision — una devolución borra las firmas. */
export function revisarInformeFinal(id_proyecto: number, decision: 'Aprobado' | 'Devuelto', observacion: string) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(p.informe_final.estado === 'Radicado', 'Solo se revisan informes radicados.')
    exigir(decision === 'Aprobado' || observacion.trim(), 'Indica las observaciones de la devolución.')
    p.informe_final.estado = decision
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
    c.firmas[indice] = { ...c.firmas[indice], firmado: true, fecha: hoyISO() }
  })
}

/** POST /seguimiento/proyectos/:id/cierre/finalizar */
export function finalizarProyecto(id_proyecto: number) {
  return modificarProyecto(id_proyecto, (p) => {
    exigir(siguienteFirma(p.cierre.firmas) === -1, 'Faltan firmas del acta de cierre.')
    p.cierre.finalizado = true
  })
}
