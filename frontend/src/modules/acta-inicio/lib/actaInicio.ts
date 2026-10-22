import type { Role } from '../../auth/lib/auth'
import type { ActaInicioDetalle, DatosActaInicio, EstadoActa, FirmaActa, ParticipanteActa, TipoClausula } from '../api/actaInicio'
import { CLAUSULAS } from './textosLegales'

export const ETIQUETA_ESTADO_ACTA: Record<EstadoActa | 'sin_acta', string> = {
  sin_acta: 'Sin iniciar',
  'en elaboracion': 'En elaboración',
  'en firma': 'En firma',
  legalizada: 'Legalizada',
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2 de noviembre de 2026" a partir de yyyy-mm-dd. */
function fechaLarga(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} de ${MESES_LARGOS[m - 1]} de ${a}`
}

const unir = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`)

/** Texto de apertura del acta: dos párrafos que presentan el proyecto del que se está diligenciando el acta. Solo
 * nombra lo que el proyecto ya tiene registrado, para que nunca queden huecos en la frase. */
export function textoAperturaActa(acta: ActaInicioDetalle): [string, string] {
  const aprobacion = acta.numero_acta_aprobacion
    ? ` mediante el Acta No. ${acta.numero_acta_aprobacion}${acta.fecha_acta_aprobacion ? ` del ${fechaLarga(acta.fecha_acta_aprobacion)}` : ''}`
    : ''
  const convocatoria = acta.convocatoria ? `, aprobado en la convocatoria «${acta.convocatoria}»${aprobacion}` : aprobacion
  const primero =
    `La Universidad CESMAG, a través de la Vicerrectoría de Investigación y Extensión, y los investigadores que suscriben la presente acta ` +
    `dejan constancia del inicio del proyecto de investigación titulado «${acta.titulo}»${convocatoria}.`

  const nombresGrupos = acta.grupos.map((g) => g.grupo).filter(Boolean)
  const principal = acta.participantes.find((p) => p.rol.toLowerCase().includes('principal'))?.nombre
  const ejecutor = nombresGrupos.length
    ? `${nombresGrupos.length > 1 ? 'los grupos de investigación' : 'el grupo de investigación'} ${unir(nombresGrupos)}`
    : 'los investigadores del proyecto'
  const direccion = principal ? `, bajo la dirección de ${principal} como investigador principal` : ''
  const plazo = acta.fecha_inicio
    ? `, con una duración de ${acta.duracion_meses ? `${acta.duracion_meses} meses ` : ''}a partir del ${fechaLarga(acta.fecha_inicio)}`
    : acta.duracion_meses
      ? `, con una duración de ${acta.duracion_meses} meses`
      : ''
  const costos = acta.centro_costos ? ` y con cargo al centro de costos ${acta.centro_costos}` : ''
  const segundo =
    `El proyecto será ejecutado por ${ejecutor}${direccion}${plazo}${costos}. ` +
    `Mediante la presente acta los participantes conocen y aceptan los compromisos y cláusulas que se relacionan a continuación.`
  return [primero, segundo]
}

/** HU-84: fecha fin = fecha inicio + duración en meses (menos un día). Devuelve yyyy-mm-dd. */
export function calcularFechaFin(fechaInicio: string, duracionMeses: number): string {
  if (!fechaInicio || !duracionMeses || duracionMeses < 1) return ''
  const [a, m, d] = fechaInicio.split('-').map(Number)
  const fin = new Date(Date.UTC(a, m - 1 + duracionMeses, d))
  fin.setUTCDate(fin.getUTCDate() - 1)
  return fin.toISOString().slice(0, 10)
}

/** Años calendario que cubre la ejecución: del año de la fecha de inicio al año de la fecha de fin. */
export function aniosDeEjecucion(fechaInicio: string, duracionMeses: number): number[] {
  const fin = calcularFechaFin(fechaInicio, duracionMeses)
  if (!fin) return []
  const desde = Number(fechaInicio.slice(0, 4))
  const hasta = Number(fin.slice(0, 4))
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
}

/** Financiación aprobada de un acta: la suma de sus vigencias; si aún no se registró, la solicitada. */
export const valorAprobado = (acta: { vigencias: { valor_asignado: number }[]; valor_solicitado_unicesmag: number }) => {
  const suma = acta.vigencias.reduce((t, v) => t + (Number(v.valor_asignado) || 0), 0)
  return suma > 0 ? suma : acta.valor_solicitado_unicesmag
}

/** La financiación se registra como un solo valor, en el año de la fecha de inicio. */
export const vigenciaUnica = (fechaInicio: string, valor: number) => [
  { anio: Number(fechaInicio.slice(0, 4)) || new Date().getFullYear(), valor_asignado: valor },
]

export function sumaVigencias(vigencias: { valor_asignado: number }[]): number {
  return vigencias.reduce((t, v) => t + (Number(v.valor_asignado) || 0), 0)
}

/** HU-82, 83, 84, 85: devuelve la lista de problemas; vacía = se puede guardar. */
export function validarDatosActa(datos: DatosActaInicio, valorSolicitado: number): string[] {
  const errores: string[] = []
  if (!datos.tipo_proyecto) errores.push('Selecciona el tipo de proyecto.')
  if (!datos.numero_acta_aprobacion.trim()) errores.push('Falta el número del acta de aprobación.')
  else if (!/^\d+$/.test(datos.numero_acta_aprobacion.trim())) errores.push('El número del acta debe contener solo números.')
  if (!datos.fecha_acta_aprobacion) errores.push('Falta la fecha del acta de aprobación.')
  else if (datos.fecha_acta_aprobacion > new Date().toISOString().slice(0, 10)) errores.push('La fecha del acta de aprobación no puede ser futura.')
  if (!datos.centro_costos.trim()) errores.push('Falta el centro de costos.')
  else if (!/^\d+$/.test(datos.centro_costos.trim())) errores.push('El centro de costos debe contener solo números.')
  if (!datos.fecha_inicio) errores.push('Falta la fecha de inicio.')
  if (!datos.duracion_meses || datos.duracion_meses < 1) errores.push('La duración debe ser de al menos 1 mes.')
  // La financiación es el valor aprobado (puede diferir del solicitado): un solo valor, no año por año.
  void valorSolicitado
  if (sumaVigencias(datos.vigencias) <= 0) errores.push('Indica el valor aprobado.')
  return errores
}

const CAMPOS_CONTACTO: { clave: 'identificacion' | 'telefono' | 'correo' | 'programa_academico' | 'institucion'; etiqueta: string }[] = [
  { clave: 'identificacion', etiqueta: 'identificación' },
  { clave: 'telefono', etiqueta: 'teléfono' },
  { clave: 'correo', etiqueta: 'correo' },
  { clave: 'programa_academico', etiqueta: 'programa académico' },
  { clave: 'institucion', etiqueta: 'institución' },
]

export function camposContacto() {
  return CAMPOS_CONTACTO
}

/** HU-86: campos de contacto que le faltan a un participante. */
export function faltantesContacto(p: ParticipanteActa): string[] {
  return CAMPOS_CONTACTO.filter(({ clave }) => !String(p[clave] ?? '').trim()).map((c) => c.etiqueta)
}

/** Qué impide generar el acta (HU-82, 83, 85, 86). Vacío = se puede generar. */
export function bloqueosGeneracion(acta: ActaInicioDetalle): string[] {
  const bloqueos: string[] = []
  if (!acta.tipo_proyecto) bloqueos.push('Selecciona el tipo de proyecto.')
  if (!acta.numero_acta_aprobacion || !acta.fecha_acta_aprobacion) bloqueos.push('Registra el acto administrativo de aprobación.')
  if (!acta.centro_costos) bloqueos.push('Asigna el centro de costos.')
  if (!acta.fecha_inicio || !acta.duracion_meses) bloqueos.push('Registra fecha de inicio y duración.')
  if (acta.vigencias.length === 0 || sumaVigencias(acta.vigencias) <= 0) {
    bloqueos.push('Guarda los numerales 1 a 3: así queda registrado el valor aprobado (financiación del proyecto).')
  }
  for (const p of acta.participantes) {
    const f = faltantesContacto(p)
    if (f.length > 0) bloqueos.push(`${p.nombre}: faltan ${f.join(', ')}.`)
  }
  return bloqueos
}

/** HU-88/89: la firma que sigue es la primera pendiente por orden; el Vicerrector queda de último. */
export function siguienteFirma(acta: ActaInicioDetalle) {
  return [...acta.firmas].sort((a, b) => a.orden_firma - b.orden_firma).find((f) => !f.firmado) ?? null
}

/** HU-92: cláusulas que el participante aún no ha aceptado en esta acta. */
export function clausulasPendientes(acta: ActaInicioDetalle, id_usuarioproyecto: number): TipoClausula[] {
  const aceptadas = new Set(
    acta.compromisos.filter((c) => c.id_usuarioproyecto === id_usuarioproyecto && c.aceptado).map((c) => c.tipo_clausula)
  )
  return CLAUSULAS.map((c) => c.tipo).filter((t) => !aceptadas.has(t))
}

export const formatoPesos = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

/** HU-88/89/92: quién puede firmar ahora. Cada participante debe haber aceptado sus
 * cláusulas antes de firmar; el Vicerrector firma solo cuando todos aceptaron. */
export function puedeFirmarAhora(acta: ActaInicioDetalle, id_usuario: number | undefined): boolean {
  if (acta.estado !== 'en firma' || id_usuario === undefined) return false
  const proxima = siguienteFirma(acta)
  if (!proxima || proxima.id_usuario !== id_usuario) return false
  const participante = acta.participantes.find((p) => p.id_usuario === id_usuario)
  if (participante) return clausulasPendientes(acta, participante.id_usuarioproyecto).length === 0
  return acta.participantes.every((p) => clausulasPendientes(acta, p.id_usuarioproyecto).length === 0)
}

/** Firmantes que no son investigadores: el Vicerrector y, de último, el Administrador (quien elabora el acta). */
export const esFirmaDeInvestigador = (f: FirmaActa) => f.rol_firmante !== 'Vicerrector' && f.rol_firmante !== 'Administrador'

/** A quién le corresponde una firma: la de cada investigador, a su propio usuario; la del
 * Vicerrector, a quien tenga ese rol (en la firma queda un usuario genérico); la del Administrador, a quien tenga ese rol. */
export function firmaCorrespondeA(f: FirmaActa, id_usuario: number | undefined, roles: Role[]): boolean {
  if (f.rol_firmante === 'Vicerrector') return roles.includes('vicerrector')
  if (f.rol_firmante === 'Administrador') return roles.includes('administrador')
  return id_usuario !== undefined && f.id_usuario === id_usuario
}

/** La firma pendiente que esta cuenta puede dar ahora. Cada investigador firma cuando quiera, una vez aceptados sus
 * numerales; el Vicerrector, solo cuando todos los investigadores ya firmaron; y el Administrador ("elaborado por"),
 * de último, cuando ya firmaron los investigadores y el Vicerrector. */
export function firmaDeCuenta(acta: ActaInicioDetalle, id_usuario: number | undefined, roles: Role[]): FirmaActa | null {
  if (acta.estado !== 'en firma') return null
  const pendientes = acta.firmas.filter((f) => !f.firmado)
  const investigadoresPendientes = pendientes.filter(esFirmaDeInvestigador)
  const quedaAlguienAntesDelAdmin = pendientes.some((f) => f.rol_firmante !== 'Administrador')
  return (
    pendientes.find(
      (f) =>
        firmaCorrespondeA(f, id_usuario, roles) &&
        (f.rol_firmante === 'Vicerrector'
          ? investigadoresPendientes.length === 0
          : f.rol_firmante === 'Administrador'
            ? !quedaAlguienAntesDelAdmin
            : true)
    ) ?? null
  )
}

/** Requisito de una firma: el investigador aceptó sus numerales, o todos los aceptaron si firma el Vicerrector. */
export function requisitosDeFirma(acta: ActaInicioDetalle, firma: FirmaActa | null): boolean {
  if (acta.estado !== 'en firma' || !firma || firma.firmado) return false
  const participante = participanteDeFirma(acta, firma)
  const quienes = participante ? [participante] : acta.participantes
  return quienes.every((p) => clausulasPendientes(acta, p.id_usuarioproyecto).length === 0)
}

/** Participante al que pertenece una firma (el Vicerrector y el Administrador no son participantes). */
export function participanteDeFirma(acta: ActaInicioDetalle, f: FirmaActa | null): ParticipanteActa | null {
  if (!f || !esFirmaDeInvestigador(f)) return null
  return acta.participantes.find((p) => p.id_usuario === f.id_usuario) ?? null
}

/** HU-88/89/92: la próxima firma ya cumple sus requisitos — el investigador aceptó
 * sus cláusulas, o todos las aceptaron si quien firma es el Vicerrector. */
export function requisitosDeFirmaCumplidos(acta: ActaInicioDetalle): boolean {
  const proxima = siguienteFirma(acta)
  if (acta.estado !== 'en firma' || !proxima) return false
  const participante = participanteDeFirma(acta, proxima)
  const quienes = participante ? [participante] : acta.participantes
  return quienes.every((p) => clausulasPendientes(acta, p.id_usuarioproyecto).length === 0)
}
