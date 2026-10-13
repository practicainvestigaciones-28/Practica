import type { Role } from '../../auth/lib/auth'
import type {
  CierreProyecto,
  ConceptoRubro,
  DetalleAvance,
  FirmaSeguimiento,
  Novedad,
  PeriodoInforme,
  ProductoComprometido,
  ProyectoSeguimiento,
  RolFirmante,
  EstadoSeguimiento,
} from '../api/tipos'
import { diasEntre, sumarDias, sumarMeses } from './formato'

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

export function antelacionEnDias(c: ConceptoRubro): number {
  return c.antelacion_unidad === 'días' ? c.antelacion_valor : c.antelacion_valor * 30
}

export interface DatosSolicitudRubro {
  id_concepto: number
  anio: number
  valor: number
  fecha_requerida: string
  descripcion: string
}

/** Errores por campo de una solicitud de rubro; objeto vacío = se puede enviar. */
export function validarSolicitudRubro(
  p: ProyectoSeguimiento,
  concepto: ConceptoRubro | undefined,
  datos: DatosSolicitudRubro,
  hoy: string
): Partial<Record<keyof DatosSolicitudRubro, string>> {
  const errores: Partial<Record<keyof DatosSolicitudRubro, string>> = {}
  if (!concepto) errores.id_concepto = 'Selecciona un concepto de rubro.'
  const vigencia = p.vigencias.find((v) => v.anio === datos.anio)
  const disponible = vigencia ? vigencia.asignado - vigencia.ejecutado : 0
  if (!vigencia) errores.anio = 'Selecciona una vigencia con saldo.'
  if (!(datos.valor > 0)) errores.valor = 'Ingresa un valor mayor que cero.'
  else if (datos.valor > disponible) errores.valor = `Excede el disponible de la vigencia.`
  if (!datos.fecha_requerida) errores.fecha_requerida = 'Indica la fecha requerida.'
  else if (concepto) {
    const minimo = antelacionEnDias(concepto)
    const dias = diasEntre(hoy, datos.fecha_requerida)
    if (dias < minimo) {
      errores.fecha_requerida = `No cumple la antelación mínima de ${concepto.antelacion_valor} ${concepto.antelacion_unidad}. Faltan ${minimo - dias} día(s).`
    }
  }
  if (!datos.descripcion.trim()) errores.descripcion = 'Describe la solicitud.'
  return errores
}

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
    if (previo && previo.estado !== 'Programado') return { ...previo, numero: i + 1, apertura, limite }
    return {
      numero: i + 1,
      apertura,
      limite,
      estado: 'Programado' as const,
      detalle: p.metas.map(detalleVacio),
      fecha_radicacion: null,
      observacion_revision: '',
      firmas: firmasInforme(),
    }
  })
}

export function avancePeriodo(pe: PeriodoInforme): number {
  if (pe.detalle.length === 0) return 0
  return Math.round(pe.detalle.reduce((t, d) => t + d.porcentaje, 0) / pe.detalle.length)
}

/** Toda actividad con avance mayor que cero debe tener al menos una evidencia. */
export const faltanEvidencias = (pe: PeriodoInforme) => pe.detalle.some((d) => d.porcentaje > 0 && d.evidencias.length === 0)

export const estadoPorPorcentaje = (pct: number): DetalleAvance['estado'] =>
  pct === 0 ? 'No iniciada' : pct === 100 ? 'Cumplida' : 'En ejecución'

/** Aún no está en manos de la Vicerrectoría. */
export const periodoAbierto = (pe: PeriodoInforme) => pe.estado !== 'Radicado' && pe.estado !== 'Aprobado'

/** Se puede diligenciar: está abierto y nadie lo ha firmado (lo firmado debe coincidir con lo guardado). */
export const periodoEditable = (pe: PeriodoInforme) => periodoAbierto(pe) && !pe.firmas.some((f) => f.firmado)

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

/** Cuántos campos de soporte (link) se muestran para un concepto: uno por resultado
 * proyectado. Si se obtuvo más de lo proyectado, también hay campo para los adicionales. */
export const cantidadSoportes = (x: ProductoComprometido) => Math.max(x.proyectado, x.obtenido ?? 0)

/** Cada resultado obtenido debe tener su enlace: cuántos faltan por registrar. */
export function soportesFaltantes(x: ProductoComprometido): number {
  const registrados = x.soportes.slice(0, cantidadSoportes(x)).filter((s) => s.trim()).length
  return Math.max(0, (x.obtenido ?? 0) - registrados)
}

/** Enlaces de soporte que cuentan para el informe (los de campos visibles y diligenciados). */
export const soportesRegistrados = (x: ProductoComprometido) => x.soportes.slice(0, cantidadSoportes(x)).filter((s) => s.trim())

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

/** MODO PRUEBA: mientras no exista el backend de seguimiento, ni cuentas con los roles
 * Líder y Vicerrector, el Administrador puede registrar cualquier firma pendiente para
 * que el flujo se pueda recorrer completo. Con backend real debe quedar en false. */
export const MODO_PRUEBA = true

export const NOTA_FIRMAS_MODO_PRUEBA =
  'Modo prueba: como Administrador puedes registrar cualquier firma pendiente, incluidas las del Líder del grupo y el Vicerrector, que aún no tienen cuenta en el sistema.'

/** Quién puede firmar por un firmante: quien tenga el rol que le corresponde. */
export function puedeFirmarComo(rol: RolFirmante, roles: Role[], modoPrueba = MODO_PRUEBA): boolean {
  return roles.includes(ROL_APP_FIRMANTE[rol]) || (modoPrueba && roles.includes('administrador'))
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
