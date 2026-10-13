import type { Role } from '../../auth/lib/auth'
import type { ActaInicioDetalle, DatosActaInicio, EstadoActa, FirmaActa, ParticipanteActa, TipoClausula } from '../api/actaInicio'
import { CLAUSULAS } from './textosLegales'

export const ETIQUETA_ESTADO_ACTA: Record<EstadoActa | 'sin_acta', string> = {
  sin_acta: 'Sin iniciar',
  'en elaboracion': 'En elaboración',
  'en firma': 'En firma',
  legalizada: 'Legalizada',
}

/** HU-84: fecha fin = fecha inicio + duración en meses (menos un día). Devuelve yyyy-mm-dd. */
export function calcularFechaFin(fechaInicio: string, duracionMeses: number): string {
  if (!fechaInicio || !duracionMeses || duracionMeses < 1) return ''
  const [a, m, d] = fechaInicio.split('-').map(Number)
  const fin = new Date(Date.UTC(a, m - 1 + duracionMeses, d))
  fin.setUTCDate(fin.getUTCDate() - 1)
  return fin.toISOString().slice(0, 10)
}

export function sumaVigencias(vigencias: { valor_asignado: number }[]): number {
  return vigencias.reduce((t, v) => t + (Number(v.valor_asignado) || 0), 0)
}

/** HU-82, 83, 84, 85: devuelve la lista de problemas; vacía = se puede guardar. */
export function validarDatosActa(datos: DatosActaInicio, valorSolicitado: number): string[] {
  const errores: string[] = []
  if (!datos.tipo_proyecto) errores.push('Selecciona el tipo de proyecto.')
  if (!datos.numero_acta_aprobacion.trim()) errores.push('Falta el número del acta de aprobación.')
  if (!datos.fecha_acta_aprobacion) errores.push('Falta la fecha del acta de aprobación.')
  else if (datos.fecha_acta_aprobacion > new Date().toISOString().slice(0, 10)) errores.push('La fecha del acta de aprobación no puede ser futura.')
  if (!datos.centro_costos.trim()) errores.push('Falta el centro de costos.')
  if (!datos.fecha_inicio) errores.push('Falta la fecha de inicio.')
  if (!datos.duracion_meses || datos.duracion_meses < 1) errores.push('La duración debe ser de al menos 1 mes.')
  if (datos.vigencias.length === 0) errores.push('Registra al menos una vigencia.')
  const anios = datos.vigencias.map((v) => v.anio)
  if (new Set(anios).size !== anios.length) errores.push('No puede haber dos vigencias con el mismo año.')
  if (datos.vigencias.length > 0 && sumaVigencias(datos.vigencias) !== valorSolicitado) {
    errores.push('La suma de las vigencias debe coincidir con el valor solicitado a UNICESMAG.')
  }
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
  if (acta.vigencias.length === 0 || sumaVigencias(acta.vigencias) !== acta.valor_solicitado_unicesmag) {
    bloqueos.push('Las vigencias deben sumar el valor solicitado a UNICESMAG.')
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

/** A quién le corresponde una firma. Con backend es estrictamente el usuario de la
 * firma; en modo prueba las cuentas no coinciden con los participantes de ejemplo,
 * así que basta con tener el rol: Investigador firma por los investigadores y
 * Vicerrector por la Vicerrectoría. */
export function firmaCorrespondeA(f: FirmaActa, id_usuario: number | undefined, roles: Role[], modoPrueba: boolean): boolean {
  if (id_usuario !== undefined && f.id_usuario === id_usuario) return true
  if (!modoPrueba) return false
  // El Administrador puede registrar cualquier firma en modo prueba: aún no hay cuentas de Vicerrector.
  if (roles.includes('administrador')) return true
  return f.rol_firmante === 'Vicerrector' ? roles.includes('vicerrector') : roles.includes('usuario')
}

/** Participante al que pertenece una firma (el Vicerrector no es participante). */
export function participanteDeFirma(acta: ActaInicioDetalle, f: FirmaActa | null): ParticipanteActa | null {
  if (!f || f.rol_firmante === 'Vicerrector') return null
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
