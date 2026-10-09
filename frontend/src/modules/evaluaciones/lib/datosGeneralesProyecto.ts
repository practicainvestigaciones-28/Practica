import * as proyectosApi from '../../proyectos/api/proyectos'

export interface CampoDatoGeneral {
  label: string
  valor: string
}

export function formatearMoneda(valor: string | null | undefined): string {
  const n = Number(valor)
  if (!valor || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export interface ParticipanteDatoGeneral {
  categoria: string
  nombre: string
  correo: string
  campos: CampoDatoGeneral[]
}

export interface DatosGeneralesDetalle {
  camposProyecto: CampoDatoGeneral[]
  participantes: ParticipanteDatoGeneral[]
}

const ROL_PRINCIPAL = 'Investigador(a) Principal UNICESMAG'
const ROL_COINV_UNICESMAG = 'Co investigador(a) UNICESMAG'
const ROL_EXTERNO = 'Co investigador(a) Externo(a)'
const ROL_EGRESADO = 'Co investigador(a) Egresado(a) UNICESMAG'
const ROL_ESTUDIANTE = 'Estudiante Investigador(a)'

const ETIQUETA_POR_ROL: Record<string, string> = {
  [ROL_PRINCIPAL]: 'Investigador principal',
  [ROL_COINV_UNICESMAG]: 'Co-investigador UNICESMAG',
  [ROL_EXTERNO]: 'Co-investigador externo',
  [ROL_EGRESADO]: 'Co-investigador egresado UNICESMAG',
  [ROL_ESTUDIANTE]: 'Estudiante investigador(a)',
}

function nombreDe(p: proyectosApi.ParticipanteProyecto): string {
  return `${p.usuario ? p.usuario.nombre : p.nombre_manual} ${p.usuario ? p.usuario.apellido : p.apellido_manual}`
}

function correoDe(p: proyectosApi.ParticipanteProyecto): string {
  return (p.usuario ? p.usuario.correo : p.correo_manual) || '—'
}

/**
 * Qué campos adicionales mostrar depende del rol — cada uno diligencia algo
 * distinto en el formulario de registro:
 * - Investigador principal / Co-investigador UNICESMAG / Co-investigador
 *   externo: ORCID, Google Académico y dedicación (son los roles con perfil
 *   investigativo, ver CrearProyecto.tsx).
 * - Co-investigador egresado UNICESMAG: su información de egresado
 *   (facultad, programa, empresa/entidad donde trabaja, dedicación en horas
 *   semanales, cédula) en vez de ORCID/dedicación.
 * - Estudiante investigador(a): solo lo que el formato le pide a un
 *   estudiante (código estudiantil y si es auxiliar o asistente), no ORCID
 *   ni Google Académico porque esos campos ni siquiera se le piden.
 */
function camposPorRol(
  p: proyectosApi.ParticipanteProyecto,
  egresados: Map<number, proyectosApi.InformacionEgresado | null>
): CampoDatoGeneral[] {
  const rol = p.rolProyecto.nombre

  if (rol === ROL_EGRESADO) {
    const eg = p.participante != null ? egresados.get(p.participante) : null
    return [
      { label: 'Facultad', valor: eg?.facultad ?? '—' },
      { label: 'Programa académico', valor: eg?.programa_academico ?? '—' },
      { label: 'Empresa/entidad', valor: eg?.empresa_entidad ?? '—' },
      { label: 'Dedicación', valor: eg?.dedicacion_horas_semanales != null ? `${eg.dedicacion_horas_semanales} horas/semana` : '—' },
      { label: 'Cédula', valor: eg?.cedula ?? '—' },
    ]
  }

  if (rol === ROL_ESTUDIANTE) {
    return [
      { label: 'Código estudiantil', valor: p.codigo_estudiantil ?? '—' },
      { label: 'Rol del estudiante', valor: p.rolEstudiante?.nombre ?? '—' },
    ]
  }

  // Principal, Co-investigador UNICESMAG y Co-investigador externo.
  return [
    { label: 'ORCID', valor: p.orcid ?? '—' },
    { label: 'Google Académico', valor: p.google_academico ?? '—' },
    { label: 'Dedicación', valor: p.dedicacion.nombre },
  ]
}

/**
 * Todo lo que el investigador diligencia en "Información general" del
 * registro del proyecto, sin el título (ya visible en el encabezado de la
 * página) — para el ítem "1. Datos Generales" / "1. Información General del
 * Proyecto" de los checklists oficiales de comité. Cada participante queda
 * en su propia tarjeta con los campos que le correspondan según su rol —
 * antes todos los que no eran el investigador principal se juntaban en un
 * solo campo de texto "Co-investigadores", sin distinguir estudiantes de
 * egresados ni mostrar ORCID/dedicación de nadie.
 */
export function construirDatosGenerales(
  proyecto: proyectosApi.ProyectoDetalle,
  participantes: proyectosApi.ParticipanteProyecto[],
  areas: proyectosApi.AreaDelProyecto[],
  programas: proyectosApi.ProgramaDelProyecto[],
  financiacion: proyectosApi.FinanciacionProyecto | null,
  egresados: Map<number, proyectosApi.InformacionEgresado | null>
): DatosGeneralesDetalle {
  const camposProyecto: CampoDatoGeneral[] = [
    { label: 'Modalidad', valor: proyecto.modalidad?.nombre ?? '—' },
    { label: 'Área de conocimiento', valor: areas.length > 0 ? areas.map((a) => a.area.nombre).join(', ') : '—' },
    {
      label: 'Programa académico',
      valor: programas.length > 0 ? programas.map((p) => p.programa?.nombre ?? p.programa_otro ?? '—').join(', ') : '—',
    },
    {
      label: 'Ubicación',
      valor: proyecto.ciudad ? `${proyecto.ciudad}${proyecto.departamento ? `, ${proyecto.departamento}` : ''}` : '—',
    },
    { label: 'Duración', valor: proyecto.duracion_periodos ? `${proyecto.duracion_periodos} periodo(s)` : '—' },
    { label: 'Tipo de proyecto', valor: proyecto.tipoProyecto?.nombre ?? '—' },
  ]

  if (financiacion) {
    camposProyecto.push({
      label: 'Financiación',
      valor: `Solicitado a UNICESMAG: ${formatearMoneda(financiacion.valor_solicitado_unicesmag)} — Contrapartida: ${formatearMoneda(financiacion.valor_contrapartida)} — Total: ${formatearMoneda(financiacion.valor_total)}`,
    })
  }

  // El principal va primero, el resto en el orden en que vengan.
  const ordenados = [
    ...participantes.filter((p) => p.rolProyecto.nombre === ROL_PRINCIPAL),
    ...participantes.filter((p) => p.rolProyecto.nombre !== ROL_PRINCIPAL),
  ]

  return {
    camposProyecto,
    participantes: ordenados.map((p) => ({
      categoria: ETIQUETA_POR_ROL[p.rolProyecto.nombre] ?? p.rolProyecto.nombre,
      nombre: nombreDe(p),
      correo: correoDe(p),
      campos: camposPorRol(p, egresados),
    })),
  }
}
