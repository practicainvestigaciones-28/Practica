import { ApiError } from '../../../shared/api/client'
import { getRolesEfectivos } from '../../auth/lib/auth'
import { agregarProyectoLegalizado } from '../../seguimiento/lib/almacen'
import { leerActas, modificarActas, reiniciarActas, type ActaGuardada } from '../lib/almacen'
import { bloqueosGeneracion, calcularFechaFin, clausulasPendientes, siguienteFirma, validarDatosActa } from '../lib/actaInicio'

// Contrato de datos de EP-15 (HU-82 a HU-92, RQF81-RQF90), según el formato
// INV-IC-FR-017 v5. Las tablas ya existen en Prisma (ActaInicio,
// CompromisoAceptacion, FirmaDocumento, FinanciacionVigencia).
//
// MODO PRUEBA: el backend aún no expone /api/acta-inicio, así que estas
// funciones operan sobre el almacén local (lib/almacen.ts) y validan igual que
// lo haría el servidor. Cada una indica su ruta HTTP: al existir, basta con
// reemplazar el cuerpo por apiFetch(...) y poner MODO_PRUEBA en false.
export const MODO_PRUEBA = true

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

const exigir = (condicion: unknown, mensaje: string, faltantes?: string[]) => {
  if (!condicion) throw new ApiError(422, mensaje, faltantes)
}

function porProyecto(lista: ActaGuardada[], id_proyecto: number): ActaGuardada {
  const acta = lista.find((a) => a.id_proyecto === id_proyecto)
  if (!acta) throw new ApiError(404, 'El proyecto no está aprobado o no existe.')
  return acta
}

function porActa(lista: ActaGuardada[], id_acta_inicio: number): ActaGuardada {
  const acta = lista.find((a) => a.id_acta_inicio === id_acta_inicio)
  if (!acta) throw new ApiError(404, 'El acta de inicio no existe.')
  return acta
}

/** Ejecuta un cambio y devuelve una promesa, como lo haría una petición HTTP. */
function mutar<T>(cambio: (lista: ActaGuardada[]) => T): Promise<T> {
  try {
    let resultado!: T
    modificarActas((lista) => {
      resultado = cambio(lista)
    })
    return Promise.resolve(structuredClone(resultado))
  } catch (err) {
    return Promise.reject(err)
  }
}

const esPrincipal = (rol: string) => rol.toLowerCase().includes('principal')

/** GET /acta-inicio — filtra por rol: el Administrador ve todos los proyectos
 * aprobados; el Investigador, los suyos; el Vicerrector, los que ya están en firma. */
export function listarActasInicio(): Promise<ActaInicioResumen[]> {
  const roles = getRolesEfectivos()
  const soloFirma = roles.includes('vicerrector') && !roles.includes('administrador') && !roles.includes('usuario')
  return Promise.resolve(
    leerActas()
      .filter((a) => !soloFirma || (a.id_acta_inicio !== null && a.estado !== 'en elaboracion'))
      .map((a) => ({
        id_proyecto: a.id_proyecto,
        titulo: a.titulo,
        investigador_principal: a.participantes.find((p) => esPrincipal(p.rol))?.nombre ?? null,
        convocatoria: a.convocatoria,
        estado_proyecto: a.estado_proyecto,
        estado_acta: a.id_acta_inicio === null ? null : a.estado,
      }))
  )
}

/** GET /acta-inicio/proyecto/:id */
export function obtenerActaInicio(id_proyecto: number): Promise<ActaInicioDetalle> {
  try {
    return Promise.resolve(porProyecto(leerActas(), id_proyecto))
  } catch (err) {
    return Promise.reject(err)
  }
}

/** PUT /acta-inicio/proyecto/:id — numerales 2 y 3, fecha de inicio y duración. Crea el acta si no existe. */
export function guardarDatosActa(id_proyecto: number, datos: DatosActaInicio): Promise<ActaInicioDetalle> {
  return mutar((lista) => {
    const acta = porProyecto(lista, id_proyecto)
    exigir(acta.estado === 'en elaboracion', 'El acta ya fue generada: sus datos no se pueden modificar.')
    const errores = validarDatosActa(datos, acta.valor_solicitado_unicesmag)
    exigir(errores.length === 0, 'Los datos del acta no son válidos.', errores)
    if (acta.id_acta_inicio === null) acta.id_acta_inicio = Math.max(0, ...lista.map((a) => a.id_acta_inicio ?? 0)) + 1
    Object.assign(acta, {
      tipo_proyecto: datos.tipo_proyecto,
      numero_acta_aprobacion: datos.numero_acta_aprobacion.trim(),
      fecha_acta_aprobacion: datos.fecha_acta_aprobacion,
      centro_costos: datos.centro_costos.trim(),
      fecha_inicio: datos.fecha_inicio,
      duracion_meses: datos.duracion_meses,
      fecha_fin_estimada: calcularFechaFin(datos.fecha_inicio, datos.duracion_meses),
      vigencias: [...datos.vigencias].sort((a, b) => a.anio - b.anio),
    })
    return acta
  })
}

/** PATCH /acta-inicio/proyecto/:id/participantes/:idUsuarioProyecto — numeral 4. */
export function guardarContactoParticipante(id_proyecto: number, id_usuarioproyecto: number, datos: DatosContacto): Promise<unknown> {
  return mutar((lista) => {
    const acta = porProyecto(lista, id_proyecto)
    exigir(acta.estado === 'en elaboracion', 'El acta ya fue generada: los datos de contacto no se pueden modificar.')
    const p = acta.participantes.find((x) => x.id_usuarioproyecto === id_usuarioproyecto)
    exigir(p, 'El participante no pertenece al proyecto.')
    Object.assign(p!, datos)
    return acta
  })
}

/** POST /acta-inicio/:id/generar — genera el PDF INV-IC-FR-017 y deja el acta "en firma".
 * Responde 422 con `faltantes` si algo está incompleto. */
export function generarActaInicio(id_acta_inicio: number): Promise<unknown> {
  return mutar((lista) => {
    const acta = porActa(lista, id_acta_inicio)
    exigir(acta.estado === 'en elaboracion', 'El acta ya fue generada.')
    const bloqueos = bloqueosGeneracion(acta)
    exigir(bloqueos.length === 0, 'El acta no se puede generar todavía.', bloqueos)
    // Orden de firma del formato: Investigador Principal, Co-Investigadores y de último el Vicerrector.
    const investigadores = [...acta.participantes].sort((a, b) => Number(esPrincipal(b.rol)) - Number(esPrincipal(a.rol)))
    acta.firmas = [
      ...investigadores.map((p, i) => ({
        id_firma: Date.now() + i,
        id_usuario: p.id_usuario,
        nombre: p.nombre,
        rol_firmante: (esPrincipal(p.rol) ? 'investigador principal' : 'co-investigador') as RolFirmante,
        orden_firma: i + 1,
        firmado: false,
        fecha_firma: null,
      })),
      {
        id_firma: Date.now() + investigadores.length,
        id_usuario: 0,
        nombre: 'Vicerrector de Investigación y Extensión',
        rol_firmante: 'Vicerrector' as RolFirmante,
        orden_firma: investigadores.length + 1,
        firmado: false,
        fecha_firma: null,
      },
    ]
    acta.estado = 'en firma'
    acta.tiene_archivo_generado = true
    return acta
  })
}

/** POST /acta-inicio/:id/reabrir — devuelve a "en elaboración" un acta que aún no se ha
 * legalizado, para corregir sus datos. Borra las firmas y aceptaciones: hay que volver a generarla. */
export function reabrirActaInicio(id_acta_inicio: number): Promise<unknown> {
  return mutar((lista) => {
    const acta = porActa(lista, id_acta_inicio)
    exigir(acta.estado === 'en firma', acta.estado === 'legalizada' ? 'El acta ya está legalizada y no se puede modificar.' : 'El acta ya está en elaboración.')
    acta.estado = 'en elaboracion'
    acta.firmas = []
    acta.compromisos = []
    acta.tiene_archivo_generado = false
    return acta
  })
}

/** Solo modo prueba: vuelve a las actas de ejemplo. */
export function reiniciarDatosPrueba(): Promise<void> {
  reiniciarActas()
  return Promise.resolve()
}

/** POST /acta-inicio/:id/compromisos — numerales 5, 7, 8 y 9. El backend toma al
 * participante de la sesión; en modo prueba se indica con `id_usuarioproyecto`. */
export function aceptarCompromisos(id_acta_inicio: number, version_texto: string, clausulas: TipoClausula[], id_usuarioproyecto: number): Promise<unknown> {
  return mutar((lista) => {
    const acta = porActa(lista, id_acta_inicio)
    exigir(acta.estado === 'en firma', 'El acta no está en firma.')
    exigir(acta.participantes.some((p) => p.id_usuarioproyecto === id_usuarioproyecto), 'El participante no pertenece al proyecto.')
    const fecha = new Date().toISOString()
    for (const tipo_clausula of clausulas) {
      const yaAceptada = acta.compromisos.some((c) => c.id_usuarioproyecto === id_usuarioproyecto && c.tipo_clausula === tipo_clausula && c.aceptado)
      if (!yaAceptada) acta.compromisos.push({ id_usuarioproyecto, tipo_clausula, version_texto, aceptado: true, fecha_aceptacion: fecha })
    }
    return acta
  })
}

/** POST /acta-inicio/:id/firmar — firma quien tiene el turno (orden_firma). Cada
 * investigador debe haber aceptado sus cláusulas; el Vicerrector firma cuando todos aceptaron.
 * Con la última firma el acta queda legalizada (HU-90, 91). */
export function firmarActaInicio(id_acta_inicio: number): Promise<unknown> {
  return mutar((lista) => {
    const acta = porActa(lista, id_acta_inicio)
    exigir(acta.estado === 'en firma', 'El acta no está en firma.')
    const proxima = siguienteFirma(acta)
    exigir(proxima, 'El acta ya tiene todas las firmas.')
    const participante = acta.participantes.find((p) => p.id_usuario === proxima!.id_usuario)
    const quienes = participante ? [participante] : acta.participantes
    exigir(
      quienes.every((p) => clausulasPendientes(acta, p.id_usuarioproyecto).length === 0),
      'Faltan compromisos por aceptar antes de esta firma.'
    )
    const firma = acta.firmas.find((f) => f.id_firma === proxima!.id_firma)!
    firma.firmado = true
    firma.fecha_firma = new Date().toISOString()
    if (!siguienteFirma(acta)) legalizar(acta)
    return acta
  })
}

/** Legaliza el acta: el proyecto pasa a "En ejecución" y entra a la etapa de seguimiento
 * con sus vigencias y periodos de informe. Como las firmas son electrónicas, el acta firmada
 * es el mismo PDF del sistema con la constancia de cada firma: no se carga ningún archivo. */
function legalizar(acta: ActaGuardada): void {
  acta.estado = 'legalizada'
  acta.estado_proyecto = 'En ejecución'
  acta.tiene_archivo_firmado = true
  acta.archivo_firmado_nombre = null
  acta.fecha_legalizacion = new Date().toISOString()
  const principal = acta.participantes.find((p) => esPrincipal(p.rol))
  const coInvestigadores = acta.participantes.filter((p) => !esPrincipal(p.rol))
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
    convocatoria: acta.convocatoria ?? '',
    participantes: acta.participantes.map((p) => `${p.rol} · ${p.nombre}`),
  })
}

/** GET /acta-inicio/:id/descarga?tipo= — en modo prueba el PDF se arma en el navegador
 * con los datos guardados; el archivo firmado que se cargó no se almacena. */
export async function descargarActa(id_acta_inicio: number, _tipo: 'generado' | 'firmado', nombre: string): Promise<void> {
  const acta = porActa(leerActas(), id_acta_inicio)
  // Import dinámico: jsPDF solo se descarga cuando alguien pide el PDF.
  const { generarPdfActa } = await import('../lib/pdfActa')
  ;(await generarPdfActa(acta)).save(nombre)
}
