import type { Role } from '../../auth/lib/auth'
import type {
  CierreProyecto,
  DetalleAvance,
  FirmaSeguimiento,
  Novedad,
  PeriodoInforme,
  ProductoComprometido,
  ProyectoSeguimiento,
  RolFirmante,
  EstadoSeguimiento,
} from '../api/tipos'
import { contarPalabras, getLimite } from '../../proyectos/lib/limitesTexto'
import { sumarDias, sumarMeses } from './formato'

/** Los informes de avance son semestrales (INV-IC-FR-018). */
export const MESES_POR_PERIODO = 6

// ---------------------------------------------------------------------------
// Fechas y duración
// ---------------------------------------------------------------------------

export const duracionTotal = (p: ProyectoSeguimiento) => p.duracion_meses + p.prorroga_meses

/** Fecha fin = inicio + duración (con prórrogas) menos un día, igual que el acta de inicio. */
export function fechaFin(p: Pick<ProyectoSeguimiento, 'fecha_inicio' | 'duracion_meses' | 'prorroga_meses'>, mesesExtra = 0): string {
  const meses = p.duracion_meses + p.prorroga_meses + mesesExtra
  if (!p.fecha_inicio || meses < 1) return ''
  return sumarDias(sumarMeses(p.fecha_inicio, meses), -1)
}

// ---------------------------------------------------------------------------
// M-02 Presupuesto
// ---------------------------------------------------------------------------

export const totalAsignado = (p: ProyectoSeguimiento) => p.vigencias.reduce((t, v) => t + v.asignado, 0)
export const totalEjecutado = (p: ProyectoSeguimiento) => p.vigencias.reduce((t, v) => t + v.ejecutado, 0)

// ---------------------------------------------------------------------------
// M-03 Informes de avance
// ---------------------------------------------------------------------------

/** Cronograma del formato INV-IC-FR-018: cada periodo muestra 6 meses de 4 semanas. */
export const SEMANAS_POR_MES = 4
export const SEMANAS_POR_PERIODO = MESES_POR_PERIODO * SEMANAS_POR_MES

export const detalleVacio = (): DetalleAvance => ({
  semanas: Array.from({ length: SEMANAS_POR_PERIODO }, () => false),
  estado: 'No iniciada',
  porcentaje: 0,
  observacion: '',
  evidencias: [],
})

/** Detalle de un periodo nuevo a partir del anterior ya aprobado: cada actividad sigue desde donde quedó
 * (avance, estado), sin evidencias ni semanas — esas se registran periodo a periodo. */
export function detalleDesde(anterior: PeriodoInforme | undefined, cantidad: number): DetalleAvance[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const d = anterior?.detalle[i]
    if (!d) return detalleVacio()
    return {
      ...detalleVacio(),
      previo: d.porcentaje,
      porcentaje: d.porcentaje,
      estado: d.estado === 'Aplazada' ? ('Aplazada' as const) : estadoPorPorcentaje(d.porcentaje),
    }
  })
}

/** Periodo anterior, si ya está aprobado (de él se continúa). */
export const anteriorAprobado = (periodos: PeriodoInforme[], numero: number): PeriodoInforme | undefined => {
  const anterior = periodos.find((x) => x.numero === numero - 1)
  return anterior?.estado === 'Aprobado' ? anterior : undefined
}

export const firmasInforme = (): FirmaSeguimiento[] => [
  { rol: 'Investigador principal', firmado: false, fecha: null },
  { rol: 'Co-investigadores', firmado: false, fecha: null },
]

/** Recalcula los periodos semestrales según inicio y duración total. Los periodos
 * que ya tienen trabajo (no "Programado") conservan su contenido; solo se les
 * actualizan las fechas, por ejemplo tras una prórroga. */
export function generarPeriodos(p: ProyectoSeguimiento): PeriodoInforme[] {
  const total = duracionTotal(p)
  if (!p.fecha_inicio || total < 1) return []
  const cantidad = Math.ceil(total / MESES_POR_PERIODO)
  return Array.from({ length: cantidad }, (_, i) => {
    const apertura = sumarMeses(p.fecha_inicio, i * MESES_POR_PERIODO)
    const limite = sumarDias(sumarMeses(p.fecha_inicio, Math.min((i + 1) * MESES_POR_PERIODO, total)), -1)
    const previo = p.periodos[i]
    if (previo && (periodoSolicitado(previo) || previo.observacion_solicitud)) return { ...previo, numero: i + 1, apertura, limite }
    return {
      numero: i + 1,
      apertura,
      limite,
      estado: 'Programado' as const,
      detalle: detalleDesde(anteriorAprobado(p.periodos, i + 1), p.metas.length),
      fecha_radicacion: null,
      observacion_revision: '',
      fecha_solicitud: null,
      fecha_habilitacion: null,
      firmas: firmasInforme(),
    }
  })
}

export function avancePeriodo(pe: PeriodoInforme): number {
  if (pe.detalle.length === 0) return 0
  return Math.round(pe.detalle.reduce((t, d) => t + d.porcentaje, 0) / pe.detalle.length)
}

/** El informe necesita al menos una evidencia (archivo adjunto o enlace) en total, no una por actividad. Si todas las
 * actividades ya venían cumplidas del periodo anterior no hay nada nuevo que evidenciar. */
export const faltanEvidencias = (pe: PeriodoInforme) =>
  pe.detalle.some((d) => (d.previo ?? 0) < 100) && pe.detalle.every((d) => d.evidencias.length === 0)

export const MENSAJE_EVIDENCIA_MINIMA = 'Agrega al menos una evidencia del informe (archivo adjunto o enlace), en cualquiera de las actividades.'

export const MENSAJE_SEMANAS_MINIMAS = 'Señala en el cronograma al menos una semana trabajada.'
export const MENSAJE_AVANCE_MINIMO = 'Indica un porcentaje de avance en al menos una actividad.'

/** Lo que el investigador debe diligenciar para guardar el informe y enviarlo a revisión: señalar semanas, dar un
 * porcentaje de avance y adjuntar una evidencia, cada cosa al menos una vez en todo el informe (no por actividad).
 * Si todas las actividades ya venían cumplidas del periodo anterior no hay nada nuevo que pedir. Las observaciones
 * son opcionales. */
export function camposFaltantes(pe: PeriodoInforme): string[] {
  const faltan: string[] = []
  if (!pe.detalle.some((d) => (d.previo ?? 0) < 100)) return faltan
  if (!pe.detalle.some((d) => d.semanas.some(Boolean))) faltan.push(MENSAJE_SEMANAS_MINIMAS)
  if (!pe.detalle.some((d) => d.porcentaje > (d.previo ?? 0))) faltan.push(MENSAJE_AVANCE_MINIMO)
  if (faltanEvidencias(pe)) faltan.push(MENSAJE_EVIDENCIA_MINIMA)
  return faltan
}

/** Cuánto le falta a una actividad para cumplirse. */
export const faltaPorHacer = (porcentaje: number) => Math.max(0, 100 - porcentaje)

export const estadoPorPorcentaje = (pct: number): DetalleAvance['estado'] =>
  pct === 0 ? 'No iniciada' : pct === 100 ? 'Cumplida' : 'En ejecución'

/** Aún no está en manos de la Vicerrectoría. */
/** El investigador solicita cada informe de avance y el Administrador lo habilita; solo entonces se diligencia. Un
 * informe que ya tiene trabajo (guardado, radicado, devuelto o aprobado) cuenta como solicitado y habilitado. */
export const periodoSolicitado = (pe: PeriodoInforme) => pe.estado !== 'Programado' || !!pe.fecha_solicitud
export const periodoHabilitado = (pe: PeriodoInforme) => pe.estado !== 'Programado' || !!pe.fecha_habilitacion
/** Solicitado por el investigador y a la espera de que el Administrador lo habilite. */
export const solicitudPendiente = (pe: PeriodoInforme) => pe.estado === 'Programado' && !!pe.fecha_solicitud && !pe.fecha_habilitacion

export const periodoAbierto = (pe: PeriodoInforme) => pe.estado !== 'Radicado' && pe.estado !== 'Aprobado'

/** Se puede diligenciar: está abierto y nadie lo ha firmado (lo firmado debe coincidir con lo guardado). */
export const periodoEditable = (pe: PeriodoInforme) => periodoAbierto(pe) && !pe.firmas.some((f) => f.firmado)

/** Los informes de avance se habilitan en orden: el periodo N se desbloquea cuando la Vicerrectoría aprueba el
 * avance del periodo N-1. Un periodo que ya tiene trabajo (guardado, radicado, devuelto o aprobado) no se bloquea. */
export function periodoBloqueadoPorOrden(periodos: PeriodoInforme[], numero: number): boolean {
  const i = periodos.findIndex((p) => p.numero === numero)
  if (i <= 0) return false
  if (periodos[i].estado !== 'Programado') return false
  return periodos[i - 1].estado !== 'Aprobado'
}

export const mensajeBloqueoPeriodo = (numero: number) =>
  `El periodo ${numero} se desbloquea cuando se apruebe el avance del periodo ${numero - 1}.`

/** Informes de avance que aún no están aprobados. */
export const avancesSinAprobar = (p: ProyectoSeguimiento): PeriodoInforme[] => p.periodos.filter((pe) => pe.estado !== 'Aprobado')

/** El informe técnico final se habilita cuando todos los informes de avance están aprobados. Si el informe
 * ya tiene trabajo (devuelto, radicado, aprobado o con firmas) no se vuelve a bloquear. */
export function informeFinalBloqueadoPorAvances(p: ProyectoSeguimiento): boolean {
  const f = p.informe_final
  if (f.estado !== 'Borrador' || f.firmas.some((x) => x.firmado)) return false
  return p.periodos.length === 0 || avancesSinAprobar(p).length > 0
}

/** El investigador solicita el informe final y el Administrador lo habilita (después de aprobados todos los avances).
 * Un informe que ya tiene firmas, radicado, devuelto o aprobado cuenta como habilitado. */
export function informeFinalSinHabilitar(p: ProyectoSeguimiento): boolean {
  const f = p.informe_final
  if (f.estado !== 'Borrador' || f.firmas.some((x) => x.firmado)) return false
  return !f.fecha_habilitacion
}

export const informeFinalSolicitado = (p: ProyectoSeguimiento) => !!p.informe_final.fecha_solicitud || !informeFinalSinHabilitar(p)

/** Solicitado por el investigador y a la espera de que el Administrador lo habilite. */
export const informeFinalSolicitudPendiente = (p: ProyectoSeguimiento) =>
  informeFinalSinHabilitar(p) && !!p.informe_final.fecha_solicitud && !informeFinalBloqueadoPorAvances(p)

/** No se puede diligenciar: faltan avances por aprobar o el Administrador aún no lo habilita. */
export const informeFinalNoDisponible = (p: ProyectoSeguimiento) => informeFinalBloqueadoPorAvances(p) || informeFinalSinHabilitar(p)

export const mensajeSinHabilitarInformeFinal = 'El Administrador debe habilitar el informe final antes de diligenciarlo.'

export function mensajeBloqueoInformeFinal(p: ProyectoSeguimiento): string {
  if (p.periodos.length === 0) return 'El informe final se desbloquea cuando se aprueben todos los informes de avance, y este proyecto aún no tiene periodos programados.'
  const faltan = avancesSinAprobar(p).length
  return `El informe final se desbloquea cuando se aprueben todos los informes de avance (${p.periodos.length - faltan} de ${p.periodos.length} aprobados).`
}

/** Año que encabeza el cronograma ("Período xx Año xxxx"). */
export const anioPeriodo = (pe: PeriodoInforme) => Number(pe.apertura.slice(0, 4))

// ---------------------------------------------------------------------------
// M-05 Novedades
// ---------------------------------------------------------------------------

/** Resumen corto de lo que cambia una novedad, para tablas y bandejas. */
export function detalleNovedad(n: Novedad): string {
  const partes: string[] = []
  if (n.meses_prorroga) partes.push(`${n.meses_prorroga} meses`)
  if (n.participante_saliente) partes.push(`Sale: ${n.participante_saliente}`)
  if (n.participante_entrante) partes.push(`Entra: ${n.participante_entrante}`)
  if (n.acto_administrativo) partes.push(`Acto: ${n.acto_administrativo}`)
  return partes.join(' · ') || '—'
}

// ---------------------------------------------------------------------------
// M-06 Informe final
// ---------------------------------------------------------------------------

export function totalesProductos(p: ProyectoSeguimiento) {
  const proyectado = p.productos.reduce((t, x) => t + x.proyectado, 0)
  const obtenido = p.productos.reduce((t, x) => t + (x.obtenido ?? 0), 0)
  const porcentaje = proyectado ? Math.round((obtenido / proyectado) * 1000) / 10 : 0
  return { proyectado, obtenido, porcentaje }
}

export function semaforoCumplimiento(pct: number): { etiqueta: string; estado: 'Aprobado' | 'En revisión' | 'Rechazado' } {
  if (pct >= 90) return { etiqueta: 'Cumple', estado: 'Aprobado' }
  if (pct >= 70) return { etiqueta: 'Parcial', estado: 'En revisión' }
  return { etiqueta: 'Bajo', estado: 'Rechazado' }
}

/** Cuántos soportes se esperan de un concepto: uno por cada resultado que se dice haber obtenido. */
export const cantidadSoportes = (x: ProductoComprometido) => x.obtenido ?? 0

/** Cada resultado obtenido debe tener su soporte (enlace o archivo): cuántos faltan por registrar. */
export function soportesFaltantes(x: ProductoComprometido): number {
  return Math.max(0, (x.obtenido ?? 0) - x.soportes.length)
}

/** Soportes que cuentan para el informe. */
export const soportesRegistrados = (x: ProductoComprometido) => x.soportes

/** Qué le falta a un producto: cantidad obtenida, soporte de cada resultado obtenido y
 * observación si obtuvo menos de lo proyectado. */
export function faltantesProducto(x: ProductoComprometido): string[] {
  const faltan: string[] = []
  // Un concepto que no se comprometió (proyectado 0) puede quedar en blanco.
  if (x.obtenido === null) return x.proyectado > 0 ? ['cantidad obtenida'] : []
  if (soportesFaltantes(x) > 0) faltan.push('soporte')
  if (x.obtenido < x.proyectado && !x.observacion.trim()) faltan.push('observación')
  return faltan
}

export const soportesCompletos = (p: ProyectoSeguimiento) => p.productos.every((x) => faltantesProducto(x).length === 0)

export function informeListoParaFirmar(p: ProyectoSeguimiento): string[] {
  const f = p.informe_final
  const faltan: string[] = []
  if (!f.info.area_conocimiento.trim() || !f.info.ciudad.trim() || !f.info.departamento.trim()) {
    faltan.push('Completa la información general: área de conocimiento, ciudad y departamento.')
  }
  if (!f.info.investigador_principal.correo.trim() || !f.info.investigador_principal.telefono.trim()) {
    faltan.push('Registra el correo y el teléfono del investigador principal.')
  }
  if (!f.resumen.trim()) faltan.push('Escribe el resumen del proyecto ejecutado.')
  else if (contarPalabras(f.resumen) > getLimite('resumen')) faltan.push(`El resumen no puede superar las ${getLimite('resumen')} palabras.`)
  if (f.objetivos.some((o) => !o.cumplimiento.trim())) faltan.push('Describe el cumplimiento de todos los objetivos.')
  if (!soportesCompletos(p)) faltan.push('Completa los resultados con sus soportes y observaciones.')
  return faltan
}

// ---------------------------------------------------------------------------
// M-07 Cierre
// ---------------------------------------------------------------------------

export interface Prerrequisito {
  titulo: string
  ok: boolean
  detalle: string
}

export function prerrequisitosCierre(p: ProyectoSeguimiento): Prerrequisito[] {
  const aprobados = p.periodos.filter((x) => x.estado === 'Aprobado').length
  const informesOk = p.periodos.length > 0 && aprobados === p.periodos.length
  const finalOk = p.informe_final.estado === 'Aprobado'
  const soportesOk = soportesCompletos(p)
  return [
    {
      titulo: 'Informes de avance aprobados',
      ok: informesOk,
      detalle: p.periodos.length ? `${aprobados} de ${p.periodos.length} periodos aprobados` : 'No se han programado periodos',
    },
    {
      titulo: 'Informe técnico final aprobado',
      ok: finalOk,
      detalle: finalOk ? 'Informe aprobado por la Vicerrectoría' : `Estado actual: ${p.informe_final.estado}`,
    },
    {
      titulo: 'Soportes de productos completos',
      ok: soportesOk,
      detalle: soportesOk ? 'Todos los productos reportados con soporte' : 'Falta cantidad obtenida, enlace u observación en algún producto',
    },
  ]
}

export const puedeCerrar = (p: ProyectoSeguimiento) => prerrequisitosCierre(p).every((x) => x.ok)

/** Qué le falta al acta de cierre para poder firmarse; vacío = lista para firmar. Cada
 * mensaje dice dónde está el dato, para que quien diligencia no tenga que adivinarlo. */
export function faltantesCierre(c: CierreProyecto): string[] {
  const faltan: string[] = []
  if (!c.fecha_fin_real) faltan.push('Fecha de finalización (numeral 1).')
  if (c.libros > 0 && !c.libros_soporte.trim()) faltan.push('Soporte de los libros reportados (numeral 2.1).')
  if (c.capitulos > 0 && !c.capitulos_soporte.trim()) faltan.push('Soporte de los capítulos de libro reportados (numeral 2.1).')
  if (!c.paz_y_salvo) faltan.push('Marcar la casilla “Declaro el paz y salvo de los investigadores”.')
  if (!c.ciudad.trim()) faltan.push('Ciudad de suscripción.')
  if (!c.fecha_acta) faltan.push('Fecha del acta.')
  return faltan
}

// ---------------------------------------------------------------------------
// Firmas secuenciales (informe final y acta de cierre)
// ---------------------------------------------------------------------------

/** Qué rol de la aplicación firma en nombre de cada firmante. */
export const ROL_APP_FIRMANTE: Record<RolFirmante, Role> = {
  'Investigador principal': 'usuario',
  'Co-investigadores': 'usuario',
  'Líder del grupo': 'lider',
  Vicerrector: 'vicerrector',
}

/** Mientras no exista la cuenta del Líder del grupo, el investigador firma en su lugar. Cuando el Líder tenga
 * usuario, basta con poner esto en false y la firma queda solo para quien tenga el rol de líder. */
export const INVESTIGADOR_FIRMA_POR_LIDER = true

/** Quién puede firmar por un firmante: quien tenga el rol que le corresponde. */
export function puedeFirmarComo(rol: RolFirmante, roles: Role[]): boolean {
  if (rol === 'Líder del grupo' && INVESTIGADOR_FIRMA_POR_LIDER && roles.includes('usuario')) return true
  return roles.includes(ROL_APP_FIRMANTE[rol])
}

/** Índice de la próxima firma pendiente, o -1 si ya firmaron todos. */
export const siguienteFirma = (firmas: FirmaSeguimiento[]) => firmas.findIndex((f) => !f.firmado)

// ---------------------------------------------------------------------------
// Estado general
// ---------------------------------------------------------------------------

export function estadoSeguimiento(p: ProyectoSeguimiento): EstadoSeguimiento {
  if (p.cierre.finalizado) return 'Finalizado'
  if (p.novedades.some((n) => n.tipo === 'Cancelación' && n.estado === 'Aprobada')) return 'Cancelado'
  if (p.informe_final.estado === 'Radicado' || p.informe_final.estado === 'Aprobado') return 'Informe final radicado'
  if (p.periodos.some((x) => x.estado !== 'Programado')) return 'En seguimiento'
  return 'En ejecución'
}

/** Un proyecto finalizado o cancelado queda bloqueado para toda edición. */
export const proyectoBloqueado = (p: ProyectoSeguimiento) => {
  const e = estadoSeguimiento(p)
  return e === 'Finalizado' || e === 'Cancelado'
}
