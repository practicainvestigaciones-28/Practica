import { ApiError, apiFetch } from '../../../shared/api/client'
import { getIdUsuarioActual, getRolesEfectivos } from '../../auth/lib/auth'
import { agregarProyectoLegalizado, completarMetas } from '../../seguimiento/lib/almacen'

// Contrato de datos de EP-15 (HU-82 a HU-92, RQF81-RQF90), según el formato
// INV-IC-FR-017 v5. El acta vive en el backend (/api/acta-inicio): el servidor
// arma el detalle desde el proyecto aprobado, valida y registra las firmas.
//
// La aceptación de compromisos y cláusulas es del grupo: cuando un investigador
// acepta un numeral queda aceptado para todos. La firma es individual: cada
// firmante recibe un enlace personal en su correo y, con un click, queda firmada.

export type EstadoActa = 'en elaboracion' | 'en firma' | 'legalizada'
export type TipoClausula = 'compromisos' | 'derechos de autor' | 'confidencialidad' | 'tratamiento de datos'
export type RolFirmante = 'investigador principal' | 'co-investigador' | 'Vicerrector'

/** Numeral 2 del formato. */
export const TIPOS_PROYECTO = [
  'Investigación Científica',
  'Innovación Educativa',
  'Desarrollo Tecnológico',
  'Innovación',
  'Creación Artística y Cultural',
] as const
export type TipoProyecto = (typeof TIPOS_PROYECTO)[number]

export interface ActaInicioResumen {
  id_proyecto: number
  titulo: string
  investigador_principal: string | null
  convocatoria: string | null
  estado_proyecto: string
  estado_acta: EstadoActa | null
  /** Cuenta que registró el proyecto y cuentas de sus investigadores (para filtrar según el rol activo). */
  id_creador?: number
  ids_usuarios?: number[]
}

export interface VigenciaActa {
  anio: number
  valor_asignado: number
}

export interface ParticipanteActa {
  id_usuarioproyecto: number
  id_usuario: number
  nombre: string
  rol: string
  identificacion: string | null
  telefono: string | null
  correo: string | null
  programa_academico: string | null
  institucion: string | null
}

export interface FirmaActa {
  id_firma: number
  id_usuario: number
  nombre: string
  rol_firmante: RolFirmante
  orden_firma: number
  firmado: boolean
  fecha_firma: string | null
}

export interface CompromisoActa {
  id_usuarioproyecto: number
  tipo_clausula: TipoClausula
  version_texto: string | null
  aceptado: boolean
  fecha_aceptacion: string | null
}

export interface GrupoActa {
  grupo: string
  entidad: string
}

export interface ActaInicioDetalle {
  id_acta_inicio: number | null
  id_proyecto: number
  titulo: string
  convocatoria: string | null
  estado: EstadoActa
  // Numeral 1: viene de la formulación aprobada, solo lectura.
  objetivo_general: string
  objetivos_especificos: string[]
  grupos: GrupoActa[]
  /** Programas académicos a los que se articula el proyecto (formulación aprobada). */
  programas?: string[]
  /** Cuenta que registró el proyecto. */
  id_creador?: number
  fecha_inicio: string | null
  duracion_meses: number | null
  fecha_fin_estimada: string | null
  // Numeral 2
  tipo_proyecto: TipoProyecto | null
  // Numeral 3
  numero_acta_aprobacion: string | null
  fecha_acta_aprobacion: string | null
  centro_costos: string | null
  valor_solicitado_unicesmag: number
  vigencias: VigenciaActa[]
  // Numeral 4
  participantes: ParticipanteActa[]
  firmas: FirmaActa[]
  compromisos: CompromisoActa[]
  tiene_archivo_generado: boolean
  tiene_archivo_firmado: boolean
  archivo_firmado_nombre: string | null
  fecha_legalizacion: string | null
  /** Nombre y correo con que se propone al Vicerrector: solo firma, no tiene cuenta. */
  vicerrector_sugerido?: { nombre: string; correo: string }
  /** Correo con que quedó el Vicerrector en esta acta (solo lo recibe el Administrador). */
  vicerrector_correo?: string | null
  /** Modo de pruebas de firmas: un investigador firma por todos y el Administrador firma como Vicerrector. */
  modo_prueba_firmas?: boolean
  /** Actividades del cronograma de la formulación (base del informe de avance en seguimiento). */
  actividades?: ActividadActa[]
}

export interface ActividadActa {
  id_actividad: number
  actividad: string
  resultado: string | null
  responsable: string | null
  objetivo: string | null
}

export interface DatosActaInicio {
  tipo_proyecto: TipoProyecto | ''
  numero_acta_aprobacion: string
  fecha_acta_aprobacion: string
  centro_costos: string
  fecha_inicio: string
  duracion_meses: number
  vigencias: VigenciaActa[]
}

export type DatosContacto = Pick<ParticipanteActa, 'identificacion' | 'telefono' | 'correo' | 'programa_academico' | 'institucion'>

// ---------------------------------------------------------------------------

/** Ruta del proyecto en la etapa de seguimiento: una acta legalizada deja el proyecto en ejecución. */
function enviarASeguimiento(acta: ActaInicioDetalle): void {
  // Objetivo específico | meta | actividad | responsable: lo que se reporta en cada informe de avance.
  const metas = (acta.actividades ?? []).map((a) => ({
    objetivo: a.objetivo ?? '',
    meta: a.resultado ?? '',
    actividad: a.actividad,
    responsable: a.responsable ?? '',
  }))
  // Si el proyecto ya está en seguimiento sin cronograma, se le completa con el de la formulación.
  completarMetas(acta.id_proyecto, metas)
  if (acta.estado !== 'legalizada') return
  const principal = acta.participantes.find((p) => p.rol.toLowerCase().includes('principal'))
  const coInvestigadores = acta.participantes.filter((p) => !p.rol.toLowerCase().includes('principal'))
  // Interno = de la misma institución del investigador principal.
  const esInterno = (institucion: string | null) => (institucion ?? '') === (principal?.institucion ?? '')
  agregarProyectoLegalizado({
    id_proyecto: acta.id_proyecto,
    titulo: acta.titulo,
    investigador_principal: principal?.nombre ?? '',
    programa_academico: principal?.programa_academico ?? '',
    equipo: {
      co_investigadores_internos: coInvestigadores.filter((p) => esInterno(p.institucion)).map((p) => p.nombre),
      co_investigadores_externos: coInvestigadores.filter((p) => !esInterno(p.institucion)).map((p) => p.nombre),
      auxiliares: [],
    },
    grupo: acta.grupos.map((g) => g.grupo).join(', '),
    modalidad: acta.tipo_proyecto ?? '',
    articulacion: new Set(acta.grupos.map((g) => g.entidad)).size > 1 ? 'Interinstitucional' : 'Intrainstitucional',
    centro_costos: acta.centro_costos ?? '',
    fecha_inicio: acta.fecha_inicio ?? '',
    duracion_meses: acta.duracion_meses ?? 0,
    vigencias: acta.vigencias.map((v) => ({ anio: v.anio, asignado: v.valor_asignado, ejecutado: 0 })),
    objetivo_general: acta.objetivo_general,
    objetivos_especificos: acta.objetivos_especificos,
    convocatoria: acta.convocatoria ?? '',
    participantes: acta.participantes.map((p) => `${p.rol} · ${p.nombre}`),
    metas,
  })
}

/** GET /acta-inicio — el servidor entrega lo que le toca a la cuenta; aquí se afina según el rol que eligió. */
export async function listarActasInicio(): Promise<ActaInicioResumen[]> {
  const lista = await apiFetch<ActaInicioResumen[]>('/acta-inicio')
  const roles = getRolesEfectivos()
  const soloFirma = roles.includes('vicerrector') && !roles.includes('administrador') && !roles.includes('usuario')
  const soloPropios = roles.includes('usuario') && !roles.includes('administrador') && !roles.includes('vicerrector')
  const idUsuario = getIdUsuarioActual()
  return lista
    .filter((a) => !soloFirma || (a.estado_acta !== null && a.estado_acta !== 'en elaboracion'))
    .filter((a) => !soloPropios || a.id_creador === idUsuario || (a.ids_usuarios ?? []).includes(idUsuario ?? -1))
}

/** GET /acta-inicio/estados — estado del acta de cada proyecto; Seguimiento solo recibe los legalizados. */
export function estadosActasInicio(): Promise<Record<number, EstadoActa | 'sin_acta'>> {
  return apiFetch('/acta-inicio/estados')
}

/** GET /acta-inicio/proyecto/:id */
export async function obtenerActaInicio(id_proyecto: number): Promise<ActaInicioDetalle> {
  const acta = await apiFetch<ActaInicioDetalle>(`/acta-inicio/proyecto/${id_proyecto}`)
  enviarASeguimiento(acta)
  return acta
}

/** PUT /acta-inicio/proyecto/:id — numerales 2 y 3, fecha de inicio y duración. Crea el acta si no existe. */
export function guardarDatosActa(id_proyecto: number, datos: DatosActaInicio): Promise<ActaInicioDetalle> {
  return apiFetch(`/acta-inicio/proyecto/${id_proyecto}`, { method: 'PUT', body: JSON.stringify(datos) })
}

/** PATCH /acta-inicio/proyecto/:id/participantes/:idUsuarioProyecto — numeral 4. */
export function guardarContactoParticipante(id_proyecto: number, id_usuarioproyecto: number, datos: DatosContacto): Promise<unknown> {
  return apiFetch(`/acta-inicio/proyecto/${id_proyecto}/participantes/${id_usuarioproyecto}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  })
}

/** POST /acta-inicio/:id/generar — deja el acta "en firma". El Vicerrector solo firma: se indica el
 * correo donde recibe su enlace. Responde 422 con `faltantes` si algo está incompleto. */
export function generarActaInicio(id_acta_inicio: number, vicerrector: { nombre: string; correo: string }): Promise<unknown> {
  return apiFetch(`/acta-inicio/${id_acta_inicio}/generar`, {
    method: 'POST',
    body: JSON.stringify({ vicerrector_nombre: vicerrector.nombre, vicerrector_correo: vicerrector.correo }),
  })
}

/** POST /acta-inicio/:id/reiniciar — borra el acta completa (incluso legalizada) para hacerla de nuevo. Solo
 * Administrador y solo en modo de pruebas. */
export function reiniciarActaInicio(id_acta_inicio: number): Promise<unknown> {
  return apiFetch(`/acta-inicio/${id_acta_inicio}/reiniciar`, { method: 'POST' })
}

/** POST /acta-inicio/:id/reabrir — vuelve a "en elaboración" un acta no legalizada. Borra firmas y aceptaciones. */
export function reabrirActaInicio(id_acta_inicio: number): Promise<unknown> {
  return apiFetch(`/acta-inicio/${id_acta_inicio}/reabrir`, { method: 'POST' })
}

/** POST /acta-inicio/:id/compromisos — numerales 5, 7, 8 y 9. La aceptación es del grupo: queda
 * registrada para todos los investigadores del acta; con los cuatro aceptados salen los enlaces de firma. */
export function aceptarCompromisos(id_acta_inicio: number, version_texto: string, clausulas: TipoClausula[]): Promise<unknown> {
  return apiFetch(`/acta-inicio/${id_acta_inicio}/compromisos`, {
    method: 'POST',
    body: JSON.stringify({ clausulas, version_texto }),
  })
}

/** POST /acta-inicio/:id/firmar — firma dentro del sistema, con la cuenta de quien firma (alternativa al enlace del correo). */
export function firmarActaInicio(id_acta_inicio: number, porTodos = false): Promise<unknown> {
  return apiFetch(`/acta-inicio/${id_acta_inicio}/firmar`, { method: 'POST', body: JSON.stringify({ por_todos: porTodos }) })
}

/** PATCH /acta-inicio/:id/vicerrector — el Administrador cambia o completa el correo del Vicerrector antes de que firme. */
export function actualizarVicerrector(id_acta_inicio: number, vicerrector: { nombre: string; correo: string }): Promise<unknown> {
  return apiFetch(`/acta-inicio/${id_acta_inicio}/vicerrector`, { method: 'PATCH', body: JSON.stringify(vicerrector) })
}

/** POST /acta-inicio/:id/reenviar-firma — el Administrador vuelve a enviar su enlace a quien no ha firmado. */
export function reenviarEnlacesFirma(id_acta_inicio: number): Promise<unknown> {
  return apiFetch(`/acta-inicio/${id_acta_inicio}/reenviar-firma`, { method: 'POST' })
}

export interface ResultadoFirmaEnlace {
  mensaje: string
  titulo: string
  nombre: string
  rol_firmante: string
  legalizada: boolean
  ya_firmado: boolean
}

/** POST /firma-acta/:token — público: abrir el enlace del correo registra la firma. */
export function firmarPorEnlace(token: string): Promise<ResultadoFirmaEnlace> {
  // Sin sesión: el token del correo es la credencial; no se manda el de la sesión (si venció, no debe cerrarla).
  return apiFetch(`/firma-acta/${token}`, { method: 'POST', conAuth: false })
}

/** El PDF del acta solo existe cuando está firmada por todos. Se arma en el navegador con los datos del
 * acta y la constancia de cada firma (formato INV-IC-FR-017). */
export async function descargarActa(id_proyecto: number, _tipo: 'generado' | 'firmado', nombre: string): Promise<void> {
  const acta = await obtenerActaInicio(id_proyecto)
  if (acta.estado !== 'legalizada') throw new ApiError(409, 'El PDF del acta se genera cuando todos los firmantes hayan firmado.')
  // Import dinámico: jsPDF solo se descarga cuando alguien pide el PDF.
  const { generarPdfActa } = await import('../lib/pdfActa')
  ;(await generarPdfActa(acta)).save(nombre)
}
