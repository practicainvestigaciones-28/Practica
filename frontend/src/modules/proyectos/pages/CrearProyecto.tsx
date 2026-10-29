import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { Save, Plus, Upload, X, ArrowLeft, CheckCircle2, Send, Loader2 } from 'lucide-react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { es } from 'date-fns/locale/es'
import 'react-datepicker/dist/react-datepicker.css'
import './CrearProyecto.css'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import * as convocatoriasApi from '../../convocatorias/lib/convocatorias'
import * as convocatoriaOpcionesApi from '../../convocatorias/api/convocatoriaOpciones'
import { extraerNumeroDePeriodo } from '../../convocatorias/lib/periodos'
import {
  getLimite,
  setLimite,
  setLimiteAntecedentes,
  contarPalabras,
  type ClaveLimiteTexto,
} from '../lib/limitesTexto'
import { enumerarAntecedentes, separarAntecedentes } from '../lib/antecedentes'
import { mapearCategoriasBackend, type CategoriaProductoLocal, type TipoProductoLocal } from '../lib/productosInvestigacion'
import {
  PAISES,
  DEPARTAMENTOS_COLOMBIA,
  MUNICIPIOS_POR_DEPARTAMENTO,
  TIPOS_DOCUMENTO_COLOMBIA,
  CATEGORIAS_MINCIENCIAS,
} from '../lib/ubicaciones'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as gruposApi from '../api/grupos'
import * as usuariosApi from '../../usuarios/api/usuarios'
import * as productosApi from '../api/productos'
import * as tiposDocumentoApi from '../api/tiposDocumento'
import * as documentosApi from '../api/documentos'
import { useAuth } from '../../auth/context/AuthContext'
import * as proyectosApi from '../api/proyectos'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as firmasProyectoApi from '../api/firmasProyecto'
import { ApiError } from '../../../shared/api/client'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

registerLocale('es', es)

// El formulario guarda la fecha de nacimiento como "AAAA-MM-DD" (igual que el
// <input type="date"> anterior); estas dos conversiones evitan que, al pasar
// por un objeto Date, la zona horaria local corra el día un día hacia atrás.
function fechaStringADate(valor: string): Date | null {
  if (!valor) return null
  const [anio, mes, dia] = valor.split('-').map(Number)
  if (!anio || !mes || !dia) return null
  return new Date(anio, mes - 1, dia)
}

function dateAFechaString(fecha: Date | null): string {
  if (!fecha) return ''
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

// Dedicación (horas semanales) de investigadores/egresados en Grupos y Egresados: tope silencioso,
// sin aviso ni letrero, porque sin límite el valor se desborda en la tabla.
function limitarHoras(valor: string): string {
  if (valor === '') return ''
  const n = Number(valor)
  if (Number.isNaN(n)) return valor
  return String(Math.min(30, Math.max(0, n)))
}

/** Nacionalidad: solo letras (con acentos/ñ) y espacios — nada de números ni símbolos. */
function soloLetras(valor: string): string {
  return valor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
}

/** Pone en mayúscula únicamente la primera letra del campo; el resto queda tal como se escribió. */
function capitalizarPrimera(valor: string): string {
  return valor.length > 0 ? valor.charAt(0).toUpperCase() + valor.slice(1) : valor
}

// Nombres tal como los usa el backend en firmas-proyecto.service.ts — deben coincidir exactamente.
const ROL_FIRMA_PRINCIPAL = 'Investigador(a) Principal UNICESMAG'
const ROL_FIRMA_COINVESTIGADOR = 'Co investigador(a) UNICESMAG'

function formatearFechaFirma(fecha: string): string {
  const d = new Date(fecha)
  const dia = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  const hora = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dia}, ${hora}`
}

/** Hace que un <textarea> crezca en alto a medida que se escribe, en vez de quedarse con scroll interno. */
function ajustarAlturaTextarea(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** <textarea> que se ajusta a todo su contenido (al escribir, al pegar y cuando el valor llega ya cargado). */
function TextareaAutoajustable(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => ajustarAlturaTextarea(ref.current), [props.value])
  return <textarea ref={ref} {...props} className={`${props.className ?? ''} cp-textarea-autoajustable`} />
}

/**
 * Documentos que se cargan en "Firmas y anexos" — igual al catálogo real de
 * CESMAG. El nombre debe coincidir EXACTO con el `nombre` sembrado en
 * TipoDocumento (ver backend/prisma/seed.ts) para poder resolver su
 * id_tipo_documento al subir el archivo.
 *
 * "Acta de compromiso estudiantes auxiliares o asistentes" no aparece en esta
 * lista: se carga una por cada estudiante auxiliar/asistente agregado (ver
 * NOMBRE_DOCUMENTO_ACTA_COMPROMISO y archivosActaCompromiso más abajo).
 */
const DOCUMENTOS_FIRMAS: { nombre: string; obligatorio: boolean }[] = [
  { nombre: 'Presupuesto Proyectos de Investigación', obligatorio: true },
  { nombre: 'Consentimiento informado', obligatorio: false },
  { nombre: 'Asentimiento informado', obligatorio: false },
  { nombre: 'Carta de Intención', obligatorio: false },
]

const NOMBRE_DOCUMENTO_ACTA_COMPROMISO = 'Acta de compromiso estudiantes auxiliares o asistentes'

// Claves que tienen un valor por defecto (o son solo identificadores/estado de
// navegación) aunque la persona no haya escrito nada.
const CLAVES_SIN_CONTENIDO_BORRADOR = new Set(['id', 'pais', 'anio', 'tab', 'tabsDesbloqueadas', 'maxTabIndexDesbloqueado'])

/** ¿El borrador tiene algo que la persona realmente diligenció? */
export function borradorTieneContenido(valor: unknown, clave = ''): boolean {
  if (CLAVES_SIN_CONTENIDO_BORRADOR.has(clave)) return false
  if (typeof valor === 'string') return valor.trim() !== ''
  if (typeof valor === 'number') return true
  if (typeof valor === 'boolean') return valor
  if (Array.isArray(valor)) return valor.some((v) => borradorTieneContenido(v))
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).some(([k, v]) => borradorTieneContenido(v, k))
  }
  return false
}

function formatearMiles(valor: string): string {
  const digitos = soloDigitos(valor)
  if (!digitos) return ''
  return Number(digitos).toLocaleString('es-CO')
}

type Tab =
  | 'hojasvida'
  | 'general'
  | 'grupos'
  | 'formulacion'
  | 'marco'
  | 'cronograma'
  | 'resultados'
  | 'etico'
  | 'firmas'

type CampoHojaVida = Exclude<keyof HojaDeVida, 'id' | 'rol'>

const tabs: { id: Tab; label: string }[] = [
  { id: 'hojasvida', label: 'Hojas de vida' },
  { id: 'general', label: 'Información general' },
  { id: 'grupos', label: 'Grupos y egresados' },
  { id: 'formulacion', label: 'Formulación del proyecto' },
  { id: 'marco', label: 'Marco teórico y metodología' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'resultados', label: 'Resultados esperados' },
  { id: 'etico', label: 'Componente ético' },
  { id: 'firmas', label: 'Firmas y anexos' },
]

interface Bloque {
  id: number
}

interface ItemLista {
  id: number
  texto: string
}

export interface DatosGeneral {
  titulo: string
  idModalidad: number | null
  idArea: number | null
  // Ya no hay campo de texto libre "Otro": el catálogo de programas lo
  // gestiona el Administrador (ver ProgramasAcademicos.tsx), así que
  // cualquier programa real ya está en este desplegable.
  // El proyecto puede articularse con más de un programa académico.
  idProgramas: number[]
  pais: string
  // Solo se usa si el proyecto se ejecuta fuera de Colombia (el país por
  // defecto es fijo). Si tiene valor, reemplaza a "pais" para efectos de
  // qué lista de departamento/ciudad mostrar.
  otroPais: string
  ciudad: string
  departamento: string
  idTipoProyecto: number | null
  valorSolicitado: string
  valorContrapartida: string
  duracion: string
}

export type CampoGeneral =
  | 'titulo'
  | 'modalidad'
  | 'tipo'
  | 'ciudad'
  | 'departamento'
  | 'duracion'
  | 'programa'
  | 'resumen'
  | 'planteamiento'
  | 'pregunta'
  | 'justificacion'
  | 'marcoTeorico'
  | 'metodologia'
  | 'componenteEtico'
  | 'funcionesEstudiante'
  | 'rolEstudiante'
  | 'correoEstudiante'

/** A qué pestaña saltar cuando este campo aparece marcado como faltante. */
const CAMPO_A_TAB: Record<CampoGeneral, Tab> = {
  titulo: 'general',
  modalidad: 'general',
  tipo: 'general',
  ciudad: 'general',
  departamento: 'general',
  duracion: 'general',
  programa: 'general',
  rolEstudiante: 'general',
  correoEstudiante: 'general',
  resumen: 'formulacion',
  planteamiento: 'formulacion',
  pregunta: 'formulacion',
  justificacion: 'formulacion',
  marcoTeorico: 'marco',
  metodologia: 'marco',
  componenteEtico: 'etico',
  funcionesEstudiante: 'etico',
}

const ETIQUETAS_CAMPO_GENERAL: Record<CampoGeneral, string> = {
  titulo: 'Título del proyecto',
  modalidad: 'Modalidad',
  tipo: 'Tipo de proyecto',
  ciudad: 'Ciudad',
  departamento: 'Departamento',
  duracion: 'Duración',
  programa: 'Programa académico',
  resumen: 'Resumen',
  planteamiento: 'Planteamiento del problema',
  pregunta: 'Pregunta de investigación',
  justificacion: 'Justificación',
  marcoTeorico: 'Marco teórico',
  metodologia: 'Metodología',
  componenteEtico: 'Componente ético',
  funcionesEstudiante: 'Funciones del estudiante auxiliar',
  rolEstudiante: 'Rol del estudiante (Auxiliar/Asistente)',
  correoEstudiante: 'Correo del estudiante',
}

const ETIQUETAS_CAMPO_HOJA_VIDA: Record<CampoHojaVida, string> = {
  nombres: 'Nombres (hoja de vida)',
  apellidos: 'Apellidos (hoja de vida)',
  correo: 'Correo institucional (hoja de vida)',
  correoPersonal: 'Correo personal (hoja de vida)',
  lugarNacimiento: 'Lugar de nacimiento (hoja de vida)',
  fechaNacimiento: 'Fecha de nacimiento (hoja de vida)',
  nacionalidad: 'Nacionalidad (hoja de vida)',
  tipoDocumento: 'Tipo de documento (hoja de vida)',
  numeroDocumento: 'Número de documento (hoja de vida)',
  direccion: 'Dirección (hoja de vida)',
  telefono: 'Teléfono (hoja de vida)',
  celular: 'Celular (hoja de vida)',
  orcid: 'ORCID (hoja de vida)',
  googleAcademico: 'Google Académico (hoja de vida)',
  categoriaMinciencias: 'Categoría Minciencias (hoja de vida)',
  cargoActual: 'Cargo actual (hoja de vida)',
  cargosDesempenados: 'Cargos desempeñados (hoja de vida)',
  titulosAcademicos: 'Títulos académicos (hoja de vida)',
  produccionCientifica: 'Producción científica (hoja de vida)',
}

/** Traduce el nombre de campo que devuelve el backend (snake_case) al campo local. */
const BACKEND_A_CAMPO: Partial<Record<string, CampoGeneral>> = {
  titulo: 'titulo',
  ciudad: 'ciudad',
  departamento: 'departamento',
  duracion_periodos: 'duracion',
  resumen: 'resumen',
  planteamiento_problema: 'planteamiento',
  pregunta_investigacion: 'pregunta',
  justificacion: 'justificacion',
  marco_teorico: 'marcoTeorico',
  metodologia_preliminar: 'metodologia',
  componente_etico: 'componenteEtico',
  funciones_estudiante_auxiliar: 'funcionesEstudiante',
}

const datosGeneralIniciales: DatosGeneral = {
  titulo: '',
  idModalidad: null,
  idArea: null,
  idProgramas: [],
  pais: 'Colombia',
  otroPais: '',
  ciudad: '',
  departamento: '',
  idTipoProyecto: null,
  valorSolicitado: '',
  valorContrapartida: '',
  duracion: '',
}

/**
 * Un borrador local guardado ANTES de que "programa" pasara a ser múltiple
 * (idPrograma: number|null -> idProgramas: number[]) todavía tiene el campo
 * viejo — sin esto, restaurarlo deja idProgramas en undefined y cualquier
 * .map()/.filter() sobre ese campo revienta el render (pantalla en blanco,
 * sin ningún error visible porque no hay un ErrorBoundary).
 */
function normalizarDatosGeneralBorrador(valor: unknown): DatosGeneral {
  if (!valor || typeof valor !== 'object') return datosGeneralIniciales
  const d = valor as Partial<DatosGeneral> & { idPrograma?: number | null }
  return {
    ...datosGeneralIniciales,
    ...d,
    idProgramas: Array.isArray(d.idProgramas)
      ? d.idProgramas
      : typeof d.idPrograma === 'number'
        ? [d.idPrograma]
        : [],
  }
}

export interface DatosTexto {
  resumen: string
  planteamiento: string
  pregunta: string
  justificacion: string
  objetivoGeneral: string
  /** Antecedentes enumerados (1., 2., ...) — se reparten en registros individuales al guardar (ver separarAntecedentes). */
  antecedentes: string
  marcoTeorico: string
  metodologia: string
  componenteEtico: string
  implicacionesEticas: string
  fuentesFinanciacion: string
  permisosLicencias: string
  funcionesEstudiante: string
  /** Una referencia por línea — se reparte en registros individuales al guardar (ver guardarProyecto). */
  referencias: string
}

const datosTextoIniciales: DatosTexto = {
  resumen: '',
  planteamiento: '',
  pregunta: '',
  justificacion: '',
  objetivoGeneral: '',
  antecedentes: '',
  marcoTeorico: '',
  metodologia: '',
  componenteEtico: '',
  implicacionesEticas: '',
  fuentesFinanciacion: '',
  permisosLicencias: '',
  funcionesEstudiante: '',
  referencias: '',
}

interface ImpactoPorObjetivo {
  impactoEsperado: string
  beneficiarioPotencial: string
  indicadorVerificable: string
}

interface GrupoSeleccionado {
  id: number
  nombre: string

  // Solo aplica al grupo CESMAG (interno): id del grupo ya existente en el
  // catálogo institucional que se seleccionó. Ya no se "crea" un grupo nuevo
  // al guardar — su información general la administra el líder del grupo
  // (ver GrupoInformacionGeneralForm), así que aquí solo se elige y se
  // muestra de solo lectura.
  idGrupoExistente: number | null
  /** Grupo EXTERNO ya registrado para este proyecto: se actualiza en vez de crear otra copia en el catálogo. */
  idGrupoExterno: number | null

  // "facultad"/"programa" (texto libre) solo aplican al grupo EXTERNO — una
  // universidad/entidad de afuera no está en nuestro catálogo. Para el grupo
  // CESMAG (interno) se usan los catálogos reales: idFacultad/idPrograma.
  facultad: string
  idFacultad: number | null

  programa: string
  idPrograma: number | null

  lider: string
  /** Grupo EXTERNO: dedicación (TC/MT) del director del grupo. */
  idDedicacionDirector: number | null
  codGruplac: string
  reconocidoMinciencias: boolean
  categoria: string
  acuerdoInstitucional: string

  // Grupo CESMAG (interno): una o más líneas de NUESTRO catálogo real.
  idsLinea: number[]

  // Grupo EXTERNO: texto libre (no tenemos el catálogo institucional de otras
  // entidades), y puede ser más de una de cada una.
  lineasExternas: string[]
  lineasMedulares: string[]

  idsOds: number[]
  investigadoresExtra: SlotParticipante[]
}

const grupoSeleccionadoVacio = (id: number): GrupoSeleccionado => ({
  id,
  nombre: '',
  idGrupoExistente: null,
  idGrupoExterno: null,
  facultad: '',
  idFacultad: null,
  programa: '',
  idPrograma: null,
  lider: '',
  idDedicacionDirector: null,
  codGruplac: '',
  reconocidoMinciencias: false,
  categoria: '',
  acuerdoInstitucional: '',
  idsLinea: [],
  lineasExternas: [''],
  lineasMedulares: [''],
  idsOds: [],
  investigadoresExtra: [slotVacio()],
})

/**
 * Un borrador local guardado ANTES de que "ODS del grupo" pasara a ser
 * múltiple (idOds: number|null -> idsOds: number[]), o antes de que
 * existiera "seleccionar el grupo del catálogo" (idGrupoExistente), todavía
 * tiene esos campos en el formato viejo o sin diligenciar. Sin esto,
 * restaurarlo deja idsOds en undefined y SelectorOdsMultiple revienta en el
 * primer render (ids.includes/.length sobre undefined) — pantalla en
 * blanco, sin ningún error visible porque no hay un ErrorBoundary.
 */
function normalizarGrupoSeleccionadoBorrador(valor: unknown): GrupoSeleccionado {
  if (!valor || typeof valor !== 'object') return grupoSeleccionadoVacio(Date.now() + Math.random())
  const g = valor as Partial<GrupoSeleccionado> & {
    idOds?: number | null
    // Formato viejo, de antes de que línea de investigación/línea medular pasaran a ser múltiples.
    idLinea?: number | null
    lineaMedular?: string
  }
  return {
    ...grupoSeleccionadoVacio(typeof g.id === 'number' ? g.id : Date.now() + Math.random()),
    ...g,
    idsOds: Array.isArray(g.idsOds) ? g.idsOds : typeof g.idOds === 'number' ? [g.idOds] : [],
    idsLinea: Array.isArray(g.idsLinea) ? g.idsLinea : typeof g.idLinea === 'number' ? [g.idLinea] : [],
    lineasExternas: Array.isArray(g.lineasExternas) && g.lineasExternas.length > 0 ? g.lineasExternas : [''],
    lineasMedulares:
      Array.isArray(g.lineasMedulares) && g.lineasMedulares.length > 0
        ? g.lineasMedulares
        : g.lineaMedular
          ? [g.lineaMedular]
          : [''],
    investigadoresExtra:
      Array.isArray(g.investigadoresExtra) && g.investigadoresExtra.length > 0
        ? g.investigadoresExtra
        : [slotVacio()],
  }
}

/** "INFORMACIÓN GENERAL DE EGRESADOS(AS)" (pestaña Grupos): una facultad/
 * programa/empresa y sus integrantes en texto libre (nombre completo + horas).
 * Se guarda tal cual; los egresados que participan y firman salen de
 * Información general. */
interface EgresadosSeccion {
  idFacultad: number | null
  idPrograma: number | null
  empresa: string
  integrantes: SlotParticipante[]
}

const egresadosSeccionVacia = (): EgresadosSeccion => ({
  idFacultad: null,
  idPrograma: null,
  empresa: '',
  integrantes: [slotVacio()],
})

/** Borradores de antes guardaban una lista de bloques con nombres/apellidos/correo: se toma el primero. */
function normalizarEgresadosBorrador(valor: unknown): EgresadosSeccion {
  if (Array.isArray(valor)) {
    const viejos = valor as { nombres?: string; apellidos?: string; idFacultad?: number | null; idPrograma?: number | null; empresa?: string; horasSemanales?: string }[]
    const primero = viejos[0] ?? {}
    const integrantes = viejos
      .map((v) => ({ ...slotVacio(), nombreCompleto: `${v.nombres ?? ''} ${v.apellidos ?? ''}`.trim(), horasSemanales: v.horasSemanales ?? '' }))
      .filter((i) => i.nombreCompleto)
    return {
      idFacultad: primero.idFacultad ?? null,
      idPrograma: primero.idPrograma ?? null,
      empresa: primero.empresa ?? '',
      integrantes: integrantes.length > 0 ? integrantes : [slotVacio()],
    }
  }
  if (valor && typeof valor === 'object') {
    const v = valor as Partial<EgresadosSeccion>
    return { ...egresadosSeccionVacia(), ...v, integrantes: Array.isArray(v.integrantes) && v.integrantes.length > 0 ? v.integrantes : [slotVacio()] }
  }
  return egresadosSeccionVacia()
}

interface SlotParticipante {
  // Texto libre (no busca cuentas existentes): tanto en grupos UNICESMAG como
  // en grupos externos no hay un catálogo contra el cual filtrar a la persona
  // (menos aún a un profesor externo), así que se escribe a mano. Solo pide
  // el nombre para asignarle la dedicación; sin correo, el backend lo guarda
  // siempre como dato plano, nunca intenta vincularlo a una cuenta existente
  // (ver participantes.service.ts).
  nombreCompleto: string
  // Horas semanales dedicadas al proyecto, en texto libre — usado por
  // InvestigadoresMiniTable (grupos CESMAG/externo); no se pide la categoría
  // TC/MT/HC ahí, esa queda con un valor por defecto al guardar.
  horasSemanales: string
  // ORCID/Google Académico reportados para este proyecto (ver nota en
  // backend: UsuarioProyecto.orcid). No prellenan desde la Hoja de Vida
  // maestra del usuario — un investigador no tiene permiso para editar la
  // ficha de otra persona, así que esto queda como dato propio del proyecto.
  orcid: string
  googleAcademico: string
}

const slotVacio = (): SlotParticipante => ({
  nombreCompleto: '',
  horasSemanales: '',
  orcid: '',
  googleAcademico: '',
})

/** Participante de "Información general" escrito a mano (no busca cuentas
 * existentes): el backend decide solo si lo vincula a una cuenta existente
 * por correo, o lo guarda como texto plano (ver participantes.service.ts). */
interface ParticipanteManual {
  nombres: string
  apellidos: string
  correo: string
  idDedicacion: number | null
  // ORCID/Google Académico reportados para este proyecto (ver nota en
  // backend: UsuarioProyecto.orcid) — es un snapshot propio del proyecto,
  // no la Hoja de Vida maestra de esa persona (un investigador no tiene
  // permiso para editar la ficha de otra persona). Para el principal y el
  // co-investigador SÍ se autocompleta desde las 2 primeras fichas de
  // "Hoja de vida" (ver el useEffect junto a participantesPorGrupo) — para
  // externos/egresados/estudiantes se sigue escribiendo aparte.
  orcid: string
  googleAcademico: string
}

interface GrupoParticipantes {
  id: number
  principal: ParticipanteManual
  coInvestigador: ParticipanteManual
  externo1: ParticipanteManual
  externo2: ParticipanteManual
  egresado1: ParticipanteManual
  egresado2: ParticipanteManual

  cedulaEgresado1: string
  cedulaEgresado2: string
}

const participanteManualVacio = (): ParticipanteManual => ({
  nombres: '',
  apellidos: '',
  correo: '',
  idDedicacion: null,
  orcid: '',
  googleAcademico: '',
})

const crearGrupoParticipantesVacio = (id: number): GrupoParticipantes => ({
  id,
  principal: participanteManualVacio(),
  coInvestigador: participanteManualVacio(),
  externo1: participanteManualVacio(),
  externo2: participanteManualVacio(),
  egresado1: participanteManualVacio(),
  egresado2: participanteManualVacio(),
  cedulaEgresado1: '',
  cedulaEgresado2: '',
})

interface EstudianteSlot {
  nombres: string
  apellidos: string
  correo: string
  idRolEstudiante: number | null

  codigo: string
}

const estudianteSlotVacio = (): EstudianteSlot => ({
  nombres: '',
  apellidos: '',
  correo: '',
  idRolEstudiante: null,
  codigo: '',
})

/** IDs reales ya guardados en el servidor para un proyecto que se está
 * editando — se usan para borrarlos antes de volver a crearlos desde el
 * formulario (ver guardarFirmasYFinalizar). Objetivos/antecedentes/
 * referencias/cronograma/productos se limpian siempre; documentos NO (cargar
 * uno nuevo es aditivo, no hace falta borrar los que ya existían). */
interface IdsExistentesEdicion {
  participantes: number[]
  areas: number[]
  programas: number[]
  grupos: number[]
  objetivos: number[]
  antecedentes: number[]
  referencias: number[]
  actividades: number[]
  productos: number[]
}

/** Puede pasar que la misma persona quede seleccionada en más de un lugar del
 * formulario a la vez (ej. como co-investigador en "Información general" y
 * además como investigador extra de un grupo, o como egresado y también
 * miembro de un grupo) — la segunda vez que se intenta registrar como
 * participante, el backend responde 409 porque ya quedó vinculada por la
 * primera. Se ignora ese caso puntual en vez de tumbar todo el guardado. */
async function ignorarSiYaEsParticipante<T>(promesa: Promise<T>): Promise<T | null> {
  try {
    return await promesa
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) return null
    throw err
  }
}

function idsExistentesVacio(): IdsExistentesEdicion {
  return { participantes: [], areas: [], programas: [], grupos: [], objetivos: [], antecedentes: [], referencias: [], actividades: [], productos: [] }
}

/** Consulta qué subrecursos tiene YA guardados un proyecto en el servidor.
 * Se usa al reintentar guardar un proyecto nuevo cuyo primer intento alcanzó
 * a crear el proyecto (y quizás algunos subrecursos) antes de fallar: sin
 * esto, el reintento los vuelve a crear y choca con "ya existe" (participante
 * ya registrado, área ya asociada, etc.). */
async function obtenerSubRecursosExistentes(idProyecto: number): Promise<IdsExistentesEdicion> {
  const [participantesRes, areasRes, programasRes, gruposRes, objetivosRes, antecedentesRes, referenciasRes, actividadesRes, productosRes] =
    await Promise.all([
      proyectosApi.listarParticipantes(idProyecto),
      proyectosApi.listarAreasProyecto(idProyecto),
      proyectosApi.listarProgramasProyecto(idProyecto),
      proyectosApi.listarGruposDelProyecto(idProyecto),
      proyectosApi.listarObjetivosProyecto(idProyecto),
      proyectosApi.listarAntecedentesProyecto(idProyecto),
      proyectosApi.listarReferenciasProyecto(idProyecto),
      proyectosApi.listarActividadesCronograma(idProyecto),
      proyectosApi.listarProductosProyecto(idProyecto),
    ])
  return {
    participantes: participantesRes.map((p) => p.id_usuarioproyecto),
    areas: areasRes.map((a) => a.id_proyecto_area),
    programas: programasRes.map((p) => p.id_proyecto_programas),
    grupos: gruposRes.map((g) => g.id_proyecto_grupo),
    objetivos: objetivosRes.map((o) => o.id_objetivo),
    antecedentes: antecedentesRes.map((a) => a.id_antecedente),
    referencias: referenciasRes.map((r) => r.id_referencia),
    actividades: actividadesRes.map((a) => a.id_actividad),
    productos: productosRes.map((p) => p.id_proyecto_producto),
  }
}

function CrearProyecto() {
  const { id: idParaEditar } = useParams<{ id: string }>()
  const modoEdicion = idParaEditar != null
  const location = useLocation()
  // Al salir del formulario (guardado o volver) se REEMPLAZA la entrada del
  // historial: así la flecha "Volver" de la vista del proyecto lleva a la
  // lista de Proyectos y no de regreso a este formulario de edición.
  const salirDelFormulario = () =>
    navigate(modoEdicion ? `/proyectos/ver/${idParaEditar}` : '/proyectos', {
      replace: true,
      state: { volverA: '/proyectos' },
    })
  // "Continuar con las firmas" (VerProyecto) abre la edición directo en esa pestaña.
  const [tab, setTab] = useState<Tab>(() => (location.state as { tab?: Tab } | null)?.tab ?? 'hojasvida')
  const navigate = useNavigate()
  const { usuario } = useAuth()

  // --- Modo edición: cargar un proyecto ya existente (ver más abajo) ---
  const [cargandoEdicion, setCargandoEdicion] = useState(modoEdicion)
  const [errorCargaEdicion, setErrorCargaEdicion] = useState('')
  // Cuántos documentos de cada tipo (por nombre) ya existen en el servidor —
  // por tipo y no solo un total, porque "¿ya existe ALGÚN documento?" dejaba
  // pasar proyectos a los que de verdad les faltaban las actas de
  // compromiso de los estudiantes, solo porque había otro documento de un
  // tipo distinto ya cargado (ver documentosObligatoriosFaltantes).
  const [documentosExistentesPorTipo, setDocumentosExistentesPorTipo] = useState<Record<string, number>>({})
  const idsExistentesRef = useRef<IdsExistentesEdicion>(idsExistentesVacio())
  const cargaEdicionHechaRef = useRef(false)
  // Si el proyecto que se edita estaba "Aprobado con correcciones", al
  // terminar de guardar hay que reenviarlo con reenviarCorrecciones (no solo
  // guardar los campos) para que quede reasignado a quien debe revisar los
  // cambios. Null si no aplica (ej. se estaba editando un "Rechazado").
  const reenvioCorreccionesRef = useRef<{ id_etapa: number } | null>(null)

  const grupos: Bloque[] = [{ id: 1 }]
  const [participantesPorGrupo, setParticipantesPorGrupo] = useState<GrupoParticipantes[]>([
    crearGrupoParticipantesVacio(1),
  ])
  const [estudiantesInvestigadores, setEstudiantesInvestigadores] = useState<EstudianteSlot[]>([
    estudianteSlotVacio(),
  ])

  const [objetivosEspecificos, setObjetivosEspecificos] = useState<ItemLista[]>([
    { id: 1, texto: '' },
    { id: 2, texto: '' },
    { id: 3, texto: '' },
  ])
  const [datosTexto, setDatosTexto] = useState<DatosTexto>(datosTextoIniciales)
  const [impactos, setImpactos] = useState<Record<number, ImpactoPorObjetivo>>({})
  // El formato institucional trae espacio para 2 grupos internos UNICESMAG
  // desde el inicio (igual se puede añadir más con "Añadir otro grupo UNICESMAG").
  const [gruposCesmagSel, setGruposCesmagSel] = useState<GrupoSeleccionado[]>([
    grupoSeleccionadoVacio(1),
    grupoSeleccionadoVacio(2),
  ])
  const [gruposExternosSel, setGruposExternosSel] = useState<GrupoSeleccionado[]>([grupoSeleccionadoVacio(1)])
  const [cronogramas, setCronogramas] = useState<CronogramaBloque[]>([
    { id: 1, actividades: [crearActividadVacia()] },
  ])
  const [egresadosInfo, setEgresadosInfo] = useState<EgresadosSeccion>(egresadosSeccionVacia)
  const [tiposDocumento, setTiposDocumento] = useState<tiposDocumentoApi.TipoDocumentoItem[]>([])
  // Grupos UNICESMAG (internos) ya existentes en el catálogo institucional —
  // ahora se eligen de aquí en vez de escribirse a mano (ver CamposGrupoManual).
  const [gruposInternosDisponibles, setGruposInternosDisponibles] = useState<gruposApi.GrupoInvestigacionItem[]>([])
  const [archivosDocumentos, setArchivosDocumentos] = useState<Record<string, File | null>>({})
  // Una posición por cada estudiante de estudiantesInvestigadores (mismo índice).
  const [archivosActaCompromiso, setArchivosActaCompromiso] = useState<(File | null)[]>([null])
  // Solo se ponen en rojo después de un intento de guardado fallido — no desde
  // que se abre la pestaña, para no regañar antes de que la persona intente nada.
  const [mostrarErrorDocumentos, setMostrarErrorDocumentos] = useState(false)
  const [mostrarErrorProductosObligatorios, setMostrarErrorProductosObligatorios] = useState(false)
  const [hojasVida, setHojasVida] = useState<HojaDeVida[]>([crearHojaVidaVacia('principal')])

  // El ORCID/Google Académico de la Hoja de Vida (investigador principal) se
  // reflejan automáticamente en su fila de "Información general" — la persona
  // es la misma, no tiene sentido escribirlo dos veces.
  // "Información general" no pide escribir dos veces lo que ya se dio en
  // "Hoja de vida": la ficha de rol "principal" autocompleta al Investigador(a)
  // Principal, la de rol "coinvestigador" al Co investigador(a) UNICESMAG, y
  // la de rol "externo" al primer Co investigador(a) Externo(a). Egresados y
  // estudiantes sí se siguen escribiendo aparte porque piden datos que la Hoja
  // de vida no tiene (facultad, empresa, etc.).
  useEffect(() => {
    const principal = hojasVida.find((h) => h.rol === 'principal')
    const coInvestigador = hojasVida.find((h) => h.rol === 'coinvestigador')
    // Puede haber hasta 2 externos (externo1/externo2 en "Información
    // general") — se emparejan por orden entre ellos mismos, no por posición
    // dentro de hojasVida, así que quitar uno no desordena al otro.
    const externos = hojasVida.filter((h) => h.rol === 'externo')
    const externo1 = externos[0]
    const externo2 = externos[1]
    setParticipantesPorGrupo((actual) =>
      actual.map((g, i) => {
        if (i !== 0) return g
        return {
          ...g,
          principal: principal
            ? {
                ...g.principal,
                nombres: principal.nombres,
                apellidos: principal.apellidos,
                correo: principal.correo,
                orcid: principal.orcid,
                googleAcademico: principal.googleAcademico,
              }
            : g.principal,
          coInvestigador: coInvestigador
            ? {
                ...g.coInvestigador,
                nombres: coInvestigador.nombres,
                apellidos: coInvestigador.apellidos,
                correo: coInvestigador.correo,
                orcid: coInvestigador.orcid,
                googleAcademico: coInvestigador.googleAcademico,
              }
            : g.coInvestigador,
          externo1: externo1
            ? {
                ...g.externo1,
                nombres: externo1.nombres,
                apellidos: externo1.apellidos,
                correo: externo1.correo,
                orcid: externo1.orcid,
                googleAcademico: externo1.googleAcademico,
              }
            : g.externo1,
          externo2: externo2
            ? {
                ...g.externo2,
                nombres: externo2.nombres,
                apellidos: externo2.apellidos,
                correo: externo2.correo,
                orcid: externo2.orcid,
                googleAcademico: externo2.googleAcademico,
              }
            : g.externo2,
        }
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hojasVida])

  const [datosGeneral, setDatosGeneral] = useState<DatosGeneral>(datosGeneralIniciales)
  const [modalidades, setModalidades] = useState<catalogosApi.CatalogoItem[]>([])
  const [areas, setAreas] = useState<catalogosApi.CatalogoItem[]>([])
  const [tiposProyecto, setTiposProyecto] = useState<catalogosApi.CatalogoItem[]>([])
  const [programas, setProgramas] = useState<{ id_programa: number; nombre: string; tipoPrograma: string | null }[]>([])
  const [facultades, setFacultades] = useState<catalogosApi.FacultadItem[]>([])
  const [programasCompletos, setProgramasCompletos] = useState<catalogosApi.ProgramaItem[]>([])
  const [lineasInvestigacion, setLineasInvestigacion] = useState<catalogosApi.CatalogoItem[]>([])
  const [ods, setOds] = useState<catalogosApi.CatalogoItem[]>([])
  const [tiposGrupo, setTiposGrupo] = useState<catalogosApi.TipoGrupoItem[]>([])
  const [dedicaciones, setDedicaciones] = useState<catalogosApi.CatalogoItem[]>([])
  const [rolesProyecto, setRolesProyecto] = useState<catalogosApi.CatalogoItem[]>([])
  const [rolesEstudiante, setRolesEstudiante] = useState<catalogosApi.CatalogoItem[]>([])
  const [categoriasProducto, setCategoriasProducto] = useState<CategoriaProductoLocal[]>([])
  const [cantidadesProducto, setCantidadesProducto] = useState<Record<number, string>>({})
  const [periodos, setPeriodos] = useState<catalogosApi.CatalogoItem[]>([])
  const [idConvocatoriaActiva, setIdConvocatoriaActiva] = useState<number | null>(null)
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [camposInvalidos, setCamposInvalidos] = useState<Set<CampoGeneral>>(new Set())
  const [camposHojaVidaInvalidos, setCamposHojaVidaInvalidos] = useState<Set<CampoHojaVida>>(new Set())
  const [mostrarProyectoCreado, setMostrarProyectoCreado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [idProyectoCreado, setIdProyectoCreado] = useState<number | null>(null)

  // --- Firmas reales de Principal/Co-investigador(a) UNICESMAG (pestaña "Firmas y anexos") ---
  // null = todavía no se consultó/creó nada en el servidor (p. ej. proyecto
  // nuevo sin guardar aún). Se repuebla al entrar a la pestaña (si el
  // proyecto ya existe) y tras cada acción de firma.
  const [firmasEstado, setFirmasEstado] = useState<firmasProyectoApi.FirmaProyectoItem[] | null>(null)
  // estado_actual del proyecto en el servidor: mientras sea "pendiente_firmas"
  // (o el proyecto aún no exista) falta el "Guardar proyecto" manual.
  const [estadoProyectoServidor, setEstadoProyectoServidor] = useState<string | null>(null)
  const [enviandoCoinvestigador, setEnviandoCoinvestigador] = useState(false)
  const [errorFirma, setErrorFirma] = useState('')
  // Correo (enmascarado) al que se mandó el código del Principal; null = aún no se pidió.
  const [codigoPrincipalEnviadoA, setCodigoPrincipalEnviadoA] = useState<string | null>(null)
  const [avisoCodigoPrincipal, setAvisoCodigoPrincipal] = useState('')
  const [validandoCodigoPrincipal, setValidandoCodigoPrincipal] = useState(false)
  const [finalizandoProyecto, setFinalizandoProyecto] = useState(false)

  const aplicarEstadoFirmas = (r: firmasProyectoApi.EstadoFirmasProyecto) => {
    setFirmasEstado(r.firmas)
    setEstadoProyectoServidor(r.estado_actual)
  }

  // Al entrar a "Firmas y anexos" de un proyecto que ya existe en el
  // servidor (edición, o un intento de guardado anterior que sí llegó a
  // crearlo), se consulta el estado real — así, si ya se firmó antes, se ve
  // de una vez "Firmaste"/"Firmó" en vez de pedir la firma otra vez.
  useEffect(() => {
    if (tab !== 'firmas' || !idProyectoCreado || firmasEstado !== null) return
    firmasProyectoApi
      .obtenerFirmas(idProyectoCreado)
      .then(aplicarEstadoFirmas)
      .catch(() => setFirmasEstado([]))
  }, [tab, idProyectoCreado, firmasEstado])

  // Mientras alguien con el enlace ya enviado no ha firmado, se vuelve a
  // consultar cada 15 s para que el Principal vea "Firmó" sin recargar.
  const hayFirmaEsperandoEnlace = Boolean(firmasEstado?.some((f) => !f.firmado && f.fecha_envio))
  useEffect(() => {
    if (tab !== 'firmas' || !idProyectoCreado || !hayFirmaEsperandoEnlace) return
    const intervalo = window.setInterval(() => {
      firmasProyectoApi.obtenerFirmas(idProyectoCreado).then(aplicarEstadoFirmas).catch(() => {})
    }, 15000)
    return () => window.clearInterval(intervalo)
  }, [tab, idProyectoCreado, hayFirmaEsperandoEnlace])

  // --- Borrador local: para que un recargo de página no borre lo ya escrito ---
  // Se guarda en localStorage (por usuario) todo lo que todavía no viaja al
  // backend en cada "Siguiente" (o que sí viaja, pero conviene tener también
  // localmente para repoblar los campos sin reconsultar todo). No incluye los
  // archivos de "Firmas y anexos": un File no se puede guardar en localStorage.
  const [mostrarRestaurarBorrador, setMostrarRestaurarBorrador] = useState(false)
  const [borradorListo, setBorradorListo] = useState(false)
  const claveBorradorRef = useRef<string | null>(null)
  // true si continuarBorrador() ya restauró hojas de vida con contenido real
  // (borrador propio guardado, o uno cargado desde Word) — en ese caso el
  // prellenado automático de abajo no debe pisarlas.
  const huboHojaVidaRestauradaRef = useRef(false)
  // Solo se llena cuando el borrador viene de "Cargar proyectos" (Administrador
  // cargando el Word de otra persona, ver Proyectos.tsx): el proyecto debe
  // quedar atribuido a esa persona, no a quien lo está registrando.
  const [idResponsableAsignado, setIdResponsableAsignado] = useState<number | null>(null)

  // "Volver" mientras se está registrando un proyecto nuevo: si ya hay algo
  // escrito en cualquier pestaña, salir de golpe lo perdería (el borrador
  // local solo sirve para un recargo de página, "Volver" es salida a
  // propósito y sí lo borra) — se avisa antes en vez de perderlo en silencio.
  const [mostrarConfirmarVolver, setMostrarConfirmarVolver] = useState(false)

  useEffect(() => {
    if (!usuario) return
    // En modo edición se carga el proyecto real desde el servidor (ver más
    // abajo) — no tiene sentido ofrecer restaurar un borrador local de otro
    // proyecto a medio llenar.
    if (modoEdicion) {
      setBorradorListo(true)
      return
    }
    const clave = `cp_borrador_${usuario.id_usuario}`
    claveBorradorRef.current = clave
    const raw = localStorage.getItem(clave)
    let hayAlgoQueRestaurar = false
    if (raw) {
      try {
        hayAlgoQueRestaurar = borradorTieneContenido(JSON.parse(raw))
      } catch {
        hayAlgoQueRestaurar = false
      }
      // Un borrador vacío (o ilegible) no sirve de nada: se descarta sin preguntar.
      if (!hayAlgoQueRestaurar) localStorage.removeItem(clave)
    }
    if (hayAlgoQueRestaurar) {
      setMostrarRestaurarBorrador(true)
    } else {
      setBorradorListo(true)
    }
  }, [usuario])

  const continuarBorrador = () => {
    const clave = claveBorradorRef.current
    const raw = clave ? localStorage.getItem(clave) : null
    if (raw) {
      try {
        const b = JSON.parse(raw) as Record<string, unknown>
        if (b.tab) setTab(b.tab as Tab)
        if (b.participantesPorGrupo) setParticipantesPorGrupo(b.participantesPorGrupo as GrupoParticipantes[])
        if (b.estudiantesInvestigadores) setEstudiantesInvestigadores(b.estudiantesInvestigadores as EstudianteSlot[])
        if (b.objetivosEspecificos) setObjetivosEspecificos(b.objetivosEspecificos as ItemLista[])
        if (b.datosTexto) setDatosTexto(b.datosTexto as DatosTexto)
        if (b.impactos) setImpactos(b.impactos as Record<number, ImpactoPorObjetivo>)
        if (Array.isArray(b.gruposCesmagSel)) setGruposCesmagSel((b.gruposCesmagSel as unknown[]).map(normalizarGrupoSeleccionadoBorrador))
        if (Array.isArray(b.gruposExternosSel)) setGruposExternosSel((b.gruposExternosSel as unknown[]).map(normalizarGrupoSeleccionadoBorrador))
        if (Array.isArray(b.cronogramas)) setCronogramas((b.cronogramas as unknown[]).map(normalizarCronogramaBloque))
        if (b.egresadosInfo) setEgresadosInfo(normalizarEgresadosBorrador(b.egresadosInfo))
        if (Array.isArray(b.hojasVida) && b.hojasVida.length > 0) {
          setHojasVida((b.hojasVida as unknown[]).map((v, i) => normalizarHojaVidaBorrador(v, i)))
          huboHojaVidaRestauradaRef.current = true
        }
        if (b.datosGeneral) setDatosGeneral(normalizarDatosGeneralBorrador(b.datosGeneral))
        if (b.cantidadesProducto) setCantidadesProducto(b.cantidadesProducto as Record<number, string>)
        if (typeof b.idProyectoCreado === 'number') setIdProyectoCreado(b.idProyectoCreado)
        if (typeof b.idResponsableAsignado === 'number') setIdResponsableAsignado(b.idResponsableAsignado)
        if (Array.isArray(b.tabsDesbloqueadas)) {
          setTabsDesbloqueadas(new Set(b.tabsDesbloqueadas as Tab[]))
        } else if (typeof b.maxTabIndexDesbloqueado === 'number') {
          // Compatibilidad con borradores guardados antes de que esto se guardara
          // como conjunto de pestañas: sin esto, un borrador viejo perdía el
          // desbloqueo de las pestañas ya diligenciadas al restaurarlo.
          setTabsDesbloqueadas(new Set(ordenTabs.slice(0, b.maxTabIndexDesbloqueado + 1)))
        }
      } catch {
        // Borrador corrupto/ilegible: se ignora y se sigue con el formulario vacío.
      }
    }
    setMostrarRestaurarBorrador(false)
    setBorradorListo(true)
  }

  const descartarBorrador = () => {
    if (claveBorradorRef.current) localStorage.removeItem(claveBorradorRef.current)
    setMostrarRestaurarBorrador(false)
    setBorradorListo(true)
  }

  // Al registrar un proyecto desde cero (no edición, no borrador propio ni
  // importado con hoja de vida ya restaurada), prellena la hoja de vida del
  // investigador principal con sus propios datos ya guardados en el sistema
  // (Usuarios > Hoja de vida) — así no hay que volver a escribirlos cada vez.
  // Se excluye el caso de "Cargar proyectos" del Administrador
  // (idResponsableAsignado ya elegido): ahí la cuenta logueada no es la del
  // investigador real, así que prellenar con su propia hoja de vida sería
  // incorrecto.
  useEffect(() => {
    if (!borradorListo || modoEdicion || !usuario || huboHojaVidaRestauradaRef.current || idResponsableAsignado !== null) return
    usuariosApi
      .obtenerHojaVida(usuario.id_usuario)
      .then((hojaVidaRes) => {
        setHojasVida((prev) => {
          if (prev.length !== 1 || borradorTieneContenido(prev[0])) return prev
          return [
            {
              id: prev[0].id,
              rol: prev[0].rol,
              nombres: hojaVidaRes.usuario.nombre,
              apellidos: hojaVidaRes.usuario.apellido,
              correo: hojaVidaRes.correo_institucional ?? hojaVidaRes.usuario.correo,
              correoPersonal: hojaVidaRes.correo_personal ?? '',
              lugarNacimiento: hojaVidaRes.lugar_nacimiento ?? '',
              fechaNacimiento: hojaVidaRes.fecha_nacimiento ? hojaVidaRes.fecha_nacimiento.slice(0, 10) : '',
              nacionalidad: hojaVidaRes.nacionalidad ?? '',
              tipoDocumento: hojaVidaRes.tipo_documento ?? '',
              numeroDocumento: hojaVidaRes.numero_documento ?? '',
              direccion: hojaVidaRes.direccion ?? '',
              telefono: hojaVidaRes.telefono ?? '',
              celular: hojaVidaRes.celular ?? '',
              orcid: hojaVidaRes.orcid ?? '',
              googleAcademico: hojaVidaRes.google_academico ?? '',
              categoriaMinciencias: hojaVidaRes.categoria_minciencias ?? '',
              cargoActual: hojaVidaRes.cargo_actual ?? '',
              cargosDesempenados: hojaVidaRes.cargos_desempenados ?? '',
              titulosAcademicos: hojaVidaRes.titulos_academicos ?? '',
              produccionCientifica: hojaVidaRes.produccion_cientifica ?? '',
            },
          ]
        })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradorListo, modoEdicion, usuario, idResponsableAsignado])

  const ordenTabs: Tab[] = ['hojasvida', 'general', 'grupos', 'formulacion', 'marco', 'cronograma', 'resultados', 'etico', 'firmas']
  // Pestañas ya desbloqueadas: cada vez que "tab" cambia (ya sea por avanzar
  // normalmente o porque el formulario redirige a una pestaña posterior por un
  // campo faltante) se agrega SOLO esa pestaña al conjunto — no todas las que
  // haya de por medio. Antes se guardaba el índice máximo alcanzado y se
  // desbloqueaba todo hasta ahí de un tirón; eso hacía que, por ejemplo, al
  // saltar de "Marco teórico" a "Componente ético" (porque faltaba algo ahí),
  // "Cronograma" y "Resultados esperados" quedaran desbloqueadas de paso aunque
  // la persona nunca las hubiera visitado (RQF control de avance).
  // En modo edición todas las pestañas quedan disponibles de inmediato — no
  // tiene sentido obligar a recorrerlas en orden para un proyecto que ya
  // estaba completo y solo se está corrigiendo.
  const [tabsDesbloqueadas, setTabsDesbloqueadas] = useState<Set<Tab>>(() =>
    modoEdicion ? new Set<Tab>(ordenTabs) : new Set<Tab>(['hojasvida'])
  )
  useEffect(() => {
    setTabsDesbloqueadas((actual) => (actual.has(tab) ? actual : new Set(actual).add(tab)))
  }, [tab])

  // Guarda el borrador (con un pequeño debounce) cada vez que cambia algo.
  // No arranca hasta que "borradorListo" es true, para no pisar un borrador
  // guardado antes de preguntarle a la persona si quiere continuarlo.
  useEffect(() => {
    // En modo edición no se guarda nada en el borrador local: pisaría (bajo
    // la misma llave por usuario) cualquier borrador real de un proyecto
    // nuevo que la persona tuviera a medio llenar.
    if (modoEdicion || !borradorListo || !claveBorradorRef.current) return
    const clave = claveBorradorRef.current
    const borrador = {
      tab,
      participantesPorGrupo,
      estudiantesInvestigadores,
      objetivosEspecificos,
      datosTexto,
      impactos,
      gruposCesmagSel,
      gruposExternosSel,
      cronogramas,
      egresadosInfo,
      hojasVida,
      datosGeneral,
      cantidadesProducto,
      idProyectoCreado,
      idResponsableAsignado,
      tabsDesbloqueadas: [...tabsDesbloqueadas],
    }
    // Sin nada escrito no hay nada que recuperar: no se guarda borrador (y si
    // había uno viejo, se borra) para no preguntar "¿continuar?" por un formulario vacío.
    if (!borradorTieneContenido(borrador)) {
      localStorage.removeItem(clave)
      return
    }
    const id = setTimeout(() => {
      try {
        localStorage.setItem(clave, JSON.stringify(borrador))
      } catch {
        // localStorage lleno o bloqueado: no es crítico, se sigue trabajando en memoria.
      }
    }, 600)
    return () => clearTimeout(id)
  }, [
    borradorListo,
    tab,
    participantesPorGrupo,
    estudiantesInvestigadores,
    objetivosEspecificos,
    datosTexto,
    impactos,
    gruposCesmagSel,
    gruposExternosSel,
    cronogramas,
    egresadosInfo,
    hojasVida,
    datosGeneral,
    cantidadesProducto,
    idProyectoCreado,
    idResponsableAsignado,
    tabsDesbloqueadas,
  ])

  const avanzarSiguienteTab = () => {
    const idx = ordenTabs.indexOf(tab)
    if (idx >= 0 && idx < ordenTabs.length - 1) setTab(ordenTabs[idx + 1])
  }

  useEffect(() => {
    async function cargar() {
      try {
        const [modalidadesRes, areasRes, tiposRes, programasRes, lineasRes, odsRes, tiposGrupoRes, dedicacionesRes, rolesProyectoRes, rolesEstudianteRes, periodosRes, categoriasProductoRes, tiposDocumentoRes, convocatoriasRes, facultadesRes, gruposInternosRes] = await Promise.all([
          catalogosApi.listarModalidadesProyecto(true),
          catalogosApi.listarAreasConocimiento(true),
          catalogosApi.listarTiposProyecto(true),
          catalogosApi.listarProgramas(true),
          catalogosApi.listarLineasInvestigacion(true),
          catalogosApi.listarOds(true),
          catalogosApi.listarTiposGrupo(),
          catalogosApi.listarDedicaciones(),
          catalogosApi.listarRolesProyecto(),
          catalogosApi.listarRolesEstudiante(),
          catalogosApi.listarPeriodos(true),
          productosApi.listarCategoriasProducto(true),
          tiposDocumentoApi.listarTiposDocumento(),
          convocatoriasApi.listarConvocatorias({ estado: 'activa' }),
          catalogosApi.listarFacultades(true),
          gruposApi.listarGrupos(true),
        ])
        setGruposInternosDisponibles(gruposInternosRes.filter((g) => g.tipoGrupo.nombre === 'interno'))

        const idConv = convocatoriasRes[0] ? convocatoriasRes[0].id_convocatoria : null
        setIdConvocatoriaActiva(idConv)

        // "Selección por convocatoria": si el admin restringió un catálogo
        // para la convocatoria activa, solo se muestran esos elementos; si
        // no configuró nada para ese tipo, se muestra el catálogo global
        // completo (mismo comportamiento de siempre).
        let opciones: Record<string, number[]> = {}
        if (idConv) {
          try {
            opciones = await convocatoriaOpcionesApi.obtenerOpciones(idConv)
            const limitesConv = await convocatoriaOpcionesApi.obtenerLimitesTexto(idConv)
            // Puentea los límites configurados para esta convocatoria hacia
            // el caché local que ya lee TextareaConContador
            // (getLimite/getLimiteAntecedentes), para no tener que enhebrar
            // un prop nuevo por sus ~12 usos en este archivo.
            for (const { clave, max_caracteres } of limitesConv) {
              if (clave === 'antecedentesCantidad') setLimiteAntecedentes(max_caracteres)
              else setLimite(clave as ClaveLimiteTexto, max_caracteres)
            }
          } catch {
            opciones = {}
          }
        }

        function filtrarPorOpciones<T>(items: T[], tipo: string, idDe: (item: T) => number): T[] {
          const ids = opciones[tipo]
          return ids && ids.length > 0 ? items.filter((item) => ids.includes(idDe(item))) : items
        }

        setModalidades(filtrarPorOpciones(modalidadesRes, 'modalidad', (m) => m.id_modalidad))
        setTiposProyecto(filtrarPorOpciones(tiposRes, 'tipo_proyecto', (t) => t.id_tipo_proyecto))
        setAreas(filtrarPorOpciones(areasRes, 'area', (a) => a.id_area_conocimiento))
        const programasFiltrados = filtrarPorOpciones(programasRes, 'programa', (p) => p.id_programa)
        setProgramas(
          programasFiltrados.map((p) => ({
            id_programa: p.id_programa,
            nombre: p.nombre,
            tipoPrograma: p.tipoPrograma?.nombre ?? null,
          }))
        )
        setProgramasCompletos(programasFiltrados)
        setFacultades(facultadesRes)
        setLineasInvestigacion(filtrarPorOpciones(lineasRes, 'linea', (l) => l.id_linea))
        setOds(filtrarPorOpciones(odsRes, 'ods', (o) => o.id_ods))
        setTiposGrupo(tiposGrupoRes)
        setDedicaciones(dedicacionesRes)
        setRolesProyecto(rolesProyectoRes)
        setRolesEstudiante(rolesEstudianteRes)
        setPeriodos(filtrarPorOpciones(periodosRes, 'periodo', (p) => p.id_periodo))
        setCategoriasProducto(
          mapearCategoriasBackend(filtrarPorOpciones(categoriasProductoRes, 'categoria_producto', (c) => c.id_categoria))
        )
        setTiposDocumento(tiposDocumentoRes)
      } catch (err) {
        setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudieron cargar los catálogos.')
      } finally {
        setCargandoCatalogos(false)
      }
    }
    cargar()
  }, [])

  // --- Modo edición: una vez cargados los catálogos, trae el proyecto real
  // (y todos sus sub-recursos) y rellena el formulario con sus datos, como si
  // la persona lo estuviera escribiendo de nuevo. Al guardar (ver
  // guardarFirmasYFinalizar) se borran los sub-recursos existentes y se
  // vuelven a crear desde lo que quedó en el formulario — "borrar y recrear",
  // porque hoy ningún sub-recurso (participantes, grupos, objetivos,
  // cronograma, productos) se puede "reemplazar", solo crear o borrar.
  useEffect(() => {
    if (!modoEdicion || cargandoCatalogos || !usuario || cargaEdicionHechaRef.current) return
    cargaEdicionHechaRef.current = true
    const idProyecto = Number(idParaEditar)
    const usuarioActual = usuario

    async function cargarProyectoParaEditar() {
      try {
        const [
          proyecto,
          hojaVidaRes,
          participantesRes,
          areasRes,
          programasRes,
          gruposRes,
          objetivosRes,
          antecedentesRes,
          referenciasRes,
          cronogramaRes,
          productosRes,
          documentosRes,
          consolidadoRes,
        ] = await Promise.all([
          proyectosApi.obtenerProyecto(idProyecto),
          usuariosApi.obtenerHojaVida(usuarioActual.id_usuario).catch(() => null),
          proyectosApi.listarParticipantes(idProyecto),
          proyectosApi.listarAreasProyecto(idProyecto),
          proyectosApi.listarProgramasProyecto(idProyecto),
          proyectosApi.listarGruposDelProyecto(idProyecto),
          proyectosApi.listarObjetivosProyecto(idProyecto),
          proyectosApi.listarAntecedentesProyecto(idProyecto),
          proyectosApi.listarReferenciasProyecto(idProyecto),
          proyectosApi.listarActividadesCronograma(idProyecto),
          proyectosApi.listarProductosProyecto(idProyecto),
          documentosApi.listarDocumentosProyecto(idProyecto),
          evaluacionesApi.obtenerEstadoConsolidado(idProyecto).catch(() => null),
        ])

        setIdProyectoCreado(idProyecto)

        // Si estaba esperando correcciones (ej. tras evaluación de Pares), al
        // terminar de guardar hay que reenviarlo con reenviarCorrecciones
        // para que quede reasignado a quien debe revisar los cambios.
        reenvioCorreccionesRef.current =
          consolidadoRes?.espera_correcciones && consolidadoRes.etapa_actual
            ? { id_etapa: consolidadoRes.etapa_actual.id_etapa }
            : null

        // 1. Información general. El formulario solo maneja un área a la vez
        // en esta pestaña (ya era así desde antes de esta edición) — si el
        // proyecto tiene más de una asociada directamente (no a través de un
        // grupo), solo la primera se conserva. Los programas sí son varios.
        const primeraArea = areasRes[0]?.area.id_area_conocimiento ?? null
        const idsProgramasExistentes = programasRes
          .filter((p) => p.programa)
          .map((p) => p.programa!.id_programa)
        setDatosGeneral({
          titulo: proyecto.titulo,
          idModalidad: proyecto.id_modalidad_proyecto,
          idArea: primeraArea,
          idProgramas: idsProgramasExistentes,
          pais: 'Colombia',
          otroPais: '',
          ciudad: proyecto.ciudad ?? '',
          departamento: proyecto.departamento ?? '',
          idTipoProyecto: proyecto.id_tipo_proyecto,
          valorSolicitado: '',
          valorContrapartida: '',
          duracion: proyecto.duracion_periodos != null ? String(proyecto.duracion_periodos) : '',
        })
        try {
          const fin = await proyectosApi.obtenerFinanciacionProyecto(idProyecto)
          setDatosGeneral((actual) => ({
            ...actual,
            valorSolicitado: String(fin.valor_solicitado_unicesmag),
            valorContrapartida: String(fin.valor_contrapartida),
          }))
        } catch {
          // El proyecto todavía no tenía financiación registrada.
        }

        // 2. Hojas de vida: la del Investigador Principal (la del usuario
        // logueado) y las de los co-investigadores guardadas en el proyecto.
        const hojasCoinvestigadores = (await proyectosApi.listarHojasVidaProyecto(idProyecto).catch(() => [])).map((h) =>
          datosAHojaVida(h.rol, h.datos)
        )
        if (!hojaVidaRes && hojasCoinvestigadores.length > 0) {
          setHojasVida([crearHojaVidaVacia('principal'), ...hojasCoinvestigadores])
        }
        if (hojaVidaRes) {
          setHojasVida([
            {
              id: Date.now(),
              rol: 'principal',
              nombres: hojaVidaRes.usuario.nombre,
              apellidos: hojaVidaRes.usuario.apellido,
              correo: hojaVidaRes.correo_institucional ?? hojaVidaRes.usuario.correo,
              correoPersonal: hojaVidaRes.correo_personal ?? '',
              lugarNacimiento: hojaVidaRes.lugar_nacimiento ?? '',
              fechaNacimiento: hojaVidaRes.fecha_nacimiento ? hojaVidaRes.fecha_nacimiento.slice(0, 10) : '',
              nacionalidad: hojaVidaRes.nacionalidad ?? '',
              tipoDocumento: hojaVidaRes.tipo_documento ?? '',
              numeroDocumento: hojaVidaRes.numero_documento ?? '',
              direccion: hojaVidaRes.direccion ?? '',
              telefono: hojaVidaRes.telefono ?? '',
              celular: hojaVidaRes.celular ?? '',
              orcid: hojaVidaRes.orcid ?? '',
              googleAcademico: hojaVidaRes.google_academico ?? '',
              categoriaMinciencias: hojaVidaRes.categoria_minciencias ?? '',
              cargoActual: hojaVidaRes.cargo_actual ?? '',
              cargosDesempenados: hojaVidaRes.cargos_desempenados ?? '',
              titulosAcademicos: hojaVidaRes.titulos_academicos ?? '',
              produccionCientifica: hojaVidaRes.produccion_cientifica ?? '',
            },
            ...hojasCoinvestigadores,
          ])
        }

        // 3. Formulación, marco teórico y componente ético.
        const objGeneral = objetivosRes.find((o) => o.tipo_objetivo === 'general')
        const objEspecificos = objetivosRes.filter((o) => o.tipo_objetivo === 'especifico')
        setDatosTexto({
          resumen: proyecto.resumen ?? '',
          planteamiento: proyecto.planteamiento_problema ?? '',
          pregunta: proyecto.pregunta_investigacion ?? '',
          justificacion: proyecto.justificacion ?? '',
          objetivoGeneral: objGeneral?.descripcion ?? '',
          antecedentes: enumerarAntecedentes(antecedentesRes.map((a) => a.descripcion)),
          marcoTeorico: proyecto.marco_teorico ?? '',
          metodologia: proyecto.metodologia_preliminar ?? '',
          componenteEtico: proyecto.componente_etico ?? '',
          implicacionesEticas: proyecto.implicaciones_eticas ?? '',
          fuentesFinanciacion: proyecto.fuentes_financiacion ?? '',
          permisosLicencias: proyecto.permisos_licencias ?? '',
          funcionesEstudiante: proyecto.funciones_estudiante_auxiliar ?? '',
          referencias: referenciasRes.map((r) => r.referencia).join('\n'),
        })
        setObjetivosEspecificos(
          objEspecificos.length > 0
            ? objEspecificos.map((o) => ({ id: o.id_objetivo, texto: o.descripcion }))
            : [
                { id: 1, texto: '' },
                { id: 2, texto: '' },
                { id: 3, texto: '' },
              ]
        )
        // Nota: un impacto guardado contra el objetivo GENERAL (en vez de uno
        // específico) no se puede representar aquí — el formulario solo
        // ofrece un impacto por objetivo ESPECÍFICO. Si el proyecto tenía
        // impactos así, no se precargan (habría que volver a escribirlos).
        const impactosPorObjetivo: Record<number, ImpactoPorObjetivo> = {}
        for (const o of objEspecificos) {
          const imp = o.impactos[0]
          if (imp) {
            impactosPorObjetivo[o.id_objetivo] = {
              impactoEsperado: imp.impacto_esperado,
              beneficiarioPotencial: imp.beneficiario_potencial ?? '',
              indicadorVerificable: imp.indicador_verificable ?? '',
            }
          }
        }
        setImpactos(impactosPorObjetivo)

        // 4. Participantes: 6 casillas fijas de "Información general" +
        // estudiantes investigadores (lista libre).
        const datosDe = (p: proyectosApi.ParticipanteProyecto) =>
          p.usuario
            ? { nombres: p.usuario.nombre, apellidos: p.usuario.apellido, correo: p.usuario.correo }
            : { nombres: p.nombre_manual ?? '', apellidos: p.apellido_manual ?? '', correo: p.correo_manual ?? '' }
        const armarManual = (p: proyectosApi.ParticipanteProyecto): ParticipanteManual => ({
          ...datosDe(p),
          idDedicacion: dedicaciones.find((d) => d.nombre === p.dedicacion.nombre)?.id_dedicacion ?? null,
          orcid: p.orcid ?? '',
          googleAcademico: p.google_academico ?? '',
        })

        const principal = participantesRes.find((p) => p.rolProyecto.nombre === 'Investigador(a) Principal UNICESMAG')
        const coInvestigador = participantesRes.find((p) => p.rolProyecto.nombre === 'Co investigador(a) UNICESMAG')
        const externos = participantesRes.filter((p) => p.rolProyecto.nombre === 'Co investigador(a) Externo(a)')
        const egresados = participantesRes.filter((p) => p.rolProyecto.nombre === 'Co investigador(a) Egresado(a) UNICESMAG')
        const estudiantes = participantesRes.filter((p) => p.rolProyecto.nombre === 'Estudiante Investigador(a)')

        const infoEgresados = await Promise.all(
          egresados.map((e) =>
            proyectosApi.obtenerInformacionEgresado(idProyecto, e.id_usuarioproyecto).catch(() => null)
          )
        )
        const cedulasEgresados = infoEgresados.slice(0, 2).map((info) => info?.cedula ?? '')

        // Pestaña Grupos > "Información general de egresados", tal cual se guardó.
        const egresadosSeccion = await proyectosApi.obtenerEgresadosInfo(idProyecto).catch(() => null)
        if (egresadosSeccion) {
          setEgresadosInfo({
            idFacultad: egresadosSeccion.id_facultad,
            idPrograma: egresadosSeccion.id_programa,
            empresa: egresadosSeccion.empresa_entidad ?? '',
            integrantes:
              egresadosSeccion.integrantes.length > 0
                ? egresadosSeccion.integrantes.map((i) => ({
                    ...slotVacio(),
                    nombreCompleto: i.nombre_completo,
                    horasSemanales: i.horas_semanales != null ? String(i.horas_semanales) : '',
                  }))
                : [slotVacio()],
          })
        }

        setParticipantesPorGrupo([
          {
            id: 1,
            principal: principal ? armarManual(principal) : participanteManualVacio(),
            coInvestigador: coInvestigador ? armarManual(coInvestigador) : participanteManualVacio(),
            externo1: externos[0] ? armarManual(externos[0]) : participanteManualVacio(),
            externo2: externos[1] ? armarManual(externos[1]) : participanteManualVacio(),
            egresado1: egresados[0] ? armarManual(egresados[0]) : participanteManualVacio(),
            egresado2: egresados[1] ? armarManual(egresados[1]) : participanteManualVacio(),
            cedulaEgresado1: cedulasEgresados[0] ?? '',
            cedulaEgresado2: cedulasEgresados[1] ?? '',
          },
        ])

        setEstudiantesInvestigadores(
          estudiantes.length > 0
            ? estudiantes.map((e) => {
                const d = datosDe(e)
                return {
                  nombres: d.nombres,
                  apellidos: d.apellidos,
                  correo: d.correo,
                  idRolEstudiante: rolesEstudiante.find((r) => r.nombre === e.rolEstudiante?.nombre)?.id_rolestudiante ?? null,
                  codigo: e.codigo_estudiantil ?? '',
                }
              })
            : [estudianteSlotVacio()]
        )
        // El acta de compromiso no se puede "ver" en un <input type="file">
        // aunque el estudiante ya tenga una cargada de antes — igual que el
        // resto de documentosExistentes, no se fuerza a resubir (ver
        // documentosObligatoriosFaltantes). Solo se iguala la cantidad de
        // casillas a la cantidad real de estudiantes.
        setArchivosActaCompromiso(Array(Math.max(estudiantes.length, 1)).fill(null))

        // 5. Grupos de investigación (CESMAG y externos ya existentes).
        const idTipoGrupoInterno = tiposGrupo.find((t) => t.nombre === 'interno')?.id_tipo_grupo
        const cesmag: GrupoSeleccionado[] = []
        const externosG: GrupoSeleccionado[] = []
        gruposRes.forEach((g, i) => {
          const sel: GrupoSeleccionado = {
            id: i + 1,
            nombre: g.grupo.nombre,
            idGrupoExistente: g.grupo.id_tipo_grupo === idTipoGrupoInterno ? g.grupo.id_grupo : null,
            idGrupoExterno: g.grupo.id_tipo_grupo === idTipoGrupoInterno ? null : g.grupo.id_grupo,
            facultad: g.grupo.facultad_otra ?? '',
            idFacultad: g.grupo.id_facultad,
            programa: g.grupo.programa_otro ?? '',
            idPrograma: g.grupo.id_programa,
            lider: g.grupo.lider_grupo ?? '',
            idDedicacionDirector: g.grupo.id_dedicacion,
            codGruplac: g.grupo.cod_gruplac ?? '',
            reconocidoMinciencias: g.grupo.reconocido_minciencias,
            categoria: g.grupo.categoria ?? '',
            acuerdoInstitucional: g.grupo.acuerdo_institucional ?? '',
            idsLinea: g.lineas.map((l) => l.lineaInvestigacion.id_linea),
            lineasExternas: g.grupo.lineas_externas.length > 0 ? g.grupo.lineas_externas : [''],
            lineasMedulares: g.grupo.lineas_medulares.length > 0 ? g.grupo.lineas_medulares : [''],
            idsOds: g.odsVarios.map((o) => o.id_ods),
            investigadoresExtra:
              g.investigadores.length > 0
                ? g.investigadores.map((inv) => ({
                    ...slotVacio(),
                    nombreCompleto: inv.nombre_completo,
                    horasSemanales: inv.horas_semanales != null ? String(inv.horas_semanales) : '',
                  }))
                : [slotVacio()],
          }
          if (g.grupo.id_tipo_grupo === idTipoGrupoInterno) cesmag.push(sel)
          else externosG.push(sel)
        })
        setGruposCesmagSel(cesmag.length > 0 ? cesmag : [grupoSeleccionadoVacio(1), grupoSeleccionadoVacio(2)])
        setGruposExternosSel(externosG.length > 0 ? externosG : [grupoSeleccionadoVacio(1)])

        // 6. Cronograma: cada bloque de la pantalla es UN periodo (semestre) —
        // el primero es "Periodo 1", el segundo "Periodo 2", el tercero vuelve
        // a ser "Periodo 1" pero de otro año, y así alternando. La cantidad de
        // bloques es exactamente la duración del proyecto en periodos.
        // El catálogo de periodos solo tiene 2 filas (una por cada posición
        // par/impar); junto con el año guardado en cada actividad, eso alcanza
        // para reconstruir a qué bloque pertenece cada una.
        const totalBloques = Math.max(1, proyecto.duracion_periodos ?? 2)
        const bloques: CronogramaBloque[] = Array.from({ length: totalBloques }, (_, i) => ({
          id: i + 1,
          actividades: [],
        }))
        const combosOrdenados = [
          ...new Set(
            cronogramaRes
              .map((act) => act.periodos[0])
              .filter((p): p is NonNullable<typeof p> => !!p)
              .map((p) => `${periodos.findIndex((per) => per.id_periodo === p.id_periodo)}-${p.año}`)
          ),
        ].sort((a, b) => {
          const [bucketA, añoA] = a.split('-').map(Number)
          const [bucketB, añoB] = b.split('-').map(Number)
          return añoA - añoB || bucketA - bucketB
        })
        for (const act of cronogramaRes) {
          const primerPeriodo = act.periodos[0]
          let indiceBloque = 0
          if (primerPeriodo) {
            const bucket = periodos.findIndex((p) => p.id_periodo === primerPeriodo.id_periodo)
            const idx = combosOrdenados.indexOf(`${bucket}-${primerPeriodo.año}`)
            if (idx >= 0 && idx < totalBloques) indiceBloque = idx
          }
          if (!bloques[indiceBloque]) bloques[indiceBloque] = { id: indiceBloque + 1, actividades: [] }
          const meses = Array(12).fill(false)
          for (const per of act.periodos) meses[per.mes - 1] = true
          bloques[indiceBloque].actividades.push({
            id: act.id_actividad,
            actividad: act.actividad,
            resultado: act.resultado ?? '',
            responsable: act.responsable_manual ?? '',
            anio: primerPeriodo ? String(primerPeriodo.año) : '2025',
            meses,
          })
        }
        for (const b of bloques) if (b.actividades.length === 0) b.actividades.push(crearActividadVacia())
        setCronogramas(bloques.length > 0 ? bloques : [{ id: 1, actividades: [crearActividadVacia()] }])

        // 7. Productos esperados.
        const cantidades: Record<number, string> = {}
        for (const p of productosRes) cantidades[p.tipoProducto.id_tipo_producto] = String(p.cantidad)
        setCantidadesProducto(cantidades)

        // 8. Documentos: un <input type="file"> no se puede prellenar con un
        // archivo ya subido (restricción del navegador) — se cuenta cuántos
        // ya existen POR TIPO, para no obligar a resubir uno que el proyecto
        // ya tenía, pero sin dejar de exigir el tipo que de verdad falte
        // (ver documentosObligatoriosFaltantes()).
        const conteoPorTipo: Record<string, number> = {}
        for (const d of documentosRes) {
          conteoPorTipo[d.tipoDocumento.nombre] = (conteoPorTipo[d.tipoDocumento.nombre] ?? 0) + 1
        }
        setDocumentosExistentesPorTipo(conteoPorTipo)

        // 9. IDs ya guardados, para borrarlos y recrearlos al guardar.
        idsExistentesRef.current = {
          participantes: participantesRes.map((p) => p.id_usuarioproyecto),
          areas: areasRes.map((a) => a.id_proyecto_area),
          programas: programasRes.map((p) => p.id_proyecto_programas),
          grupos: gruposRes.map((g) => g.id_proyecto_grupo),
          objetivos: objetivosRes.map((o) => o.id_objetivo),
          antecedentes: antecedentesRes.map((a) => a.id_antecedente),
          referencias: referenciasRes.map((r) => r.id_referencia),
          actividades: cronogramaRes.map((a) => a.id_actividad),
          productos: productosRes.map((p) => p.id_proyecto_producto),
        }
      } catch (err) {
        setErrorCargaEdicion(err instanceof ApiError ? err.message : 'No se pudo cargar el proyecto para editar.')
      } finally {
        setCargandoEdicion(false)
      }
    }
    cargarProyectoParaEditar()
  }, [modoEdicion, cargandoCatalogos, usuario, idParaEditar])

  const opcionesDuracion = (() => {
    const numeros = periodos
      .map((p) => extraerNumeroDePeriodo(p.nombre))
      .filter((n): n is number => n !== null)
    const unicos = [...new Set(numeros)].sort((a, b) => a - b).map(String)
    return unicos.length > 0 ? unicos : ['2', '4']
  })()

  const handleAddEstudianteInvestigador = () => {
    setEstudiantesInvestigadores([...estudiantesInvestigadores, estudianteSlotVacio()])
    setArchivosActaCompromiso([...archivosActaCompromiso, null])
  }

  const handleRemoveEstudianteInvestigador = (index: number) => {
    if (estudiantesInvestigadores.length <= 1) return
    setEstudiantesInvestigadores(estudiantesInvestigadores.filter((_, i) => i !== index))
    setArchivosActaCompromiso(archivosActaCompromiso.filter((_, i) => i !== index))
  }

  // La lista puede ser más corta que estudiantesInvestigadores (p. ej. al
  // retomar un borrador, que restaura los estudiantes pero no los archivos):
  // con un map, el archivo de un índice fuera de rango se perdía en silencio.
  const setArchivoActaCompromiso = (index: number, archivo: File | null) => {
    setArchivosActaCompromiso((actual) => {
      const copia = [...actual]
      while (copia.length <= index) copia.push(null)
      copia[index] = archivo
      return copia
    })
  }

  const actualizarEstudiante = (index: number, cambios: Partial<EstudianteSlot>) => {
    setEstudiantesInvestigadores(
      estudiantesInvestigadores.map((e, i) => (i === index ? { ...e, ...cambios } : e))
    )
  }

  const idRolPorNombre = (nombre: string) => rolesProyecto.find((r) => r.nombre === nombre)?.id_rol_pro

  const idDedicacionPorDefecto = (): number | undefined =>
    dedicaciones.find((d) => d.nombre === 'HC')?.id_dedicacion ?? dedicaciones[0]?.id_dedicacion

  const guardarParticipantesDeGrupo = (idProyecto: number, gp: GrupoParticipantes): Promise<unknown>[] => {
    const idPrincipal = idRolPorNombre('Investigador(a) Principal UNICESMAG')
    const idCoInvestigador = idRolPorNombre('Co investigador(a) UNICESMAG')
    const idExterno = idRolPorNombre('Co investigador(a) Externo(a)')
    const idEgresado = idRolPorNombre('Co investigador(a) Egresado(a) UNICESMAG')

    const tareas: Promise<unknown>[] = []
    // cedula: solo aplica a los dos slots de egresado — se registra en
    // InformacionEgresado en un segundo paso, después de crear el
    // participante (necesita el id_usuarioproyecto que devuelve el POST).
    const slots: { slot: ParticipanteManual; idRolPro: number | undefined; cedula?: string }[] = [
      { slot: gp.principal, idRolPro: idPrincipal },
      { slot: gp.coInvestigador, idRolPro: idCoInvestigador },
      { slot: gp.externo1, idRolPro: idExterno },
      { slot: gp.externo2, idRolPro: idExterno },
      { slot: gp.egresado1, idRolPro: idEgresado, cedula: gp.cedulaEgresado1 },
      { slot: gp.egresado2, idRolPro: idEgresado, cedula: gp.cedulaEgresado2 },
    ]
    for (const { slot, idRolPro, cedula } of slots) {
      // El Investigador(a) Principal es siempre quien inició sesión y está
      // diligenciando el formulario — no depende de que haya repetido su
      // nombre/correo en este bloque (ya los dio en "Hojas de vida"). Si no
      // se vincula a SU cuenta real aquí, el proyecto queda sin ningún
      // participante y la hoja de vida que sí llenó no aparece en ningún
      // lado (ni en el documento exportado, ni en las vistas de los comités).
      const esPrincipal = idRolPro === idPrincipal
      // La dedicación del principal cae a "TC" (o la primera del catálogo) si
      // no la escogió explícitamente: a diferencia de los demás roles, este
      // participante SIEMPRE se va a crear (es quien registra el proyecto),
      // así que no puede depender de un toggle que es fácil pasar por alto.
      const idDedicacionPrincipal = slot.idDedicacion ?? idDedicacionPorDefecto()
      if (esPrincipal && usuario && idDedicacionPrincipal && idRolPro) {
        const idDedicacion = idDedicacionPrincipal
        tareas.push(
          proyectosApi.agregarParticipanteProyecto(idProyecto, {
            participante: usuario.id_usuario,
            id_dedicacion: idDedicacion,
            id_rol_pro: idRolPro,
            orcid: slot.orcid.trim() || undefined,
            google_academico: slot.googleAcademico.trim() || undefined,
          })
        )
        continue
      }
      if (!esPrincipal && slot.nombres.trim() && slot.correo.trim() && slot.idDedicacion && idRolPro) {
        const idDedicacion = slot.idDedicacion
        // Si este correo ya quedó vinculado a una cuenta que también se
        // seleccionó en otra parte del formulario (ej. como investigador
        // extra de un grupo), el backend lo rechaza con 409 por duplicado —
        // se ignora en vez de tumbar todo el guardado.
        const creacion = ignorarSiYaEsParticipante(
          proyectosApi.agregarParticipanteProyecto(idProyecto, {
            nombre: slot.nombres.trim(),
            apellido: slot.apellidos.trim() || undefined,
            correo: slot.correo.trim(),
            id_dedicacion: idDedicacion,
            id_rol_pro: idRolPro,
            orcid: slot.orcid.trim() || undefined,
            google_academico: slot.googleAcademico.trim() || undefined,
          })
        )
        if (cedula?.trim()) {
          tareas.push(
            creacion.then((res) =>
              res
                ? proyectosApi.registrarInformacionEgresado(idProyecto, res.participante.id_usuarioproyecto, {
                    cedula: cedula.trim(),
                  })
                : undefined
            )
          )
        } else {
          tareas.push(creacion)
        }
      }
    }
    return tareas
  }

  const guardarEstudiantesInvestigadores = (idProyecto: number): Promise<unknown>[] => {
    const idEstudianteRol = idRolPorNombre('Estudiante Investigador(a)')
    const idDedicacion = idDedicacionPorDefecto()

    const tareas: Promise<unknown>[] = []
    for (const est of estudiantesInvestigadores) {
      if (est.nombres.trim() && est.correo.trim() && est.idRolEstudiante && idEstudianteRol && idDedicacion) {
        const idRolEstudiante = est.idRolEstudiante
        tareas.push(
          ignorarSiYaEsParticipante(
            proyectosApi.agregarParticipanteProyecto(idProyecto, {
              nombre: est.nombres.trim(),
              apellido: est.apellidos.trim() || undefined,
              correo: est.correo.trim(),
              id_dedicacion: idDedicacion,
              id_rol_pro: idEstudianteRol,
              id_rol_estudiante: idRolEstudiante,
              codigo_estudiantil: est.codigo.trim() || undefined,
            })
          )
        )
      }
    }
    return tareas
  }

  // El backend exige el formulario general COMPLETO en cada guardado (crear
  // o editar), no solo los campos de la pestaña actual — así que cualquier
  // guardado, desde cualquier pestaña, debe revisar y enviar TODOS los
  // campos obligatorios del proyecto, estén donde estén.
  const camposFaltantesProyecto = (): Set<CampoGeneral> => {
    const faltantes = new Set<CampoGeneral>()
    if (!datosGeneral.titulo.trim()) faltantes.add('titulo')
    if (!datosGeneral.ciudad.trim()) faltantes.add('ciudad')
    if (!datosGeneral.departamento.trim()) faltantes.add('departamento')
    if (!datosGeneral.duracion) faltantes.add('duracion')
    if (!datosTexto.resumen.trim()) faltantes.add('resumen')
    if (!datosTexto.planteamiento.trim()) faltantes.add('planteamiento')
    if (!datosTexto.pregunta.trim()) faltantes.add('pregunta')
    if (!datosTexto.justificacion.trim()) faltantes.add('justificacion')
    if (!datosTexto.marcoTeorico.trim()) faltantes.add('marcoTeorico')
    if (!datosTexto.metodologia.trim()) faltantes.add('metodologia')
    if (!datosTexto.componenteEtico.trim()) faltantes.add('componenteEtico')
    if (!datosTexto.funcionesEstudiante.trim()) faltantes.add('funcionesEstudiante')
    // Un estudiante diligenciado (nombre + correo) sin rol (Auxiliar/Asistente)
    // no se guarda como participante al enviar el proyecto (ver
    // guardarEstudiantesInvestigadores) y tampoco dispara el cargue de su
    // acta de compromiso (ver estudiantesConActaRequerida) — sin este chequeo
    // quedaba fuera del proyecto en silencio, sin ningún aviso.
    if (estudiantesInvestigadores.some((e) => e.nombres.trim() && e.correo.trim() && !e.idRolEstudiante)) {
      faltantes.add('rolEstudiante')
    }
    if (estudiantesInvestigadores.some((e) => e.nombres.trim() && !e.correo.trim())) {
      faltantes.add('correoEstudiante')
    }
    return faltantes
  }

  /** Además del formulario completo, para CREAR el proyecto también hacen falta modalidad y tipo. */
  const camposFaltantesGeneral = (): Set<CampoGeneral> => {
    const faltantes = camposFaltantesProyecto()
    if (!datosGeneral.idModalidad) faltantes.add('modalidad')
    if (!datosGeneral.idTipoProyecto) faltantes.add('tipo')
    // Para poder enviar el proyecto a evaluación el backend exige un programa
    // académico registrado (ver verificarProyectoCompletoParaEvaluacion) — se
    // pide aquí y no solo al enviar, para no descubrirlo hasta el final.
    if (datosGeneral.idProgramas.length === 0) faltantes.add('programa')
    return faltantes
  }

  const primerTabConFaltante = (faltantes: Set<CampoGeneral>): Tab => {
    for (const t of tabs) {
      if ([...faltantes].some((campo) => CAMPO_A_TAB[campo] === t.id)) return t.id
    }
    return 'general'
  }

  const construirCamposTexto = () => ({
    titulo: datosGeneral.titulo.trim(),
    id_modalidad_proyecto: datosGeneral.idModalidad ?? undefined,
    id_tipo_proyecto: datosGeneral.idTipoProyecto ?? undefined,
    ciudad: datosGeneral.ciudad.trim() || undefined,
    departamento: datosGeneral.departamento.trim() || undefined,
    resumen: datosTexto.resumen.trim() || undefined,
    planteamiento_problema: datosTexto.planteamiento.trim() || undefined,
    pregunta_investigacion: datosTexto.pregunta.trim() || undefined,
    justificacion: datosTexto.justificacion.trim() || undefined,
    marco_teorico: datosTexto.marcoTeorico.trim() || undefined,
    metodologia_preliminar: datosTexto.metodologia.trim() || undefined,
    componente_etico: datosTexto.componenteEtico.trim() || undefined,
    implicaciones_eticas: datosTexto.implicacionesEticas.trim(),
    fuentes_financiacion: datosTexto.fuentesFinanciacion.trim(),
    permisos_licencias: datosTexto.permisosLicencias.trim(),
    funciones_estudiante_auxiliar: datosTexto.funcionesEstudiante.trim() || undefined,
    duracion_periodos: datosGeneral.duracion ? Number(datosGeneral.duracion) : undefined,
  })

  /**
   * Solo la usa el guardado final (en "Firmas y anexos"): marca en rojo y lleva
   * a la primera pestaña con campos faltantes de todo el proyecto.
   */
  const manejarFaltantes = (faltantes: Set<CampoGeneral>) => {
    const destino = primerTabConFaltante(faltantes)
    const esLaPestañaActual = destino === tab
    setCamposInvalidos(esLaPestañaActual ? faltantes : new Set())
    setErrorEnvio(esLaPestañaActual ? 'Hay campos vacíos.' : '')
    setTab(destino)
  }

  /** Los campos obligatorios propios de UNA pestaña (para el "Siguiente" de esa pestaña). */
  const camposFaltantesDeTab = (t: Tab): Set<CampoGeneral> =>
    new Set([...camposFaltantesGeneral()].filter((campo) => CAMPO_A_TAB[campo] === t))

  /** Si el backend igual rechaza el guardado, resalta en rojo justo lo que dice que falta. */
  const manejarErrorGuardado = (err: unknown, mensajePorDefecto: string) => {
    if (err instanceof ApiError) {
      if (err.faltantes && err.faltantes.length > 0) {
        const traducidos = new Set(
          err.faltantes
            .map((f) => BACKEND_A_CAMPO[f])
            .filter((campo): campo is CampoGeneral => campo !== undefined)
        )
        if (traducidos.size > 0) {
          manejarFaltantes(traducidos)
          return
        }
      }
      setErrorEnvio(err.message)
    } else {
      setErrorEnvio(mensajePorDefecto)
    }
  }

  /**
   * "Siguiente" en las pestañas del formulario (todas menos Hoja de vida y Firmas
   * y anexos) solo valida los campos propios de ESA pestaña y avanza a la
   * siguiente — no llama al backend ni depende de que el proyecto ya exista. El
   * proyecto se crea una sola vez, con todo lo diligenciado, al guardar en
   * "Firmas y anexos" (ver guardarFirmasYFinalizar).
   */
  const avanzarValidandoTab = async (t: Tab) => {
    setErrorEnvio('')
    const faltantes = camposFaltantesDeTab(t)
    if (faltantes.size > 0) {
      setCamposInvalidos(faltantes)
      setErrorEnvio('Hay campos vacíos.')
      return
    }
    setCamposInvalidos(new Set())
    avanzarSiguienteTab()
  }

  const guardarInformacionGeneral = async () => avanzarValidandoTab('general')
  const guardarFormulacion = async () => avanzarValidandoTab('formulacion')
  const guardarMarco = async () => avanzarValidandoTab('marco')
  const guardarEtico = async () => avanzarValidandoTab('etico')

  const guardarGrupos = async () => {
    setErrorEnvio('')
    const grupoCesmagSinOds = gruposCesmagSel.find((g) => g.nombre.trim() && g.idsOds.length === 0)
    if (grupoCesmagSinOds) {
      setErrorEnvio('Selecciona al menos un ODS para cada grupo CESMAG que hayas diligenciado.')
      return
    }
    avanzarSiguienteTab()
  }

  const guardarCronograma = async () => {
    setErrorEnvio('')
    avanzarSiguienteTab()
  }

  const guardarResultados = async () => {
    setErrorEnvio('')
    avanzarSiguienteTab()
  }

  // "Teléfono" y "Producción científica" son opcionales en la hoja de vida
  // al registrar el proyecto — no van en esta lista.
  const CAMPOS_REQUERIDOS_HOJA_VIDA: CampoHojaVida[] = [
    'nombres',
    'apellidos',
    'correo',
    'correoPersonal',
    'lugarNacimiento',
    'fechaNacimiento',
    'nacionalidad',
    'tipoDocumento',
    'numeroDocumento',
    'direccion',
    'celular',
    'orcid',
    'googleAcademico',
    'cargoActual',
    'cargosDesempenados',
    'titulosAcademicos',
  ]

  const camposFaltantesHojaVida = (): Set<CampoHojaVida> => {
    const principal = hojasVida[0]
    const faltantes = new Set<CampoHojaVida>()
    if (!principal) return faltantes
    for (const campo of CAMPOS_REQUERIDOS_HOJA_VIDA) {
      if (!principal[campo].trim()) faltantes.add(campo)
    }
    return faltantes
  }

  const guardarHojasVida = async () => {
    setErrorEnvio('')

    const faltantes = camposFaltantesHojaVida()
    if (faltantes.size > 0) {
      setCamposHojaVidaInvalidos(faltantes)
      setErrorEnvio('Hay campos vacíos.')
      return
    }
    setCamposHojaVidaInvalidos(new Set())

    try {
      const principal = hojasVida[0]
      if (usuario) {
        setEnviando(true)
        await usuariosApi.guardarHojaVida(usuario.id_usuario, {
          nombres: principal.nombres || undefined,
          apellidos: principal.apellidos || undefined,
          correo: principal.correo || undefined,
          correo_institucional: principal.correo || undefined,
          correo_personal: principal.correoPersonal || undefined,
          lugar_nacimiento: principal.lugarNacimiento || undefined,
          // El <input type="date"> da "AAAA-MM-DD"; el backend (Prisma) exige un DateTime ISO-8601 completo.
          fecha_nacimiento: principal.fechaNacimiento ? new Date(principal.fechaNacimiento).toISOString() : undefined,
          nacionalidad: principal.nacionalidad || undefined,
          tipo_documento: principal.tipoDocumento || undefined,
          numero_documento: principal.numeroDocumento || undefined,
          direccion: principal.direccion || undefined,
          telefono: principal.telefono || undefined,
          celular: principal.celular || undefined,
          orcid: principal.orcid || undefined,
          google_academico: principal.googleAcademico || undefined,
          categoria_minciencias: principal.categoriaMinciencias || undefined,
          cargo_actual: principal.cargoActual || undefined,
          cargos_desempenados: principal.cargosDesempenados || undefined,
          titulos_academicos: principal.titulosAcademicos || undefined,
          produccion_cientifica: principal.produccionCientifica || undefined,
        })
      }
      avanzarSiguienteTab()
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar la hoja de vida.')
    } finally {
      setEnviando(false)
    }
  }

  // El backend exige, además del formulario general, al menos un documento
  // cargado y una unidad de cada producto que el catálogo marque "obligatorio"
  // antes de poder enviar el proyecto a evaluación (ver
  // verificarProyectoCompletoParaEvaluacion en el backend) — se revisa aquí,
  // al terminar el formulario, para no dejar creado un proyecto que después no
  // se pueda enviar sin que quede claro por qué.
  const tiposProductoObligatorios = categoriasProducto.flatMap((c) => c.subcategorias.flatMap((s) => s.tipos)).filter((t) => t.obligatorio)
  const productosObligatoriosFaltantes = () => tiposProductoObligatorios.filter((t) => !(Number(cantidadesProducto[t.id]) > 0))

  /** Estudiantes auxiliares/asistentes realmente diligenciados (mismo criterio que guardarEstudiantesInvestigadores), con su índice original en estudiantesInvestigadores/archivosActaCompromiso. */
  const estudiantesConActaRequerida = () =>
    estudiantesInvestigadores
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.nombres.trim() && e.correo.trim() && e.idRolEstudiante)

  // En modo edición, un documento que el proyecto YA tenía de ese tipo exacto
  // no se vuelve a exigir en esta sesión (no se puede "ver" en un
  // <input type="file"> para saber que sigue ahí) — pero eso no exime a los
  // demás tipos: que ya exista el Presupuesto no debe dejar pasar un
  // proyecto al que de verdad le faltan las actas de los estudiantes.
  const documentosObligatoriosFaltantes = (): string[] => {
    const faltantes = DOCUMENTOS_FIRMAS.filter(
      (d) => d.obligatorio && !archivosDocumentos[d.nombre] && !(documentosExistentesPorTipo[d.nombre] > 0)
    ).map((d) => d.nombre)
    const estudiantes = estudiantesConActaRequerida()
    const actasYaCargadas =
      archivosActaCompromiso.filter((a) => a !== null).length + (documentosExistentesPorTipo[NOMBRE_DOCUMENTO_ACTA_COMPROMISO] ?? 0)
    if (estudiantes.length > 0 && actasYaCargadas < estudiantes.length) {
      faltantes.push(NOMBRE_DOCUMENTO_ACTA_COMPROMISO)
    }
    return faltantes
  }
  const faltaDocumento = () => documentosObligatoriosFaltantes().length > 0

  /**
   * Único punto donde se crea el proyecto (y todo lo demás: participantes,
   * grupos, cronograma, resultados esperados, documentos...): el "Guardar" de
   * "Firmas y anexos", la última pestaña. Todo lo anterior solo quedaba en el
   * formulario (y en el borrador local) hasta este momento.
   */
  const guardarFirmasYFinalizar = async () => {
    setErrorEnvio('')

    const faltantesHojaVida = camposFaltantesHojaVida()
    if (faltantesHojaVida.size > 0) {
      setCamposHojaVidaInvalidos(faltantesHojaVida)
      setErrorEnvio('Hay campos vacíos en "Hojas de vida".')
      setTab('hojasvida')
      return
    }
    setCamposHojaVidaInvalidos(new Set())

    const principalYaFirmo = Boolean(firmasEstado?.some((f) => f.rol_firmante === ROL_FIRMA_PRINCIPAL && f.firmado))
    if (!principalYaFirmo && !hojasVida[0]?.correoPersonal?.trim()) {
      setErrorEnvio('Registra tu correo personal en "Hojas de vida": ahí llega el código de verificación para firmar.')
      setTab('hojasvida')
      return
    }

    const faltantesGeneral = camposFaltantesGeneral()
    if (faltantesGeneral.size > 0) {
      manejarFaltantes(faltantesGeneral)
      return
    }
    setCamposInvalidos(new Set())

    const obligatoriosFaltantes = productosObligatoriosFaltantes()
    if (obligatoriosFaltantes.length > 0) {
      setMostrarErrorProductosObligatorios(true)
      setErrorEnvio(
        `Falta indicar cuántos productos hay de: ${obligatoriosFaltantes.map((t) => t.nombre).join(', ')} (en "Resultados esperados").`
      )
      setTab('resultados')
      return
    }
    setMostrarErrorProductosObligatorios(false)

    const documentosFaltantes = documentosObligatoriosFaltantes()
    if (documentosFaltantes.length > 0) {
      setMostrarErrorDocumentos(true)
      setErrorEnvio(`Falta cargar en "Firmas y anexos": ${documentosFaltantes.join(', ')}.`)
      setTab('firmas')
      return
    }
    setMostrarErrorDocumentos(false)

    // La convocatoria activa solo hace falta para CREAR un proyecto nuevo —
    // uno que se está editando ya pertenece a la convocatoria con la que se
    // registró, y esa no cambia al corregir el contenido.
    if (!modoEdicion && !idConvocatoriaActiva) {
      setErrorEnvio('No hay ninguna convocatoria activa en este momento. No se puede registrar el proyecto.')
      return
    }
    if (!usuario) return

    setEnviando(true)
    try {
      // 1. Hoja de vida del investigador principal.
      const principal = hojasVida[0]
      await usuariosApi.guardarHojaVida(usuario.id_usuario, {
        nombres: principal.nombres || undefined,
        apellidos: principal.apellidos || undefined,
        correo: principal.correo || undefined,
        correo_institucional: principal.correo || undefined,
        correo_personal: principal.correoPersonal || undefined,
        lugar_nacimiento: principal.lugarNacimiento || undefined,
        // El <input type="date"> da "AAAA-MM-DD"; el backend (Prisma) exige un DateTime ISO-8601 completo.
        fecha_nacimiento: principal.fechaNacimiento ? new Date(principal.fechaNacimiento).toISOString() : undefined,
        nacionalidad: principal.nacionalidad || undefined,
        tipo_documento: principal.tipoDocumento || undefined,
        numero_documento: principal.numeroDocumento || undefined,
        direccion: principal.direccion || undefined,
        telefono: principal.telefono || undefined,
        celular: principal.celular || undefined,
        orcid: principal.orcid || undefined,
        google_academico: principal.googleAcademico || undefined,
        categoria_minciencias: principal.categoriaMinciencias || undefined,
        cargo_actual: principal.cargoActual || undefined,
        cargos_desempenados: principal.cargosDesempenados || undefined,
        titulos_academicos: principal.titulosAcademicos || undefined,
        produccion_cientifica: principal.produccionCientifica || undefined,
      })

      // 2. El proyecto: se crea aquí (o, en un reintento tras un error más abajo, se
      // reutiliza el que ya se creó, para no duplicarlo).
      const camposTexto = construirCamposTexto()
      let idProyecto = idProyectoCreado
      // Si ya había un idProyecto (de esta sesión de edición, o de un intento
      // de guardado anterior que sí llegó a crear el proyecto antes de fallar
      // más abajo), ese proyecto puede tener subrecursos que hay que limpiar
      // antes de volver a crearlos — ver el bloque de abajo.
      let reutilizaProyectoExistente = idProyecto !== null
      if (idProyecto) {
        try {
          await proyectosApi.actualizarProyecto(idProyecto, camposTexto)
        } catch (err) {
          // El borrador local (retomado más tarde, incluso en otra sesión)
          // puede apuntar a un proyecto que ya no existe en el servidor —
          // en vez de bloquear con "El proyecto no existe", se trata como
          // si nunca se hubiera llegado a crear y se crea uno nuevo abajo.
          if (err instanceof ApiError && err.status === 404) {
            idProyecto = null
            setIdProyectoCreado(null)
            reutilizaProyectoExistente = false
          } else {
            throw err
          }
        }
      }
      if (!idProyecto) {
        const proyecto = await proyectosApi.crearProyecto({
          id_convocatoria: idConvocatoriaActiva!,
          ...camposTexto,
          id_modalidad_proyecto: datosGeneral.idModalidad!,
          id_tipo_proyecto: datosGeneral.idTipoProyecto!,
          ...(idResponsableAsignado ? { id_responsable: idResponsableAsignado } : {}),
        })
        idProyecto = proyecto.id_proyecto
        setIdProyectoCreado(idProyecto)
      }

      // Ningún sub-recurso (participantes, áreas, programas, grupos,
      // objetivos, antecedentes, referencias, cronograma, productos) se
      // puede "reemplazar" — solo crear o borrar. Así que, antes de volver a
      // crearlos desde lo que quedó en el formulario, se borra todo lo que ya
      // existía: en modo edición, lo que se cargó al abrir el proyecto; en un
      // reintento de guardado de un proyecto nuevo, lo que el intento
      // anterior haya llegado a crear antes de fallar (si no se limpia,
      // volver a crearlo choca con "ya existe" — participante ya registrado,
      // área ya asociada, etc.). Los documentos NO se tocan: cargar uno
      // nuevo es aditivo.
      if (modoEdicion || reutilizaProyectoExistente) {
        const ids = modoEdicion ? idsExistentesRef.current : await obtenerSubRecursosExistentes(idProyecto)
        await Promise.all([
          ...ids.participantes.map((idP) => proyectosApi.quitarParticipanteProyecto(idProyecto!, idP)),
          ...ids.areas.map((idA) => proyectosApi.quitarAreaProyecto(idProyecto!, idA)),
          ...ids.programas.map((idPr) => proyectosApi.quitarProgramaProyecto(idProyecto!, idPr)),
          ...ids.grupos.map((idG) => proyectosApi.quitarGrupoProyecto(idProyecto!, idG)),
          ...ids.objetivos.map((idO) => proyectosApi.quitarObjetivoProyecto(idProyecto!, idO)),
          ...ids.antecedentes.map((idAn) => proyectosApi.quitarAntecedenteProyecto(idProyecto!, idAn)),
          ...ids.referencias.map((idR) => proyectosApi.quitarReferenciaProyecto(idProyecto!, idR)),
          ...ids.actividades.map((idAc) => proyectosApi.quitarActividadCronograma(idProyecto!, idAc)),
          ...ids.productos.map((idPd) => proyectosApi.quitarProductoProyecto(idProyecto!, idPd)),
        ])
        idsExistentesRef.current = idsExistentesVacio()
      }

      const advertencias: string[] = []

      // 3. Información general: área, programa, financiación, participantes del
      // grupo (información general) y estudiantes investigadores.
      const tareasGeneral: Promise<unknown>[] = []
      if (datosGeneral.idArea) tareasGeneral.push(proyectosApi.agregarAreaProyecto(idProyecto, datosGeneral.idArea))
      for (const idPrograma of datosGeneral.idProgramas) {
        tareasGeneral.push(proyectosApi.agregarProgramaProyecto(idProyecto, { id_programa: idPrograma }))
      }
      if (datosGeneral.valorSolicitado) {
        tareasGeneral.push(
          proyectosApi.registrarFinanciacionProyecto(idProyecto, {
            valor_solicitado_unicesmag: Number(datosGeneral.valorSolicitado) || 0,
            valor_contrapartida: Number(datosGeneral.valorContrapartida) || 0,
          })
        )
      }
      for (const gp of participantesPorGrupo) tareasGeneral.push(...guardarParticipantesDeGrupo(idProyecto, gp))
      // Hojas de vida de co-investigadores y externos: van con el proyecto
      // (la del Principal ya se guardó en su propia cuenta, paso 1).
      tareasGeneral.push(
        proyectosApi.guardarHojasVidaProyecto(
          idProyecto,
          hojasVida
            .filter((h): h is HojaDeVida & { rol: 'coinvestigador' | 'externo' } => h.rol !== 'principal')
            .map((h) => ({ rol: h.rol, datos: hojaVidaADatos(h) }))
        )
      )
      tareasGeneral.push(...guardarEstudiantesInvestigadores(idProyecto))
      await Promise.all(tareasGeneral)

      // 4. Grupos y egresados. Ninguno de los dos crea participantes: los
      // participantes (y las firmas) salen solo de Información general.
      const idTipoGrupoInterno = tiposGrupo.find((t) => t.nombre === 'interno')?.id_tipo_grupo
      const idTipoGrupoExterno = tiposGrupo.find((t) => t.nombre === 'externo')?.id_tipo_grupo
      const gruposNoRegistrados: string[] = []

      // "Investigadores del proyecto" de la pestaña Grupos: texto libre con
      // horas, guardados en el propio grupo del proyecto.
      const guardarInvestigadoresDeGrupo = (idProyectoGrupo: number, g: GrupoSeleccionado) =>
        Promise.all(
          g.investigadoresExtra
            .filter((slot) => slot.nombreCompleto.trim())
            .map((slot) =>
              proyectosApi.agregarInvestigadorGrupoProyecto(idProyecto!, idProyectoGrupo, {
                nombre_completo: slot.nombreCompleto.trim(),
                horas_semanales: slot.horasSemanales ? Number(slot.horasSemanales) : null,
              })
            )
        )

      const registrarGrupo = async (
        g: GrupoSeleccionado,
        idTipoGrupo: number | undefined,
        idsOds: number[],
        orden: number
      ): Promise<void> => {
        // Grupo CESMAG (interno): ya se eligió de un catálogo existente (ver
        // CamposGrupoManual) — no se crea un grupo nuevo, solo se asocia.
        if (g.idGrupoExistente) {
          try {
            const grupoProyecto = await proyectosApi.agregarGrupoProyecto(idProyecto, { id_grupo: g.idGrupoExistente, orden })
            await Promise.all([
              ...idsOds.map((idOds) =>
                proyectosApi.agregarOdsGrupoProyecto(idProyecto, grupoProyecto.registro.id_proyecto_grupo, idOds)
              ),
              ...g.idsLinea.map((idLinea) =>
                proyectosApi.agregarLineaGrupoProyecto(idProyecto, grupoProyecto.registro.id_proyecto_grupo, idLinea)
              ),
              guardarInvestigadoresDeGrupo(grupoProyecto.registro.id_proyecto_grupo, g),
            ])
          } catch {
            gruposNoRegistrados.push(g.nombre.trim())
          }
          return
        }

        if (!g.nombre.trim() || !idTipoGrupo) return
        try {
          // Si el proyecto ya tenía este grupo externo, se actualiza; solo se
          // crea uno nuevo en el catálogo la primera vez (o si ya no se puede editar).
          let idGrupoExterno: number | null = null
          if (g.idGrupoExterno) {
            try {
              await proyectosApi.actualizarGrupoExternoProyecto(idProyecto, g.idGrupoExterno, {
                nombre: g.nombre.trim(),
                facultad_otra: g.facultad.trim() || null,
                programa_otro: g.programa.trim() || null,
                lider_grupo: g.lider.trim() || null,
                id_dedicacion: g.idDedicacionDirector,
                cod_gruplac: g.codGruplac.trim() || null,
                reconocido_minciencias: g.reconocidoMinciencias,
                categoria: g.categoria.trim() || null,
                acuerdo_institucional: g.acuerdoInstitucional.trim() || null,
                lineas_externas: g.lineasExternas.map((l) => l.trim()).filter(Boolean),
                lineas_medulares: g.lineasMedulares.map((l) => l.trim()).filter(Boolean),
              })
              idGrupoExterno = g.idGrupoExterno
            } catch {
              idGrupoExterno = null
            }
          }
          if (!idGrupoExterno) {
          const creado = await gruposApi.crearGrupo({
            nombre: g.nombre.trim(),
            id_tipo_grupo: idTipoGrupo,
            // Grupo externo: no está en nuestro catálogo, se guarda como texto libre
            // (líneas de investigación y línea medular incluidas: no tenemos el
            // catálogo institucional de otra entidad).
            facultad_otra: g.facultad.trim() || undefined,
            programa_otro: g.programa.trim() || undefined,
            lider_grupo: g.lider.trim() || undefined,
            id_dedicacion: g.idDedicacionDirector ?? undefined,
            cod_gruplac: g.codGruplac.trim() || undefined,
            reconocido_minciencias: g.reconocidoMinciencias,
            categoria: g.categoria.trim() || undefined,
            acuerdo_institucional: g.acuerdoInstitucional.trim() || undefined,
            lineas_externas: g.lineasExternas.map((l) => l.trim()).filter(Boolean),
            lineas_medulares: g.lineasMedulares.map((l) => l.trim()).filter(Boolean),
          })
          idGrupoExterno = creado.grupo.id_grupo
          }
          // Se recuerda para los siguientes guardados de esta misma sesión.
          const idGuardado = idGrupoExterno
          setGruposExternosSel((actual) => actual.map((x) => (x.id === g.id ? { ...x, idGrupoExterno: idGuardado } : x)))
          const grupoProyecto = await proyectosApi.agregarGrupoProyecto(idProyecto, { id_grupo: idGuardado, orden })
          await Promise.all([
            ...idsOds.map((idOds) =>
              proyectosApi.agregarOdsGrupoProyecto(idProyecto, grupoProyecto.registro.id_proyecto_grupo, idOds)
            ),
            guardarInvestigadoresDeGrupo(grupoProyecto.registro.id_proyecto_grupo, g),
          ])
        } catch {
          gruposNoRegistrados.push(g.nombre.trim())
        }
      }

      const tareasGrupos: Promise<unknown>[] = []
      // El orden queda guardado: el primer grupo CESMAG es el de adscripción
      // del proyecto y su líder es quien da el visto bueno.
      gruposCesmagSel.forEach((g, i) => tareasGrupos.push(registrarGrupo(g, idTipoGrupoInterno, g.idsOds, i)))
      gruposExternosSel.forEach((g, i) =>
        tareasGrupos.push(registrarGrupo(g, idTipoGrupoExterno, [], gruposCesmagSel.length + i))
      )

      // "Información general de egresados": se guarda tal cual (reemplaza lo
      // anterior), sin crear participantes.
      tareasGrupos.push(
        proyectosApi.guardarEgresadosInfo(idProyecto, {
          id_facultad: egresadosInfo.idFacultad,
          id_programa: egresadosInfo.idPrograma,
          empresa_entidad: egresadosInfo.empresa.trim() || null,
          integrantes: egresadosInfo.integrantes
            .filter((i) => i.nombreCompleto.trim())
            .map((i) => ({
              nombre_completo: i.nombreCompleto.trim(),
              horas_semanales: i.horasSemanales ? Number(i.horasSemanales) : null,
            })),
        })
      )
      await Promise.all(tareasGrupos)
      if (gruposNoRegistrados.length > 0) {
        advertencias.push(
          `no se pudo registrar en el catálogo: ${gruposNoRegistrados.join(', ')} ` +
            '(solo un Administrador puede registrar grupos nuevos)'
        )
      }

      // 5. Formulación: objetivos y antecedentes. Los objetivos se crean primero
      // porque el impacto (paso 6) necesita su id real.
      const idsObjetivosReales: Record<number, number> = {}
      if (datosTexto.objetivoGeneral.trim()) {
        const creado = await proyectosApi.agregarObjetivoProyecto(idProyecto, 'general', datosTexto.objetivoGeneral.trim())
        idsObjetivosReales[-1] = creado.id_objetivo
      }
      for (const obj of objetivosEspecificos) {
        if (!obj.texto.trim()) continue
        const creado = await proyectosApi.agregarObjetivoProyecto(idProyecto, 'especifico', obj.texto.trim())
        idsObjetivosReales[obj.id] = creado.id_objetivo
      }

      // Se crean uno por uno para conservar el orden de ingreso.
      for (const antecedente of separarAntecedentes(datosTexto.antecedentes)) {
        await proyectosApi.agregarAntecedenteProyecto(idProyecto, antecedente)
      }

      // 6. Marco teórico y metodología: referencias e impacto de cada objetivo específico.
      // Las referencias se crean una por una, en orden de ingreso.
      for (const linea of datosTexto.referencias.split('\n')) {
        if (linea.trim()) await proyectosApi.agregarReferenciaProyecto(idProyecto, linea.trim())
      }
      const tareasMarco: Promise<unknown>[] = []
      for (const obj of objetivosEspecificos) {
        const impacto = impactos[obj.id]
        if (!impacto?.impactoEsperado && !impacto?.beneficiarioPotencial && !impacto?.indicadorVerificable) continue
        const idObjetivoReal = idsObjetivosReales[obj.id]
        if (!idObjetivoReal) continue
        tareasMarco.push(
          proyectosApi.agregarImpactoObjetivo(idProyecto, idObjetivoReal, {
            impacto_esperado: impacto?.impactoEsperado || 'No especificado',
            beneficiario_potencial: impacto?.beneficiarioPotencial || undefined,
            indicador_verificable: impacto?.indicadorVerificable || undefined,
          })
        )
      }
      await Promise.all(tareasMarco)

      // 7. Cronograma de actividades. Cada bloque es un periodo (Periodo 1,
      // Periodo 2, Periodo 1 de otro año, ...) — el catálogo solo tiene 2
      // filas, así que se alterna entre ellas según la posición sea par/impar.
      for (const bloque of cronogramas) {
        const indiceBloque = cronogramas.indexOf(bloque)
        const periodoDelBloque = periodos.length > 0 ? periodos[indiceBloque % periodos.length] : undefined
        const mesesDelBloqueActual = mesesDelBloque()
        for (const act of bloque.actividades) {
          if (!act.actividad.trim()) continue

          // El texto de "Responsable" es solo informativo: no crea ninguna
          // cuenta. El vínculo real de la actividad queda con quien crea el proyecto.
          const creada = await proyectosApi.agregarActividadCronograma(idProyecto, {
            responsables: [usuario.id_usuario],
            actividad: act.actividad.trim(),
            resultado: act.resultado || undefined,
            responsable_manual:
              act.responsable.split('\n').map((r) => r.trim()).filter(Boolean).join('\n') || undefined,
          })

          if (!periodoDelBloque) continue

          const mesesTareas = act.meses
            .map((marcado, i) => (marcado ? mesesDelBloqueActual[i] : null))
            .filter((m): m is number => m !== null)
            .map((mes) =>
              proyectosApi.programarActividadCronograma(idProyecto, creada.id_actividad, {
                id_periodo: periodoDelBloque.id_periodo!,
                año: Number(act.anio),
                mes,
              })
            )
          await Promise.all(mesesTareas)
        }
      }

      // 8. Resultados esperados: productos.
      const tiposPorId = new Map(
        categoriasProducto.flatMap((c) => c.subcategorias.flatMap((s) => s.tipos.map((t) => [t.id, t] as const)))
      )
      const tareasProductos: Promise<unknown>[] = []
      const productosSinRegistrar: string[] = []
      for (const [idTipoStr, cantidadStr] of Object.entries(cantidadesProducto)) {
        const cantidad = Number(cantidadStr)
        if (cantidad <= 0) continue
        const tipo = tiposPorId.get(Number(idTipoStr))
        if (tipo?.idReal != null) {
          tareasProductos.push(proyectosApi.agregarProductoProyecto(idProyecto, { id_tipo_producto: tipo.idReal, cantidad }))
        } else if (tipo) {
          productosSinRegistrar.push(tipo.nombre)
        }
      }
      await Promise.all(tareasProductos)
      if (productosSinRegistrar.length > 0) {
        advertencias.push(
          `estos productos todavía no existen en el catálogo real y no se pudieron registrar: ${productosSinRegistrar.join(', ')}`
        )
      }

      // 9. Firmas y anexos: documentos.
      const tareasDocumentos: Promise<unknown>[] = []
      for (const [nombre, archivo] of Object.entries(archivosDocumentos)) {
        if (!archivo) continue
        const idTipo = tiposDocumento.find((t) => t.nombre === nombre)?.id_tipo_documento
        if (idTipo) tareasDocumentos.push(documentosApi.cargarDocumentoProyecto(idProyecto, idTipo, archivo))
      }
      // Acta de compromiso: una por cada estudiante auxiliar/asistente, todas con el mismo id_tipo_documento.
      const idTipoActaCompromiso = tiposDocumento.find((t) => t.nombre === NOMBRE_DOCUMENTO_ACTA_COMPROMISO)?.id_tipo_documento
      if (idTipoActaCompromiso) {
        for (const archivo of archivosActaCompromiso) {
          if (archivo) tareasDocumentos.push(documentosApi.cargarDocumentoProyecto(idProyecto, idTipoActaCompromiso, archivo))
        }
      }
      await Promise.all(tareasDocumentos)
      // Ya quedaron en el servidor: se sacan del formulario (y se cuentan como
      // existentes) para que el siguiente guardado no los vuelva a subir.
      if (tareasDocumentos.length > 0) {
        const subidosPorTipo: Record<string, number> = {}
        for (const [nombre, archivo] of Object.entries(archivosDocumentos)) {
          if (archivo) subidosPorTipo[nombre] = (subidosPorTipo[nombre] ?? 0) + 1
        }
        const actasSubidas = archivosActaCompromiso.filter((a) => a !== null).length
        if (actasSubidas > 0) {
          subidosPorTipo[NOMBRE_DOCUMENTO_ACTA_COMPROMISO] = (subidosPorTipo[NOMBRE_DOCUMENTO_ACTA_COMPROMISO] ?? 0) + actasSubidas
        }
        setDocumentosExistentesPorTipo((actual) => {
          const nuevo = { ...actual }
          for (const [nombre, n] of Object.entries(subidosPorTipo)) nuevo[nombre] = (nuevo[nombre] ?? 0) + n
          return nuevo
        })
        setArchivosDocumentos({})
        setArchivosActaCompromiso((actual) => actual.map(() => null))
      }

      // Se deja listo para un PRÓXIMO guardado dentro de esta misma sesión de
      // edición (ej. corregir algo más y volver a "Guardar cambios", o editar
      // después de enviar la firma al Co-investigador): sin esto,
      // idsExistentesRef quedaba vacío tras el primer guardado (ver el borrado
      // de arriba) y el siguiente guardado no tenía nada que borrar antes de
      // recrear, duplicando participantes/grupos/objetivos... cada vez.
      idsExistentesRef.current = await obtenerSubRecursosExistentes(idProyecto)

      if (advertencias.length > 0) {
        // El proyecto y el resto de la información ya quedaron guardados: se
        // avisa de lo puntual que faltó, pero no se navega para que se alcance
        // a leer (el registro ya existe; "Guardar" de nuevo no lo duplica).
        setErrorEnvio(`El proyecto se guardó, pero ${advertencias.join('; y ')}. El resto de la información sí quedó guardada.`)
        return
      }

      // Si el proyecto estaba esperando correcciones (ej. Pares pidió
      // ajustes), guardar los campos no basta: hay que reenviarlo para que
      // quede reasignado a quien debe revisar los cambios.
      if (modoEdicion && reenvioCorreccionesRef.current) {
        await evaluacionesApi.reenviarCorrecciones(idProyecto, reenvioCorreccionesRef.current.id_etapa)
        reenvioCorreccionesRef.current = null
      }

      // Crea/actualiza las filas de firma (nadie queda firmado aquí).
      const estadoFirmas = await firmasProyectoApi.iniciarFirmas(idProyecto)
      aplicarEstadoFirmas(estadoFirmas)

      const principalFirma = estadoFirmas.firmas.find((f) => f.rol_firmante === ROL_FIRMA_PRINCIPAL)
      if (principalFirma && !principalFirma.firmado) {
        // Contenido guardado: ahora el Principal confirma con el código que le
        // llega al correo personal. El borrador se conserva hasta "Guardar
        // proyecto", por si la página se recarga a mitad de las firmas.
        await pedirCodigoPrincipal(idProyecto)
      } else if (estadoFirmas.estado_actual !== 'pendiente_firmas') {
        // Edición de un proyecto que ya había pasado la fase de firmas: aquí
        // termina el guardado, igual que antes.
        if (claveBorradorRef.current) localStorage.removeItem(claveBorradorRef.current)
        setMostrarProyectoCreado(true)
      }
    } catch (err) {
      manejarErrorGuardado(err, 'No se pudo guardar el proyecto.')
    } finally {
      setEnviando(false)
    }
  }

  const pedirCodigoPrincipal = async (idProyecto: number) => {
    setErrorFirma('')
    setAvisoCodigoPrincipal('')
    try {
      const r = await firmasProyectoApi.solicitarCodigoPrincipal(idProyecto)
      setCodigoPrincipalEnviadoA(r.correo_enmascarado)
      setAvisoCodigoPrincipal(`Te enviamos un código de 6 dígitos a ${r.correo_enmascarado}. Vence en ${r.vence_en_minutos} minutos.`)
    } catch (err) {
      setErrorFirma(err instanceof ApiError ? err.message : 'No se pudo enviar el código de verificación.')
    }
  }

  const handleFirmarPrincipal = async () => {
    setErrorFirma('')
    // Siempre pasa por guardarFirmasYFinalizar, en creación y en edición: es
    // la única función que revalida hoja de vida, productos obligatorios y
    // documentos obligatorios (incluidas las actas de los estudiantes) antes
    // de guardar y pedir el código de firma.
    await guardarFirmasYFinalizar()
  }

  const handleReenviarCodigoPrincipal = async () => {
    if (!idProyectoCreado) return
    await pedirCodigoPrincipal(idProyectoCreado)
  }

  const handleValidarCodigoPrincipal = async (codigo: string) => {
    if (!idProyectoCreado) return
    setErrorFirma('')
    setValidandoCodigoPrincipal(true)
    try {
      aplicarEstadoFirmas(await firmasProyectoApi.firmarPrincipal(idProyectoCreado, codigo))
      setCodigoPrincipalEnviadoA(null)
      setAvisoCodigoPrincipal('')
    } catch (err) {
      setErrorFirma(err instanceof ApiError ? err.message : 'No se pudo validar el código.')
    } finally {
      setValidandoCodigoPrincipal(false)
    }
  }

  const handleEnviarFirmaCoinvestigador = async () => {
    if (!idProyectoCreado) return
    setErrorFirma('')
    setEnviandoCoinvestigador(true)
    try {
      aplicarEstadoFirmas(await firmasProyectoApi.enviarFirmaCoinvestigador(idProyectoCreado))
    } catch (err) {
      setErrorFirma(err instanceof ApiError ? err.message : 'No se pudo enviar la firma al co-investigador.')
    } finally {
      setEnviandoCoinvestigador(false)
    }
  }

  // "Guardar proyecto": solo con todas las firmas obligatorias; es lo que lo
  // manda al visto bueno del líder.
  const firmasObligatoriasCompletas = Boolean(
    firmasEstado?.some((f) => f.rol_firmante === ROL_FIRMA_PRINCIPAL && f.firmado) &&
      firmasEstado.every((f) => !f.obligatoria || f.firmado)
  )
  const faltaGuardarProyecto = !idProyectoCreado || estadoProyectoServidor === 'pendiente_firmas'

  const handleGuardarProyecto = async () => {
    if (!idProyectoCreado) return
    setErrorFirma('')
    setFinalizandoProyecto(true)
    try {
      aplicarEstadoFirmas(await firmasProyectoApi.finalizarFirmas(idProyectoCreado))
      if (claveBorradorRef.current) localStorage.removeItem(claveBorradorRef.current)
      setMostrarProyectoCreado(true)
    } catch (err) {
      setErrorFirma(err instanceof ApiError ? err.message : 'No se pudo guardar el proyecto.')
    } finally {
      setFinalizandoProyecto(false)
    }
  }

  const pasosPorTab: Record<Tab, () => Promise<void>> = {
    hojasvida: guardarHojasVida,
    general: guardarInformacionGeneral,
    grupos: guardarGrupos,
    formulacion: guardarFormulacion,
    marco: guardarMarco,
    cronograma: guardarCronograma,
    resultados: guardarResultados,
    etico: guardarEtico,
    firmas: guardarFirmasYFinalizar,
  }

  const handleGuardarPasoActual = () => {
    pasosPorTab[tab]()
  }

  // "Guardar" (finalizar) solo se habilita en la última pestaña y cuando todo el
  // proyecto está completo — Grupos/Cronograma no tienen campos obligatorios
  // propios; Resultados esperados y Firmas y anexos sí (los productos
  // obligatorios del catálogo y al menos un documento cargado).
  const formularioCompleto =
    camposFaltantesHojaVida().size === 0 &&
    camposFaltantesGeneral().size === 0 &&
    productosObligatoriosFaltantes().length === 0 &&
    !faltaDocumento()

  /** Lista legible de lo que le falta al proyecto — para el title (tooltip) del botón "Guardar" deshabilitado. */
  const descripcionCamposFaltantes = (): string => {
    const partes: string[] = [
      ...[...camposFaltantesHojaVida()].map((campo) => ETIQUETAS_CAMPO_HOJA_VIDA[campo]),
      ...[...camposFaltantesGeneral()].map((campo) => ETIQUETAS_CAMPO_GENERAL[campo]),
      ...productosObligatoriosFaltantes().map((t) => `Producto obligatorio: ${t.nombre}`),
      ...documentosObligatoriosFaltantes().map((nombre) => `Documento obligatorio: ${nombre}`),
    ]
    return partes.join(', ')
  }

  // Pestaña más lejana ya alcanzada (por avance normal o por un salto a una
  // pestaña posterior por campo faltante): todo lo anterior a ella queda
  // disponible para ir y venir, tenga o no contenido — solo lo que está MÁS
  // ADELANTE de ese punto sigue bloqueado hasta alcanzarlo en orden.
  const indiceMaxDesbloqueado = Math.max(0, ...[...tabsDesbloqueadas].map((t) => ordenTabs.indexOf(t)))

  // Red de seguridad además de lo anterior: si una pestaña ya tiene contenido
  // escrito, nunca debe verse bloqueada, sin importar el resto de la lógica
  // (p. ej. un borrador restaurado de antes de este cambio).
  const tabTieneContenido = (t: Tab): boolean => {
    switch (t) {
      case 'hojasvida':
        return hojasVida.some((h) =>
          Object.entries(h).some(([clave, valor]) => clave !== 'id' && typeof valor === 'string' && valor.trim())
        )
      case 'general':
        return Boolean(datosGeneral.titulo.trim()) || idProyectoCreado !== null
      case 'grupos':
        return (
          gruposCesmagSel.some((g) => g.nombre.trim()) ||
          gruposExternosSel.some((g) => g.nombre.trim()) ||
          egresadosInfo.integrantes.some((i) => i.nombreCompleto.trim())
        )
      case 'formulacion':
        return Boolean(
          datosTexto.resumen.trim() || datosTexto.planteamiento.trim() || datosTexto.pregunta.trim() || datosTexto.justificacion.trim()
        )
      case 'marco':
        return Boolean(datosTexto.marcoTeorico.trim() || datosTexto.metodologia.trim())
      case 'cronograma':
        return cronogramas.some((c) => c.actividades.some((a) => a.actividad.trim()))
      case 'resultados':
        return Object.values(cantidadesProducto).some((v) => v.trim())
      case 'etico':
        return Boolean(datosTexto.componenteEtico.trim() || datosTexto.funcionesEstudiante.trim())
      default:
        return false
    }
  }

  // Solo aplica al registro de un proyecto nuevo: en edición "Volver" no
  // borra nada (no hay borrador que descartar), así que no hace falta avisar.
  const formularioTieneContenido = (): boolean => !modoEdicion && ordenTabs.some(tabTieneContenido)

  const handleVolver = () => {
    if (formularioTieneContenido()) {
      setMostrarConfirmarVolver(true)
      return
    }
    // "Volver" es salir a propósito: no se deja borrador para preguntar después.
    if (claveBorradorRef.current) localStorage.removeItem(claveBorradorRef.current)
    salirDelFormulario()
  }

  const confirmarSalirSinGuardar = () => {
    setMostrarConfirmarVolver(false)
    if (claveBorradorRef.current) localStorage.removeItem(claveBorradorRef.current)
    navigate('/proyectos')
  }

  if (modoEdicion && (cargandoEdicion || errorCargaEdicion)) {
    return (
      <div className="crear-proyecto">
        <div className="crear-proyecto-title">
          <button type="button" className="cp-volver-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Volver
          </button>
          <h1>Editar proyecto</h1>
        </div>
        <p style={{ padding: 24, textAlign: 'center', color: errorCargaEdicion ? '#a02020' : '#666' }}>
          {errorCargaEdicion || 'Cargando los datos del proyecto...'}
        </p>
      </div>
    )
  }

  return (
    <div className="crear-proyecto">
      <div className="crear-proyecto-title">
        <button type="button" className="cp-volver-btn" onClick={handleVolver}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <h1>{modoEdicion ? 'Edita la información de tu proyecto' : 'Registra la información de tu proyecto'}</h1>
      </div>

      <div className="crear-proyecto-tabs">
        {tabs.map((t, i) => {
          const bloqueada = i > indiceMaxDesbloqueado && !tabTieneContenido(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className={`cp-tab ${tab === t.id ? 'cp-tab-active' : ''} ${bloqueada ? 'cp-tab-bloqueada' : ''}`}
              onClick={() => !bloqueada && setTab(t.id)}
              disabled={bloqueada}
              title={bloqueada ? 'Completa y guarda las pestañas anteriores para desbloquear esta' : undefined}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {errorEnvio && <p className="cp-form-error">{errorEnvio}</p>}

      <form className="crear-proyecto-form" onSubmit={(e) => e.preventDefault()}>
        {tab === 'hojasvida' && (
          <HojasVida hojasVida={hojasVida} setHojasVida={setHojasVida} camposInvalidos={camposHojaVidaInvalidos} />
        )}
        {tab === 'general' && (
          <InformacionGeneral
            grupos={grupos}
            datos={datosGeneral}
            setDatos={setDatosGeneral}
            modalidades={modalidades}
            areas={areas}
            tiposProyecto={tiposProyecto}
            programas={programas}
            opcionesDuracion={opcionesDuracion}
            cargando={cargandoCatalogos}
            participantesPorGrupo={participantesPorGrupo}
            setParticipantesPorGrupo={setParticipantesPorGrupo}
            dedicaciones={dedicaciones}
            rolesEstudiante={rolesEstudiante}
            camposInvalidos={camposInvalidos}
            estudiantesInvestigadores={estudiantesInvestigadores}
            onAddEstudianteInvestigador={handleAddEstudianteInvestigador}
            onRemoveEstudianteInvestigador={handleRemoveEstudianteInvestigador}
            onActualizarEstudiante={actualizarEstudiante}
          />
        )}
        {tab === 'grupos' && (
          <GruposEgresados
            lineasInvestigacion={lineasInvestigacion}
            ods={ods}
            facultades={facultades}
            programasCompletos={programasCompletos}
            gruposInternosDisponibles={gruposInternosDisponibles}
            gruposCesmagSel={gruposCesmagSel}
            setGruposCesmagSel={setGruposCesmagSel}
            gruposExternosSel={gruposExternosSel}
            setGruposExternosSel={setGruposExternosSel}
            egresadosInfo={egresadosInfo}
            setEgresadosInfo={setEgresadosInfo}
            dedicaciones={dedicaciones}
          />
        )}
        {tab === 'formulacion' && (
          <FormulacionProyecto
            objetivosEspecificos={objetivosEspecificos}
            setObjetivosEspecificos={setObjetivosEspecificos}
            datos={datosTexto}
            setDatos={setDatosTexto}
            camposInvalidos={camposInvalidos}
          />
        )}
        {tab === 'marco' && (
          <MarcoTeoricoMetodologia
            objetivosEspecificos={objetivosEspecificos}
            datos={datosTexto}
            setDatos={setDatosTexto}
            impactos={impactos}
            setImpactos={setImpactos}
            camposInvalidos={camposInvalidos}
          />
        )}
        {tab === 'cronograma' && (
          <Cronograma
            cronogramas={cronogramas}
            setCronogramas={setCronogramas}
            maxCronogramas={Math.max(1, Number(datosGeneral.duracion) || 1)}
          />
        )}
        {tab === 'resultados' && (
          <ResultadosEsperados
            categorias={categoriasProducto}
            cantidades={cantidadesProducto}
            setCantidades={setCantidadesProducto}
            mostrarErrorObligatorios={mostrarErrorProductosObligatorios}
          />
        )}
        {tab === 'etico' && (
          <ComponenteEtico datos={datosTexto} setDatos={setDatosTexto} camposInvalidos={camposInvalidos} />
        )}
        {tab === 'firmas' && (
          <FirmasAnexos
            archivosDocumentos={archivosDocumentos}
            setArchivoDocumento={(nombre, f) => setArchivosDocumentos((actual) => ({ ...actual, [nombre]: f }))}
            mostrarErrorDocumentos={mostrarErrorDocumentos}
            estudiantesInvestigadores={estudiantesInvestigadores}
            archivosActaCompromiso={archivosActaCompromiso}
            setArchivoActaCompromiso={setArchivoActaCompromiso}
            documentosCargados={documentosExistentesPorTipo}
            firmas={firmasEstado}
            errorFirma={errorFirma}
            firmandoPrincipal={enviando}
            onFirmarPrincipal={handleFirmarPrincipal}
            enviandoCoinvestigador={enviandoCoinvestigador}
            onEnviarCoinvestigador={handleEnviarFirmaCoinvestigador}
            formularioCompleto={formularioCompleto}
            descripcionCamposFaltantes={descripcionCamposFaltantes()}
            codigoPrincipalEnviadoA={codigoPrincipalEnviadoA}
            avisoCodigoPrincipal={avisoCodigoPrincipal}
            validandoCodigoPrincipal={validandoCodigoPrincipal}
            onValidarCodigoPrincipal={handleValidarCodigoPrincipal}
            onReenviarCodigoPrincipal={handleReenviarCodigoPrincipal}
          />
        )}

        <div className="crear-proyecto-actions">
          {tab !== 'firmas' && (
            <button type="button" className="cp-siguiente-btn" disabled={enviando} onClick={handleGuardarPasoActual}>
              <Save size={16} />
              {enviando ? 'Guardando...' : 'Siguiente'}
            </button>
          )}
          {/* En edición se deja este botón para guardar los demás cambios
              (textos, documentos) sin tocar de nuevo una firma ya registrada. */}
          {tab === 'firmas' && modoEdicion && (
            <button
              type="button"
              className="cp-save-btn"
              disabled={enviando || !formularioCompleto}
              onClick={handleGuardarPasoActual}
              title={!formularioCompleto ? `Falta por completar: ${descripcionCamposFaltantes()}` : undefined}
            >
              <Save size={16} />
              {enviando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
          {/* Guardado final y manual: solo con todas las firmas obligatorias. */}
          {tab === 'firmas' && faltaGuardarProyecto && (
            <button
              type="button"
              className="cp-save-btn"
              disabled={finalizandoProyecto || !firmasObligatoriasCompletas}
              onClick={handleGuardarProyecto}
              title={
                !firmasObligatoriasCompletas
                  ? 'Se habilita cuando hayan firmado el Investigador(a) Principal y el Co-investigador(a) UNICESMAG.'
                  : undefined
              }
            >
              <Save size={16} />
              {finalizandoProyecto ? 'Guardando...' : 'Guardar proyecto'}
            </button>
          )}
        </div>
        {tab === 'firmas' && faltaGuardarProyecto && !firmasObligatoriasCompletas && (
          <p className="cp-hint-text">
            "Guardar proyecto" se habilita cuando hayan firmado el Investigador(a) Principal y, si lo hay, el
            Co-investigador(a) UNICESMAG. Al guardarlo se envía al líder del grupo para su visto bueno.
          </p>
        )}
        {/* El botón "Guardar" deshabilitado solo mostraba el motivo en el
            title (hover) — se deja visible también como texto para que no
            quede como un bloqueo sin explicación. */}
        {tab === 'firmas' && !formularioCompleto && (
          <p className="cp-campo-error-msg">Falta por completar: {descripcionCamposFaltantes()}</p>
        )}
      </form>

      {mostrarProyectoCreado && (
        <ConfirmModal
          mensaje={
            estadoProyectoServidor === 'pendiente_lider'
              ? 'El proyecto se guardó con todas las firmas y se envió al líder del grupo para su visto bueno.'
              : modoEdicion
                ? 'El proyecto se guardó y quedó pendiente de revisión nuevamente.'
                : 'El proyecto se creó con éxito.'
          }
          botonPrimario={{
            label: 'Ok',
            onClick: () => salirDelFormulario(),
            variante: 'azul',
          }}
          onClose={() => salirDelFormulario()}
        />
      )}

      {mostrarRestaurarBorrador && (
        <ConfirmModal
          mensaje="Tienes un registro de proyecto sin terminar. ¿Quieres continuar donde lo dejaste?"
          botonSecundario={{ label: 'No', onClick: descartarBorrador, variante: 'rojo' }}
          botonPrimario={{ label: 'Sí', onClick: continuarBorrador, variante: 'azul' }}
          onClose={continuarBorrador}
        />
      )}

      {mostrarConfirmarVolver && (
        <ConfirmModal
          mensaje="Tienes información sin guardar en este registro. Si vuelves atrás, se perderá todo lo que llevas ingresado. ¿Deseas seguir diligenciando o salir sin guardar?"
          botonSecundario={{ label: 'Salir sin guardar', onClick: confirmarSalirSinGuardar, variante: 'rojo' }}
          botonPrimario={{ label: 'Seguir diligenciando', onClick: () => setMostrarConfirmarVolver(false), variante: 'azul' }}
          onClose={() => setMostrarConfirmarVolver(false)}
        />
      )}
    </div>
  )
}

interface InformacionGeneralProps {
  grupos: Bloque[]
  datos: DatosGeneral
  setDatos: React.Dispatch<React.SetStateAction<DatosGeneral>>
  modalidades: catalogosApi.CatalogoItem[]
  areas: catalogosApi.CatalogoItem[]
  tiposProyecto: catalogosApi.CatalogoItem[]
  programas: { id_programa: number; nombre: string; tipoPrograma: string | null }[]

  opcionesDuracion: string[]
  cargando: boolean
  participantesPorGrupo: GrupoParticipantes[]
  setParticipantesPorGrupo: React.Dispatch<React.SetStateAction<GrupoParticipantes[]>>
  dedicaciones: catalogosApi.CatalogoItem[]
  rolesEstudiante: catalogosApi.CatalogoItem[]

  camposInvalidos: Set<CampoGeneral>
  estudiantesInvestigadores: EstudianteSlot[]
  onAddEstudianteInvestigador: () => void
  onRemoveEstudianteInvestigador: (index: number) => void
  onActualizarEstudiante: (index: number, cambios: Partial<EstudianteSlot>) => void
}

/**
 * ORCID/Google Académico del participante — se guardan con él en el mismo
 * POST de participantes (ver guardarParticipantesDeGrupo), aparte de la hoja
 * de vida maestra del usuario. Para el investigador principal (slot
 * "principal" del primer grupo), estos dos campos llegan ya autorrellenados
 * desde la Hoja de Vida.
 */
function CamposAcademicos({
  slot,
  onChange,
}: {
  slot: ParticipanteManual
  onChange: (cambios: Partial<ParticipanteManual>) => void
}) {
  return (
    <div className="cp-campos-academicos-row">
      <label>ORCID:</label>
      <input
        type="text"
        className="cp-orcid-input"
        value={slot.orcid}
        onChange={(e) => onChange({ orcid: e.target.value })}
        placeholder="0000-0000-0000-0000"
      />
      <span className="cp-dedicacion-label">Google Académico:</span>
      <input
        type="text"
        className="cp-google-academico-input"
        value={slot.googleAcademico}
        onChange={(e) => onChange({ googleAcademico: e.target.value })}
        placeholder="Enlace del perfil"
      />
    </div>
  )
}

/** Reemplaza al buscador de cuentas existentes: la persona se escribe a mano
 * (nombres, apellidos, correo). Al guardar el proyecto, el backend decide
 * solo si lo vincula a una cuenta existente por ese correo o lo guarda como
 * texto plano (ver participantes.service.ts). */
function EntradaManualParticipante({
  nombres,
  apellidos,
  correo,
  onChange,
  correoError,
}: {
  nombres: string
  apellidos: string
  correo: string
  onChange: (cambios: { nombres?: string; apellidos?: string; correo?: string }) => void
  correoError?: boolean
}) {
  return (
    <div className="cp-participante-manual">
      <input
        type="text"
        className="cp-participante-nombres"
        placeholder="Nombres"
        value={nombres}
        onChange={(e) => onChange({ nombres: capitalizarPrimera(e.target.value) })}
      />
      <input
        type="text"
        className="cp-participante-apellidos"
        placeholder="Apellidos"
        value={apellidos}
        onChange={(e) => onChange({ apellidos: capitalizarPrimera(e.target.value) })}
      />
      <input
        type="email"
        className={`cp-participante-correo${correoError ? ' cp-input-error' : ''}`}
        placeholder="Correo electrónico"
        value={correo}
        onChange={(e) => onChange({ correo: e.target.value })}
      />
    </div>
  )
}

function InformacionGeneral({
  grupos,
  datos,
  setDatos,
  modalidades,
  areas,
  tiposProyecto,
  programas,
  opcionesDuracion,
  cargando,
  participantesPorGrupo,
  setParticipantesPorGrupo,
  dedicaciones,
  rolesEstudiante,
  camposInvalidos,
  estudiantesInvestigadores,
  onAddEstudianteInvestigador,
  onRemoveEstudianteInvestigador,
  onActualizarEstudiante,
}: InformacionGeneralProps) {
  const [tipoProgramaFiltro, setTipoProgramaFiltro] = useState<'pregrado' | 'posgrado' | null>(null)
  const [programaPendiente, setProgramaPendiente] = useState<number | null>(null)
  const programasFiltrados = tipoProgramaFiltro
    ? programas.filter((p) => p.tipoPrograma === tipoProgramaFiltro)
    : programas

  const agregarPrograma = (id: number) => {
    if (!datos.idProgramas.includes(id)) {
      setDatos({ ...datos, idProgramas: [...datos.idProgramas, id] })
    }
    setProgramaPendiente(null)
  }

  const quitarPrograma = (id: number) => {
    setDatos({ ...datos, idProgramas: datos.idProgramas.filter((p) => p !== id) })
  }

  const valorTotal =
    (Number(datos.valorSolicitado) || 0) + (Number(datos.valorContrapartida) || 0)

  const getGrupoP = (grupoId: number): GrupoParticipantes =>
    participantesPorGrupo.find((g) => g.id === grupoId) ?? crearGrupoParticipantesVacio(grupoId)

  const actualizarSlot = (
    grupoId: number,
    slot: keyof Omit<GrupoParticipantes, 'id' | 'cedulaEgresado1' | 'cedulaEgresado2'>,
    cambios: Partial<ParticipanteManual>
  ) => {
    setParticipantesPorGrupo(
      participantesPorGrupo.map((g) =>
        g.id === grupoId ? { ...g, [slot]: { ...g[slot], ...cambios } } : g
      )
    )
  }

  const dedicacionPorDefecto = dedicaciones.find((d) => d.nombre === 'HC')?.id_dedicacion ?? dedicaciones[0]?.id_dedicacion ?? null

  // Los egresados no tienen selector de Dedicación visible (solo Cédula): se
  // les asigna la dedicación por defecto apenas quedan identificados (con
  // correo), igual que antes ocurría al elegirlos del buscador.
  const actualizarEgresado = (
    grupoId: number,
    campo: 'egresado1' | 'egresado2',
    cambios: Partial<ParticipanteManual>
  ) => {
    setParticipantesPorGrupo(
      participantesPorGrupo.map((g) => {
        if (g.id !== grupoId) return g
        const combinado = { ...g[campo], ...cambios }
        if (combinado.correo.trim() && !combinado.idDedicacion) combinado.idDedicacion = dedicacionPorDefecto
        return { ...g, [campo]: combinado }
      })
    )
  }

  const actualizarCedulaEgresado = (
    grupoId: number,
    campo: 'cedulaEgresado1' | 'cedulaEgresado2',
    valor: string
  ) => {
    setParticipantesPorGrupo(
      participantesPorGrupo.map((g) => (g.id === grupoId ? { ...g, [campo]: valor } : g))
    )
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">INFORMACIÓN GENERAL DEL PROYECTO</div>

      <div className="cp-field-row">
        <label>Título del proyecto:</label>
        <input
          type="text"
          className={camposInvalidos.has('titulo') ? 'cp-input-error' : ''}
          value={datos.titulo}
          onChange={(e) => setDatos({ ...datos, titulo: capitalizarPrimera(e.target.value) })}
        />
      </div>
      {camposInvalidos.has('titulo') && <p className="cp-campo-error-msg">El título del proyecto es obligatorio.</p>}

      {grupos.map((grupo) => {
        const gp = getGrupoP(grupo.id)
        return (
          <div className="cp-grupo-block" key={grupo.id}>
            <div className="cp-field-row">
              <label>Investigador(a) Principal UNICESMAG:</label>
              <EntradaManualParticipante
                nombres={gp.principal.nombres}
                apellidos={gp.principal.apellidos}
                correo={gp.principal.correo}
                onChange={(cambios) => actualizarSlot(grupo.id, 'principal', cambios)}
              />
              <span className="cp-dedicacion-label">Dedicación:</span>
              <DedicacionToggle
                name={`dedicacion-principal-${grupo.id}`}
                opciones={['TC', 'MT', 'HC']}
                value={dedicaciones.find((d) => d.id_dedicacion === gp.principal.idDedicacion)?.nombre}
                onChange={(nombre) =>
                  actualizarSlot(grupo.id, 'principal', {
                    idDedicacion: dedicaciones.find((d) => d.nombre === nombre)?.id_dedicacion ?? null,
                  })
                }
              />
            </div>
            <CamposAcademicos
              slot={gp.principal}
              onChange={(cambios) => actualizarSlot(grupo.id, 'principal', cambios)}
            />

            <div className="cp-field-row">
              <label>Co investigador(a) UNICESMAG:</label>
              <EntradaManualParticipante
                nombres={gp.coInvestigador.nombres}
                apellidos={gp.coInvestigador.apellidos}
                correo={gp.coInvestigador.correo}
                onChange={(cambios) => actualizarSlot(grupo.id, 'coInvestigador', cambios)}
              />
              <span className="cp-dedicacion-label">Dedicación:</span>
              <DedicacionToggle
                name={`dedicacion-co-${grupo.id}`}
                opciones={['TC', 'MT', 'HC']}
                value={dedicaciones.find((d) => d.id_dedicacion === gp.coInvestigador.idDedicacion)?.nombre}
                onChange={(nombre) =>
                  actualizarSlot(grupo.id, 'coInvestigador', {
                    idDedicacion: dedicaciones.find((d) => d.nombre === nombre)?.id_dedicacion ?? null,
                  })
                }
              />
            </div>
            <CamposAcademicos
              slot={gp.coInvestigador}
              onChange={(cambios) => actualizarSlot(grupo.id, 'coInvestigador', cambios)}
            />

            <div className="cp-field-row">
              <label>Co investigador(a) Externo(a):</label>
              <EntradaManualParticipante
                nombres={gp.externo1.nombres}
                apellidos={gp.externo1.apellidos}
                correo={gp.externo1.correo}
                onChange={(cambios) => actualizarSlot(grupo.id, 'externo1', cambios)}
              />
              <span className="cp-dedicacion-label">Dedicación:</span>
              <DedicacionToggle
                name={`dedicacion-ext1-${grupo.id}`}
                opciones={['TC', 'MT', 'HC']}
                value={dedicaciones.find((d) => d.id_dedicacion === gp.externo1.idDedicacion)?.nombre}
                onChange={(nombre) =>
                  actualizarSlot(grupo.id, 'externo1', {
                    idDedicacion: dedicaciones.find((d) => d.nombre === nombre)?.id_dedicacion ?? null,
                  })
                }
              />
            </div>
            <CamposAcademicos
              slot={gp.externo1}
              onChange={(cambios) => actualizarSlot(grupo.id, 'externo1', cambios)}
            />

            <div className="cp-field-row">
              <label>Co investigador(a) Externo(a):</label>
              <EntradaManualParticipante
                nombres={gp.externo2.nombres}
                apellidos={gp.externo2.apellidos}
                correo={gp.externo2.correo}
                onChange={(cambios) => actualizarSlot(grupo.id, 'externo2', cambios)}
              />
              <span className="cp-dedicacion-label">Dedicación:</span>
              <DedicacionToggle
                name={`dedicacion-ext2-${grupo.id}`}
                opciones={['TC', 'MT', 'HC']}
                value={dedicaciones.find((d) => d.id_dedicacion === gp.externo2.idDedicacion)?.nombre}
                onChange={(nombre) =>
                  actualizarSlot(grupo.id, 'externo2', {
                    idDedicacion: dedicaciones.find((d) => d.nombre === nombre)?.id_dedicacion ?? null,
                  })
                }
              />
            </div>
            <CamposAcademicos
              slot={gp.externo2}
              onChange={(cambios) => actualizarSlot(grupo.id, 'externo2', cambios)}
            />

            <div className="cp-field-row">
              <label>Co investigador(a) Egresado(a) UNICESMAG:</label>
              <EntradaManualParticipante
                nombres={gp.egresado1.nombres}
                apellidos={gp.egresado1.apellidos}
                correo={gp.egresado1.correo}
                onChange={(cambios) => actualizarEgresado(grupo.id, 'egresado1', cambios)}
              />
              <span className="cp-dedicacion-label">Cédula:</span>
              <input
                type="text"
                className="cp-cedula-manual-input"
                value={gp.cedulaEgresado1}
                onChange={(e) => actualizarCedulaEgresado(grupo.id, 'cedulaEgresado1', e.target.value)}
                placeholder="Cédula"
              />
            </div>

            <div className="cp-field-row">
              <label>Co investigador(a) Egresado(a) UNICESMAG:</label>
              <EntradaManualParticipante
                nombres={gp.egresado2.nombres}
                apellidos={gp.egresado2.apellidos}
                correo={gp.egresado2.correo}
                onChange={(cambios) => actualizarEgresado(grupo.id, 'egresado2', cambios)}
              />
              <span className="cp-dedicacion-label">Cédula:</span>
              <input
                type="text"
                className="cp-cedula-manual-input"
                value={gp.cedulaEgresado2}
                onChange={(e) => actualizarCedulaEgresado(grupo.id, 'cedulaEgresado2', e.target.value)}
                placeholder="Cédula"
              />
            </div>

            {estudiantesInvestigadores.map((est, index) => (
              <div className="cp-field-row cp-field-row-estudiante" key={index}>
                <label>Estudiante Investigador(a):</label>
                <EntradaManualParticipante
                  nombres={est.nombres}
                  apellidos={est.apellidos}
                  correo={est.correo}
                  onChange={(cambios) => onActualizarEstudiante(index, cambios)}
                  correoError={camposInvalidos.has('correoEstudiante') && est.nombres.trim() !== '' && est.correo.trim() === ''}
                />
                <span className="cp-campo-inline">
                  <span className="cp-dedicacion-label">Código estudiantil:</span>
                  <input
                    type="text"
                    className="cp-codigo-input"
                    value={est.codigo}
                    onChange={(e) => onActualizarEstudiante(index, { codigo: e.target.value })}
                    placeholder="Código"
                  />
                </span>
                <span className="cp-campo-inline">
                  <span className="cp-dedicacion-label">Rol del estudiante: *</span>
                  <DedicacionToggle
                    name={`tipo-estudiante-${index}`}
                    opciones={['Auxiliar', 'Asistente']}
                    value={
                      rolesEstudiante.find((r) => r.id_rolestudiante === est.idRolEstudiante)?.nombre === 'auxiliar'
                        ? 'Auxiliar'
                        : rolesEstudiante.find((r) => r.id_rolestudiante === est.idRolEstudiante)?.nombre === 'asistente'
                          ? 'Asistente'
                          : undefined
                    }
                    onChange={(nombre) =>
                      onActualizarEstudiante(index, {
                        idRolEstudiante:
                          rolesEstudiante.find((r) => r.nombre.toLowerCase() === nombre.toLowerCase())
                            ?.id_rolestudiante ?? null,
                      })
                    }
                    error={
                      camposInvalidos.has('rolEstudiante') &&
                      !est.idRolEstudiante &&
                      est.nombres.trim() !== '' &&
                      est.correo.trim() !== ''
                    }
                  />
                </span>
                {estudiantesInvestigadores.length > 1 && (
                  <button
                    type="button"
                    className="cp-grupo-quitar"
                    aria-label="Quitar este estudiante"
                    onClick={() => onRemoveEstudianteInvestigador(index)}
                  >
                    <X size={14} />
                    Quitar
                  </button>
                )}
              </div>
            ))}

            <button type="button" className="cp-add-grupo" onClick={onAddEstudianteInvestigador}>
              <Plus size={14} />
              Añadir otro estudiante investigador
            </button>

            {camposInvalidos.has('correoEstudiante') && (
              <p className="cp-campo-error-msg">
                Completa el correo electrónico de cada estudiante diligenciado: sin correo, el estudiante no
                se guarda como participante del proyecto.
              </p>
            )}
            {camposInvalidos.has('rolEstudiante') && (
              <p className="cp-campo-error-msg">
                Selecciona el rol (Auxiliar o Asistente) de cada estudiante diligenciado: sin ese rol, el
                estudiante no se guarda como participante del proyecto.
              </p>
            )}
          </div>
        )
      })}

      <div className="cp-section-header">MODALIDAD DEL PROYECTO</div>
      <div className={`cp-radio-grid ${camposInvalidos.has('modalidad') ? 'cp-radio-grid-error' : ''}`}>
        {cargando && <p>Cargando modalidades...</p>}
        {modalidades.map((m) => (
          <RadioOption
            key={m.id_modalidad}
            name="modalidad"
            label={m.nombre}
            checked={datos.idModalidad === m.id_modalidad}
            onChange={() => setDatos({ ...datos, idModalidad: m.id_modalidad! })}
          />
        ))}
      </div>
      {camposInvalidos.has('modalidad') && (
        <p className="cp-campo-error-msg">Selecciona una modalidad de proyecto.</p>
      )}

      <div className="cp-section-header">ÁREA DE CONOCIMIENTO A LA QUE APLICA</div>
      <div className="cp-radio-grid cp-radio-grid-3">
        {areas.map((a) => (
          <RadioOption
            key={a.id_area_conocimiento}
            name="area"
            label={a.nombre}
            checked={datos.idArea === a.id_area_conocimiento}
            onChange={() => setDatos({ ...datos, idArea: a.id_area_conocimiento! })}
          />
        ))}
      </div>

      <div className="cp-field-row">
        <label>Programa(s) de pregrado o posgrado al que se articula:</label>
        <div className="cp-programa-tipo-toggle">
          <button
            type="button"
            className={`cp-programa-tipo-btn ${tipoProgramaFiltro === 'pregrado' ? 'cp-programa-tipo-btn-active' : ''}`}
            onClick={() => {
              setTipoProgramaFiltro((actual) => (actual === 'pregrado' ? null : 'pregrado'))
              setProgramaPendiente(null)
            }}
          >
            Pregrado
          </button>
          <button
            type="button"
            className={`cp-programa-tipo-btn ${tipoProgramaFiltro === 'posgrado' ? 'cp-programa-tipo-btn-active' : ''}`}
            onClick={() => {
              setTipoProgramaFiltro((actual) => (actual === 'posgrado' ? null : 'posgrado'))
              setProgramaPendiente(null)
            }}
          >
            Posgrado
          </button>
        </div>
        <div className="cp-programa-agregar-row">
          <select
            className={camposInvalidos.has('programa') ? 'cp-input-error' : ''}
            value={programaPendiente ?? ''}
            onChange={(e) => setProgramaPendiente(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Selecciona un programa</option>
            {programasFiltrados
              .filter((p) => !datos.idProgramas.includes(p.id_programa))
              .map((p) => (
                <option key={p.id_programa} value={p.id_programa}>
                  {p.nombre}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="cp-add-grupo"
            disabled={!programaPendiente}
            onClick={() => programaPendiente && agregarPrograma(programaPendiente)}
          >
            <Plus size={14} />
            Añadir
          </button>
        </div>
        {datos.idProgramas.length > 0 && (
          <ul className="cp-lista-chips">
            {datos.idProgramas.map((id) => {
              const programa = programas.find((p) => p.id_programa === id)
              return (
                <li key={id} className="cp-chip">
                  {programa?.nombre ?? `Programa #${id}`}
                  <button
                    type="button"
                    className="cp-mini-table-quitar cp-item-quitar"
                    aria-label="Quitar este programa"
                    onClick={() => quitarPrograma(id)}
                  >
                    <X size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {camposInvalidos.has('programa') && (
          <p className="cp-campo-error-msg">Selecciona al menos un programa académico al que se articula el proyecto.</p>
        )}
      </div>

      <div className="cp-section-header">LUGAR DE EJECUCIÓN DEL PROYECTO</div>
      <div className="cp-lugar-row">
        <div className="cp-field-col">
          <label>País:</label>
          <input type="text" value={datos.pais} disabled readOnly />
        </div>

        <div className="cp-field-col">
          <label>Departamento:</label>
          {!datos.otroPais ? (
            <select
              className={camposInvalidos.has('departamento') ? 'cp-input-error' : ''}
              value={datos.departamento}
              onChange={(e) => setDatos({ ...datos, departamento: e.target.value, ciudad: '' })}
            >
              <option value="">Selecciona un departamento</option>
              {DEPARTAMENTOS_COLOMBIA.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className={camposInvalidos.has('departamento') ? 'cp-input-error' : ''}
              value={datos.departamento}
              onChange={(e) => setDatos({ ...datos, departamento: capitalizarPrimera(e.target.value) })}
              placeholder="Departamento / provincia / estado"
            />
          )}
          {camposInvalidos.has('departamento') && (
            <p className="cp-campo-error-msg">El departamento es obligatorio.</p>
          )}
        </div>

        <div className="cp-field-col">
          <label>Ciudad:</label>
          {!datos.otroPais ? (
            <select
              className={camposInvalidos.has('ciudad') ? 'cp-input-error' : ''}
              value={datos.ciudad}
              onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })}
              disabled={!datos.departamento}
            >
              <option value="">
                {datos.departamento ? 'Selecciona una ciudad' : 'Primero elige un departamento'}
              </option>
              {(MUNICIPIOS_POR_DEPARTAMENTO[datos.departamento] ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className={camposInvalidos.has('ciudad') ? 'cp-input-error' : ''}
              value={datos.ciudad}
              onChange={(e) => setDatos({ ...datos, ciudad: capitalizarPrimera(e.target.value) })}
              placeholder="Ciudad"
            />
          )}
          {camposInvalidos.has('ciudad') && <p className="cp-campo-error-msg">La ciudad es obligatoria.</p>}
        </div>

        <div className="cp-field-col">
          <label>Duración del proyecto (en periodos):</label>
          <DedicacionToggle
            name="duracion"
            opciones={opcionesDuracion}
            value={datos.duracion}
            onChange={(valor) => setDatos({ ...datos, duracion: valor })}
            error={camposInvalidos.has('duracion')}
          />
          {camposInvalidos.has('duracion') && (
            <p className="cp-campo-error-msg">Selecciona la duración del proyecto.</p>
          )}
        </div>
      </div>

      <div className="cp-field-row">
        <label>¿El proyecto se ejecuta en otro país?</label>
        <select
          value={datos.otroPais}
          onChange={(e) =>
            setDatos({ ...datos, otroPais: e.target.value, departamento: '', ciudad: '' })
          }
        >
          <option value="">Colombia</option>
          {PAISES.filter((p) => p !== 'Colombia').map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="cp-section-header">TIPO DE PROYECTO</div>
      <div className={`cp-radio-grid ${camposInvalidos.has('tipo') ? 'cp-radio-grid-error' : ''}`}>
        {tiposProyecto.map((t) => (
          <RadioOption
            key={t.id_tipo_proyecto}
            name="tipo"
            label={t.nombre}
            checked={datos.idTipoProyecto === t.id_tipo_proyecto}
            onChange={() => setDatos({ ...datos, idTipoProyecto: t.id_tipo_proyecto! })}
          />
        ))}
      </div>
      {camposInvalidos.has('tipo') && <p className="cp-campo-error-msg">Selecciona un tipo de proyecto.</p>}

      <div className="cp-section-header">FINANCIACIÓN TOTAL SOLICITADA</div>
      <div className="cp-field-row">
        <label>Valor solicitado UNICESMAG</label>
        <input
          type="text"
          inputMode="numeric"
          value={formatearMiles(datos.valorSolicitado)}
          onChange={(e) => setDatos({ ...datos, valorSolicitado: soloDigitos(e.target.value) })}
        />
      </div>
      <div className="cp-field-row">
        <label>Valor contrapartida</label>
        <input
          type="text"
          inputMode="numeric"
          value={formatearMiles(datos.valorContrapartida)}
          onChange={(e) => setDatos({ ...datos, valorContrapartida: soloDigitos(e.target.value) })}
        />
      </div>
      <div className="cp-field-row">
        <label>Valor total</label>
        <input type="text" value={valorTotal ? valorTotal.toLocaleString('es-CO') : ''} readOnly />
      </div>
    </div>
  )
}

function CamposGrupoManual({
  sel,
  esExterno,
  facultades,
  programasCompletos,
  gruposDisponibles,
  dedicaciones,
  onCambiar,
}: {
  sel: GrupoSeleccionado
  esExterno: boolean
  facultades: catalogosApi.FacultadItem[]
  programasCompletos: catalogosApi.ProgramaItem[]
  /** Solo aplica cuando esExterno: catálogo TC/MT/HC para la dedicación del director. */
  dedicaciones?: catalogosApi.CatalogoItem[]
  /** Solo aplica cuando !esExterno: catálogo real de grupos UNICESMAG para elegir. */
  gruposDisponibles?: gruposApi.GrupoInvestigacionItem[]
  onCambiar: (cambios: Partial<GrupoSeleccionado>) => void
}) {
  const listaGruposDisponibles = gruposDisponibles ?? []
  // El grupo CESMAG (interno) ya no se diligencia a mano: su información
  // general la administra el líder del grupo (ver GrupoInformacionGeneralForm)
  // de forma centralizada, no proyecto por proyecto. Aquí solo se elige cuál
  // es, y los datos generales se muestran de solo lectura.
  if (!esExterno) {
    const handleSeleccionar = (id_grupo: number | null) => {
      if (!id_grupo) {
        onCambiar({ idGrupoExistente: null, nombre: '', idFacultad: null, idPrograma: null, lider: '', codGruplac: '', reconocidoMinciencias: false, categoria: '', acuerdoInstitucional: '' })
        return
      }
      const g = listaGruposDisponibles.find((x) => x.id_grupo === id_grupo)
      if (!g) return
      onCambiar({
        idGrupoExistente: g.id_grupo,
        nombre: g.nombre,
        idFacultad: g.id_facultad,
        idPrograma: g.id_programa,
        lider: g.lider_grupo ?? '',
        codGruplac: g.cod_gruplac ?? '',
        reconocidoMinciencias: g.reconocido_minciencias,
        categoria: g.categoria ?? '',
        acuerdoInstitucional: g.acuerdo_institucional ?? '',
      })
    }

    const facultadNombre = facultades.find((f) => f.id_facultad === sel.idFacultad)?.nombre
    const programaNombre = programasCompletos.find((p) => p.id_programa === sel.idPrograma)?.nombre

    return (
      <>
        <div className="cp-field-row">
          <label>Grupo de investigación UNICESMAG:</label>
          <select value={sel.idGrupoExistente ?? ''} onChange={(e) => handleSeleccionar(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Selecciona un grupo</option>
            {listaGruposDisponibles.map((g) => (
              <option key={g.id_grupo} value={g.id_grupo}>
                {g.nombre}
              </option>
            ))}
          </select>
        </div>

        {sel.idGrupoExistente && (
          <div className="cp-grupo-info-general-readonly">
            <p className="cp-hint-text">
              Esta información la administra el líder del grupo — para corregirla, contacta al líder o al Administrador.
            </p>
            <div className="cp-field-row">
              <label>Facultad/Departamento:</label>
              <span>{facultadNombre ?? '—'}</span>
            </div>
            <div className="cp-field-row">
              <label>Programa Académico:</label>
              <span>{programaNombre ?? '—'}</span>
            </div>
            <div className="cp-field-row">
              <label>Líder del grupo:</label>
              <span>{sel.lider || '—'}</span>
            </div>
            <div className="cp-field-row">
              <label>Código GrupLac:</label>
              <span>{sel.codGruplac || '—'}</span>
              <span className="cp-dedicacion-label">Reconocido por MINCIENCIAS:</span>
              <span>{sel.reconocidoMinciencias ? 'Sí' : 'No'}</span>
            </div>
            <div className="cp-field-row">
              <label>Categoría:</label>
              <span>{sel.categoria || '—'}</span>
              <span className="cp-dedicacion-label">Acuerdo Institucional:</span>
              <span>{sel.acuerdoInstitucional || '—'}</span>
            </div>
          </div>
        )}
      </>
    )
  }

  const nombreDedicacionDirector = (dedicaciones ?? []).find((d) => d.id_dedicacion === sel.idDedicacionDirector)?.nombre

  return (
    <>
      <div className="cp-field-row">
        <label>Universidad / Entidad:</label>
        <input type="text" value={sel.facultad} onChange={(e) => onCambiar({ facultad: capitalizarPrimera(e.target.value) })} />
      </div>

      <div className="cp-field-row">
        <label>Programa Académico/Dependencia:</label>
        <input type="text" value={sel.programa} onChange={(e) => onCambiar({ programa: capitalizarPrimera(e.target.value) })} />
      </div>

      <div className="cp-field-row">
        <label>Nombre del Grupo:</label>
        <input type="text" value={sel.nombre} onChange={(e) => onCambiar({ nombre: capitalizarPrimera(e.target.value) })} />
      </div>

      <div className="cp-field-row">
        <label>Director del Grupo:</label>
        <input type="text" value={sel.lider} onChange={(e) => onCambiar({ lider: capitalizarPrimera(e.target.value) })} />
        <span className="cp-dedicacion-label">Dedicación:</span>
        <DedicacionToggle
          name={`dedicacion-director-ext-${sel.id}`}
          opciones={['TC', 'MT']}
          value={nombreDedicacionDirector === 'TC' || nombreDedicacionDirector === 'MT' ? nombreDedicacionDirector : undefined}
          onChange={(nombre) =>
            onCambiar({ idDedicacionDirector: (dedicaciones ?? []).find((d) => d.nombre === nombre)?.id_dedicacion ?? null })
          }
        />
      </div>

      <div className="cp-field-row">
        <label>Código GrupLac:</label>
        <input
          type="text"
          className="cp-input-corto"
          value={sel.codGruplac}
          onChange={(e) => onCambiar({ codGruplac: e.target.value })}
        />
        <span className="cp-dedicacion-label">Reconocido por MINCIENCIAS:</span>
        <DedicacionToggle
          name={`minciencias-ext-${sel.id}`}
          opciones={['Sí', 'No']}
          value={sel.reconocidoMinciencias ? 'Sí' : 'No'}
          onChange={(v) => onCambiar({ reconocidoMinciencias: v === 'Sí' })}
        />
      </div>

      {/* Categoría corta y el acuerdo (suele ser largo) ocupando el resto de la línea. */}
      <div className="cp-field-row cp-fila-categoria-acuerdo">
        <label>Categoría:</label>
        <input
          type="text"
          className="cp-input-corto"
          value={sel.categoria}
          onChange={(e) => onCambiar({ categoria: capitalizarPrimera(e.target.value) })}
        />
        <span className="cp-dedicacion-label">Acuerdo Institucional:</span>
        <input
          type="text"
          value={sel.acuerdoInstitucional}
          onChange={(e) => onCambiar({ acuerdoInstitucional: capitalizarPrimera(e.target.value) })}
        />
      </div>
    </>
  )
}

function SelectorOdsMultiple({
  ids,
  onChange,
  ods,
}: {
  ids: number[]
  onChange: (ids: number[]) => void
  ods: catalogosApi.CatalogoItem[]
}) {
  const [pendiente, setPendiente] = useState<number | null>(null)

  const agregar = (id: number) => {
    if (!ids.includes(id)) onChange([...ids, id])
    setPendiente(null)
  }

  const quitar = (id: number) => onChange(ids.filter((x) => x !== id))

  return (
    <>
      <div className="cp-programa-agregar-row">
        <select value={pendiente ?? ''} onChange={(e) => setPendiente(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Selecciona un ODS</option>
          {ods
            .filter((o) => !ids.includes(o.id_ods!))
            .map((o) => (
              <option key={o.id_ods} value={o.id_ods}>
                {o.nombre}
              </option>
            ))}
        </select>
        <button type="button" className="cp-add-grupo" disabled={!pendiente} onClick={() => pendiente && agregar(pendiente)}>
          <Plus size={14} />
          Añadir
        </button>
      </div>
      {ids.length > 0 && (
        <ul className="cp-lista-chips">
          {ids.map((id) => {
            const o = ods.find((x) => x.id_ods === id)
            return (
              <li key={id} className="cp-chip">
                {o?.nombre ?? `ODS #${id}`}
                <button
                  type="button"
                  className="cp-mini-table-quitar cp-item-quitar"
                  aria-label="Quitar este ODS"
                  onClick={() => quitar(id)}
                >
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/** Igual que SelectorOdsMultiple, para elegir más de una línea de investigación de NUESTRO catálogo (solo grupo UNICESMAG). */
function SelectorLineasMultiple({
  ids,
  onChange,
  lineasInvestigacion,
}: {
  ids: number[]
  onChange: (ids: number[]) => void
  lineasInvestigacion: catalogosApi.CatalogoItem[]
}) {
  const [pendiente, setPendiente] = useState<number | null>(null)

  const agregar = (id: number) => {
    if (!ids.includes(id)) onChange([...ids, id])
    setPendiente(null)
  }

  const quitar = (id: number) => onChange(ids.filter((x) => x !== id))

  return (
    <>
      <div className="cp-programa-agregar-row">
        <select value={pendiente ?? ''} onChange={(e) => setPendiente(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Selecciona una línea de investigación</option>
          {lineasInvestigacion
            .filter((l) => !ids.includes(l.id_linea!))
            .map((l) => (
              <option key={l.id_linea} value={l.id_linea}>
                {l.nombre}
              </option>
            ))}
        </select>
        <button type="button" className="cp-add-grupo" disabled={!pendiente} onClick={() => pendiente && agregar(pendiente)}>
          <Plus size={14} />
          Añadir
        </button>
      </div>
      {ids.length > 0 && (
        <ul className="cp-lista-chips">
          {ids.map((id) => {
            const l = lineasInvestigacion.find((x) => x.id_linea === id)
            return (
              <li key={id} className="cp-chip">
                {l?.nombre ?? `Línea #${id}`}
                <button
                  type="button"
                  className="cp-mini-table-quitar cp-item-quitar"
                  aria-label="Quitar esta línea de investigación"
                  onClick={() => quitar(id)}
                >
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/**
 * Lista de textos libres con "añadir otro"/"quitar" — para datos de
 * entidades externas de las que no tenemos catálogo (línea de investigación
 * y línea medular de un grupo externo), donde puede haber más de un valor.
 * Siempre deja al menos una casilla visible para escribir.
 */
function ListaTextoLibre({
  valores,
  onChange,
  placeholder,
}: {
  valores: string[]
  onChange: (valores: string[]) => void
  placeholder: string
}) {
  const actualizar = (index: number, valor: string) => {
    onChange(valores.map((v, i) => (i === index ? capitalizarPrimera(valor) : v)))
  }
  const quitar = (index: number) => {
    const resto = valores.filter((_, i) => i !== index)
    onChange(resto.length > 0 ? resto : [''])
  }

  return (
    <div className="cp-lista-texto-libre">
      {valores.map((valor, index) => (
        <div className="cp-lista-texto-libre-fila" key={index}>
          <input type="text" value={valor} placeholder={placeholder} onChange={(e) => actualizar(index, e.target.value)} />
          {valores.length > 1 && (
            <button
              type="button"
              className="cp-mini-table-quitar cp-item-quitar"
              aria-label="Quitar este valor"
              onClick={() => quitar(index)}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="cp-add-grupo" onClick={() => onChange([...valores, ''])}>
        <Plus size={14} />
        Añadir otra
      </button>
    </div>
  )
}

interface GruposEgresadosProps {
  lineasInvestigacion: catalogosApi.CatalogoItem[]
  ods: catalogosApi.CatalogoItem[]
  facultades: catalogosApi.FacultadItem[]
  programasCompletos: catalogosApi.ProgramaItem[]
  gruposInternosDisponibles: gruposApi.GrupoInvestigacionItem[]
  gruposCesmagSel: GrupoSeleccionado[]
  setGruposCesmagSel: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>
  gruposExternosSel: GrupoSeleccionado[]
  setGruposExternosSel: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>
  egresadosInfo: EgresadosSeccion
  setEgresadosInfo: React.Dispatch<React.SetStateAction<EgresadosSeccion>>
  dedicaciones: catalogosApi.CatalogoItem[]
}

function GruposEgresados({
  dedicaciones,
  lineasInvestigacion,
  ods,
  facultades,
  programasCompletos,
  gruposInternosDisponibles,
  gruposCesmagSel,
  setGruposCesmagSel,
  gruposExternosSel,
  setGruposExternosSel,
  egresadosInfo,
  setEgresadosInfo,
}: GruposEgresadosProps) {
  const actualizarSel = (
    lista: GrupoSeleccionado[],
    setLista: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>,
    id: number,
    cambios: Partial<GrupoSeleccionado>
  ) => {
    setLista(lista.map((g) => (g.id === id ? { ...g, ...cambios } : g)))
  }

  const actualizarEgresados = (cambios: Partial<EgresadosSeccion>) => setEgresadosInfo((actual) => ({ ...actual, ...cambios }))

  const quitarGrupoSel = (
    lista: GrupoSeleccionado[],
    setLista: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>,
    id: number
  ) => {
    if (lista.length <= 1) return
    setLista(lista.filter((g) => g.id !== id))
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">
        GRUPO DE INVESTIGACIÓN AL CUAL ESTÁ ADSCRITO EL PROYECTO EN UNICESMAG
      </div>

      {gruposCesmagSel.map((sel, index) => (
        <div className="cp-grupo-block" key={sel.id}>
          {gruposCesmagSel.length > 1 && (
            <div className="cp-grupo-header">
              <p className="cp-grupo-label">Grupo UNICESMAG {index + 1}</p>
              <button
                type="button"
                className="cp-grupo-quitar"
                aria-label="Quitar este grupo"
                onClick={() => quitarGrupoSel(gruposCesmagSel, setGruposCesmagSel, sel.id)}
              >
                <X size={14} />
                Quitar
              </button>
            </div>
          )}

          <CamposGrupoManual
            sel={sel}
            esExterno={false}
            facultades={facultades}
            programasCompletos={programasCompletos}
            gruposDisponibles={gruposInternosDisponibles}
            onCambiar={(cambios) => actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, cambios)}
          />

          <div className="cp-field-row">
            <label>Línea(s) activa(s) de Investigación en la(s) cual(es) está vinculado el proyecto:</label>
            <SelectorLineasMultiple
              ids={sel.idsLinea}
              onChange={(idsLinea) => actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, { idsLinea })}
              lineasInvestigacion={lineasInvestigacion}
            />
          </div>

          <div className="cp-field-row">
            <label>Objetivo(s) de Desarrollo Sostenible ODS en el (los) cual(es) está asociado el proyecto (Obligatorio):</label>
            <SelectorOdsMultiple
              ids={sel.idsOds}
              onChange={(idsOds) => actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, { idsOds })}
              ods={ods}
            />
          </div>

          <InvestigadoresMiniTable
            idBase={`cesmag-${sel.id}`}
            lista={sel.investigadoresExtra}
            setLista={(lista) => actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, { investigadoresExtra: lista })}
          />
        </div>
      ))}

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() => setGruposCesmagSel([...gruposCesmagSel, grupoSeleccionadoVacio(Date.now())])}
      >
        <Plus size={14} />
        Añadir otro grupo UNICESMAG
      </button>

      <div className="cp-section-header">GRUPO DE INVESTIGACIÓN EXTERNO</div>

      {gruposExternosSel.map((sel, index) => (
        <div className="cp-grupo-block" key={sel.id}>
          {gruposExternosSel.length > 1 && (
            <div className="cp-grupo-header">
              <p className="cp-grupo-label">Grupo externo {index + 1}</p>
              <button
                type="button"
                className="cp-grupo-quitar"
                aria-label="Quitar este grupo"
                onClick={() => quitarGrupoSel(gruposExternosSel, setGruposExternosSel, sel.id)}
              >
                <X size={14} />
                Quitar
              </button>
            </div>
          )}

          <CamposGrupoManual
            sel={sel}
            esExterno
            facultades={facultades}
            programasCompletos={programasCompletos}
            dedicaciones={dedicaciones}
            onCambiar={(cambios) => actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, cambios)}
          />

          <div className="cp-field-row">
            <label>
              Línea(s) activa(s) de Investigación en la(s) cual(es) está vinculado el proyecto (de la entidad externa,
              texto libre):
            </label>
            <ListaTextoLibre
              valores={sel.lineasExternas}
              onChange={(lineasExternas) => actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, { lineasExternas })}
              placeholder="Línea de investigación"
            />
          </div>

          <div className="cp-field-row">
            <label>Línea(s) medular(es) Institucional(es) en la(s) cual(es) está asociado el proyecto (Obligatorio):</label>
            <ListaTextoLibre
              valores={sel.lineasMedulares}
              onChange={(lineasMedulares) => actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, { lineasMedulares })}
              placeholder="Línea medular"
            />
          </div>

          <InvestigadoresMiniTable
            idBase={`ext-${sel.id}`}
            lista={sel.investigadoresExtra}
            setLista={(lista) => actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, { investigadoresExtra: lista })}
          />
        </div>
      ))}

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() => setGruposExternosSel([...gruposExternosSel, grupoSeleccionadoVacio(Date.now())])}
      >
        <Plus size={14} />
        Añadir otro grupo externo
      </button>

      <div className="cp-section-header">INFORMACIÓN GENERAL DE EGRESADOS(AS)</div>

      <div className="cp-grupo-block">
        <div className="cp-field-row">
          <label>Facultad</label>
          <select
            value={egresadosInfo.idFacultad ?? ''}
            onChange={(e) => actualizarEgresados({ idFacultad: e.target.value ? Number(e.target.value) : null, idPrograma: null })}
          >
            <option value="">Selecciona una facultad</option>
            {facultades.map((f) => (
              <option key={f.id_facultad} value={f.id_facultad}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="cp-field-row">
          <label>Programa Académico</label>
          <select
            value={egresadosInfo.idPrograma ?? ''}
            onChange={(e) => actualizarEgresados({ idPrograma: e.target.value ? Number(e.target.value) : null })}
            disabled={!egresadosInfo.idFacultad}
          >
            <option value="">{egresadosInfo.idFacultad ? 'Selecciona un programa' : 'Primero elige una facultad'}</option>
            {programasCompletos
              .filter((p) => p.id_facultad === egresadosInfo.idFacultad)
              .map((p) => (
                <option key={p.id_programa} value={p.id_programa}>
                  {p.nombre}
                </option>
              ))}
          </select>
        </div>
        <div className="cp-field-row">
          <label>Empresa o Entidad</label>
          <input type="text" value={egresadosInfo.empresa} onChange={(e) => actualizarEgresados({ empresa: capitalizarPrimera(e.target.value) })} />
        </div>

        <InvestigadoresMiniTable
          idBase="egresados"
          titulo="Co investigador(a) Egresado(a)"
          textoAgregar="Agregar integrante"
          lista={egresadosInfo.integrantes}
          setLista={(integrantes) => actualizarEgresados({ integrantes })}
        />
      </div>
    </div>
  )
}

interface FormulacionProyectoProps {
  objetivosEspecificos: ItemLista[]
  setObjetivosEspecificos: (items: ItemLista[]) => void
  datos: DatosTexto
  setDatos: React.Dispatch<React.SetStateAction<DatosTexto>>
  camposInvalidos: Set<CampoGeneral>
}

function FormulacionProyecto({
  objetivosEspecificos,
  setObjetivosEspecificos,
  datos,
  setDatos,
  camposInvalidos,
}: FormulacionProyectoProps) {
  const actualizarItem = (
    lista: ItemLista[],
    setLista: (items: ItemLista[]) => void,
    id: number,
    texto: string
  ) => {
    setLista(lista.map((item) => (item.id === id ? { ...item, texto } : item)))
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">RESÚMEN</div>
      <TextareaConContador
        value={datos.resumen}
        onChange={(v) => setDatos({ ...datos, resumen: v })}
        claveLimite="resumen"
        claseWrapper={camposInvalidos.has('resumen') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('resumen') && <p className="cp-campo-error-msg">El resumen es obligatorio.</p>}

      <div className="cp-section-header">DESCRIPCIÓN DEL PROYECTO</div>

      <div className="cp-subheader">Planteamiento del problema</div>
      <TextareaConContador
        value={datos.planteamiento}
        onChange={(v) => setDatos({ ...datos, planteamiento: v })}
        claveLimite="planteamientoProblema"
        placeholder="Al menos 2 citas con sus correspondientes referencias"
        claseWrapper={camposInvalidos.has('planteamiento') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('planteamiento') && (
        <p className="cp-campo-error-msg">El planteamiento del problema es obligatorio.</p>
      )}

      <div className="cp-subheader">Pregunta de investigación</div>
      <TextareaConContador
        value={datos.pregunta}
        onChange={(v) => setDatos({ ...datos, pregunta: v })}
        claveLimite="preguntaInvestigacion"
        placeholder="Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio"
        claseWrapper={camposInvalidos.has('pregunta') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('pregunta') && (
        <p className="cp-campo-error-msg">La pregunta de investigación es obligatoria.</p>
      )}

      <div className="cp-subheader">Justificación</div>
      <TextareaConContador
        value={datos.justificacion}
        onChange={(v) => setDatos({ ...datos, justificacion: v })}
        claveLimite="justificacion"
        claseWrapper={camposInvalidos.has('justificacion') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('justificacion') && <p className="cp-campo-error-msg">La justificación es obligatoria.</p>}

      <div className="cp-subheader">Objetivo general</div>
      <TextareaConContador
        value={datos.objetivoGeneral}
        onChange={(v) => setDatos({ ...datos, objetivoGeneral: v })}
        claveLimite="objetivoGeneral"
      />

      <div className="cp-subheader">Objetivos específicos</div>
      {objetivosEspecificos.map((item, index) => (
        <div className="cp-numbered-item" key={item.id}>
          <span className="cp-numbered-index">{index + 1}.</span>
          <TextareaConContador
            value={item.texto}
            onChange={(v) => actualizarItem(objetivosEspecificos, setObjetivosEspecificos, item.id, v)}
            claveLimite="objetivoEspecifico"
            claseWrapper="cp-textarea-numbered"
          />
          {index >= 3 && (
            <button
              type="button"
              className="cp-mini-table-quitar cp-item-quitar"
              aria-label="Quitar este objetivo específico"
              onClick={() => setObjetivosEspecificos(objetivosEspecificos.filter((o) => o.id !== item.id))}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="cp-add-grupo"
        onClick={() =>
          setObjetivosEspecificos([...objetivosEspecificos, { id: Date.now(), texto: '' }])
        }
      >
        <Plus size={14} />
        Añadir otro objetivo específico
      </button>

      <div className="cp-subheader">Antecedentes</div>
      <p className="cp-hint-text">
        Máximo recomendado: 5 antecedentes, preferiblemente de los últimos 5 años. Enumera cada antecedente (1., 2., 3., ...).
      </p>
      <TextareaAutoajustable
        className="cp-textarea"
        value={datos.antecedentes}
        placeholder={'1. Primer antecedente\n2. Segundo antecedente\n...'}
        onChange={(e) => setDatos({ ...datos, antecedentes: capitalizarPrimera(e.target.value) })}
      />
    </div>
  )
}

interface MarcoTeoricoMetodologiaProps {
  objetivosEspecificos: ItemLista[]
  datos: DatosTexto
  setDatos: React.Dispatch<React.SetStateAction<DatosTexto>>
  impactos: Record<number, ImpactoPorObjetivo>
  setImpactos: React.Dispatch<React.SetStateAction<Record<number, ImpactoPorObjetivo>>>
  camposInvalidos: Set<CampoGeneral>
}

function MarcoTeoricoMetodologia({
  objetivosEspecificos,
  datos,
  setDatos,
  impactos,
  setImpactos,
  camposInvalidos,
}: MarcoTeoricoMetodologiaProps) {
  const impactoVacio: ImpactoPorObjetivo = { impactoEsperado: '', beneficiarioPotencial: '', indicadorVerificable: '' }
  const getImpacto = (id: number): ImpactoPorObjetivo => impactos[id] ?? impactoVacio

  const actualizarImpacto = (id: number, cambios: Partial<ImpactoPorObjetivo>) => {
    setImpactos({
      ...impactos,
      [id]: { ...getImpacto(id), ...cambios },
    })
  }

  const actualizarImpactoEsperado = (id: number, valor: string) => actualizarImpacto(id, { impactoEsperado: valor })
  const actualizarBeneficiario = (id: number, valor: string) => actualizarImpacto(id, { beneficiarioPotencial: valor })
  const actualizarIndicador = (id: number, valor: string) => actualizarImpacto(id, { indicadorVerificable: valor })

  return (
    <div className="cp-section">
      <div className="cp-section-header">
        MARCO TEÓRICO PRELIMINAR (MÁXIMO 2000 PALABRAS Y AL MENOS 10 CITAS CON SUS CORRESPONDIENTES
        REFERENCIAS PREFERIBLEMENTE DE LOS ÚLTIMOS 5 AÑOS)
      </div>
      <TextareaConContador
        value={datos.marcoTeorico}
        onChange={(v) => setDatos({ ...datos, marcoTeorico: v })}
        claveLimite="marcoTeorico"
        placeholder="Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio"
        claseWrapper={camposInvalidos.has('marcoTeorico') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('marcoTeorico') && <p className="cp-campo-error-msg">El marco teórico es obligatorio.</p>}

      <div className="cp-section-header">METODOLOGÍA PRELIMINAR PROPUESTA</div>
      <TextareaConContador
        value={datos.metodologia}
        onChange={(v) => setDatos({ ...datos, metodologia: v })}
        claveLimite="metodologia"
        placeholder="Mencionar Paradigma, Enfoque, Método, Técnicas de recolección de información y demás aspectos pertinentes al enfoque. Además, determinar las acciones por cada objetivo específico"
        claseWrapper={camposInvalidos.has('metodologia') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('metodologia') && (
        <p className="cp-campo-error-msg">La metodología preliminar es obligatoria.</p>
      )}

      <div className="cp-section-header">IMPACTO (POR CADA OBJETIVO ESPECÍFICO)</div>

      <table className="cp-impacto-table">
        <thead>
          <tr>
            <th className="cp-impacto-label">Objetivo específico</th>
            <th className="cp-impacto-label">Impacto esperado</th>
            <th className="cp-impacto-label">Beneficiario potencial</th>
            <th className="cp-impacto-label">Indicador verificable</th>
          </tr>
        </thead>
        <tbody>
          {objetivosEspecificos.map((obj, index) => (
            <tr key={obj.id}>
              <td className="cp-impacto-value cp-impacto-objetivo">
                {obj.texto || `Objetivo específico ${index + 1}`}
              </td>
              <td className="cp-impacto-value">
                <TextareaAutoajustable
                  className="cp-impacto-textarea"
                  rows={1}
                  value={getImpacto(obj.id).impactoEsperado}
                  onChange={(e) => {
                    actualizarImpactoEsperado(obj.id, capitalizarPrimera(e.target.value))
                  }}
                />
              </td>
              <td className="cp-impacto-value">
                <TextareaAutoajustable
                  className="cp-impacto-textarea"
                  rows={1}
                  value={getImpacto(obj.id).beneficiarioPotencial}
                  onChange={(e) => {
                    actualizarBeneficiario(obj.id, capitalizarPrimera(e.target.value))
                  }}
                />
              </td>
              <td className="cp-impacto-value">
                <TextareaAutoajustable
                  className="cp-impacto-textarea"
                  rows={1}
                  value={getImpacto(obj.id).indicadorVerificable}
                  onChange={(e) => {
                    actualizarIndicador(obj.id, capitalizarPrimera(e.target.value))
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cp-section-header">REFERENCIAS</div>
      <p className="cp-hint-text">
        Pega aquí todas las referencias de una vez, una por línea (ej. Apellido, A. (Año). Título del trabajo. Editorial/Revista.).
      </p>
      <TextareaAutoajustable
        className="cp-textarea"
        value={datos.referencias}
        placeholder={'Apellido, A. (Año). Título del trabajo. Editorial/Revista.\nApellido, B. (Año). Título del trabajo. Editorial/Revista.\n...'}
        onChange={(e) => setDatos({ ...datos, referencias: capitalizarPrimera(e.target.value) })}
      />
    </div>
  )
}

/** Responsable de una actividad del cronograma, escrito a mano (texto libre,
 * no una cuenta del sistema). */
interface ActividadCronograma {
  id: number
  actividad: string
  resultado: string
  // Texto libre (nombre, lo que sea) — no crea ni busca ninguna cuenta, es
  // solo una etiqueta informativa. El vínculo real de la actividad sigue
  // siendo quien crea el proyecto (ver guardarCronograma).
  responsable: string
  anio: string
  meses: boolean[]
}

interface CronogramaBloque {
  id: number
  actividades: ActividadCronograma[]
}

function mesesDelBloque(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1)
}

function crearActividadVacia(): ActividadCronograma {
  return {
    id: Date.now() + Math.random(),
    actividad: '',
    resultado: '',
    responsable: '',
    anio: '2025',
    meses: Array(mesesDelBloque().length).fill(false),
  }
}

/** Años seleccionables para un bloque del cronograma: desde 2025 hasta 15
 * años adelante del actual, para que proyectos de larga duración o de años
 * futuros no se queden sin opción en el selector. */
function añosCronogramaDisponibles(): number[] {
  const hasta = new Date().getFullYear() + 15
  const desde = Math.min(2025, hasta)
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
}

/** Repara un borrador guardado con un formato viejo de "responsable(s)" (de
 * antes de que este campo fuera un solo texto libre) para que no rompa la
 * pantalla al restaurarlo. */
function normalizarActividad(valor: unknown): ActividadCronograma {
  const vacia = crearActividadVacia()
  if (!valor || typeof valor !== 'object') return vacia
  const a = valor as Partial<ActividadCronograma> & {
    responsables?: unknown[]
    responsable?: unknown
  }
  let responsable = ''
  if (typeof a.responsable === 'string') {
    responsable = a.responsable
  } else if (a.responsable && typeof a.responsable === 'object') {
    // Formato intermedio: { nombres, apellidos, correo }
    const r = a.responsable as { nombres?: string; apellidos?: string }
    responsable = [r.nombres, r.apellidos].filter(Boolean).join(' ').trim()
  } else if (Array.isArray(a.responsables) && a.responsables[0] && typeof a.responsables[0] === 'object') {
    // Formato original: lista de { nombres, apellidos }
    const r = a.responsables[0] as { nombres?: string; apellidos?: string }
    responsable = [r.nombres, r.apellidos].filter(Boolean).join(' ').trim()
  }
  return {
    id: typeof a.id === 'number' ? a.id : vacia.id,
    actividad: typeof a.actividad === 'string' ? a.actividad : '',
    resultado: typeof a.resultado === 'string' ? a.resultado : '',
    responsable,
    anio: typeof a.anio === 'string' ? a.anio : vacia.anio,
    meses: Array.isArray(a.meses) ? a.meses : vacia.meses,
  }
}

function normalizarCronogramaBloque(valor: unknown): CronogramaBloque {
  if (!valor || typeof valor !== 'object') return { id: Date.now() + Math.random(), actividades: [crearActividadVacia()] }
  const c = valor as Partial<CronogramaBloque>
  return {
    id: typeof c.id === 'number' ? c.id : Date.now() + Math.random(),
    actividades: Array.isArray(c.actividades) && c.actividades.length > 0
      ? c.actividades.map(normalizarActividad)
      : [crearActividadVacia()],
  }
}

interface CronogramaProps {
  cronogramas: CronogramaBloque[]
  setCronogramas: React.Dispatch<React.SetStateAction<CronogramaBloque[]>>
  maxCronogramas: number
}

function Cronograma({ cronogramas, setCronogramas, maxCronogramas }: CronogramaProps) {
  const addCronograma = () => {
    if (cronogramas.length >= maxCronogramas) return
    const nuevoIndice = cronogramas.length
    // Periodo 2 hereda el año del Periodo 1 recién agregado; un nuevo
    // Periodo 1 (cada 2 bloques) sugiere el año siguiente al de la pareja
    // anterior — el usuario igual puede cambiarlo con el selector de año.
    let añoSugerido = cronogramas[nuevoIndice - 1]?.actividades[0]?.anio
    if (nuevoIndice % 2 === 0 && nuevoIndice >= 2) {
      const añoAnterior = Number(cronogramas[nuevoIndice - 2]?.actividades[0]?.anio ?? añoSugerido)
      añoSugerido = Number.isFinite(añoAnterior) ? String(añoAnterior + 1) : añoSugerido
    }
    const actividad = crearActividadVacia()
    setCronogramas([
      ...cronogramas,
      { id: Date.now(), actividades: [{ ...actividad, anio: añoSugerido ?? actividad.anio }] },
    ])
  }

  const addActividad = (cronogramaId: number) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id === cronogramaId ? { ...c, actividades: [...c.actividades, crearActividadVacia()] } : c
      )
    )
  }

  const quitarCronograma = (cronogramaId: number) => {
    if (cronogramas.length <= 1) return
    setCronogramas(cronogramas.filter((c) => c.id !== cronogramaId))
  }

  const quitarActividad = (cronogramaId: number, actividadId: number) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id !== cronogramaId || c.actividades.length <= 1
          ? c
          : { ...c, actividades: c.actividades.filter((a) => a.id !== actividadId) }
      )
    )
  }

  const actualizarActividad = (
    cronogramaId: number,
    actividadId: number,
    campo: 'actividad' | 'resultado' | 'anio',
    valor: string
  ) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id !== cronogramaId
          ? c
          : {
            ...c,
            actividades: c.actividades.map((a) =>
              a.id === actividadId ? { ...a, [campo]: valor } : a
            ),
          }
      )
    )
  }

  const actualizarResponsable = (cronogramaId: number, actividadId: number, valor: string) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id !== cronogramaId
          ? c
          : {
            ...c,
            actividades: c.actividades.map((a) => (a.id === actividadId ? { ...a, responsable: valor } : a)),
          }
      )
    )
  }

  const toggleMes = (cronogramaId: number, actividadId: number, mesIndex: number) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id !== cronogramaId
          ? c
          : {
            ...c,
            actividades: c.actividades.map((a) => {
              if (a.id !== actividadId) return a
              const nuevosMeses = [...a.meses]
              nuevosMeses[mesIndex] = !nuevosMeses[mesIndex]
              return { ...a, meses: nuevosMeses }
            }),
          }
      )
    )
  }

  return (
    <div className="cp-section">
      {cronogramas.map((cronograma, cIndex) => {
      const meses = mesesDelBloque()
      const nombrePeriodo = cIndex % 2 === 0 ? 'Periodo 1' : 'Periodo 2'
      return (
        <div key={cronograma.id}>
          <div className="cp-section-header cp-cronograma-titulo">
            CRONOGRAMA DE ACTIVIDADES
            {cronogramas.length > 1 && (
              <button
                type="button"
                className="cp-cronograma-quitar"
                aria-label="Quitar este cronograma"
                onClick={() => quitarCronograma(cronograma.id)}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="cp-table-scroll">
          <table className="cp-cronograma-table">
            <thead>
              <tr>
                <th className="cp-col-actividad" rowSpan={2}>Actividad</th>
                <th className="cp-col-resultado" rowSpan={2}>Resultado</th>
                <th className="cp-col-responsable" rowSpan={2}>Responsable</th>
                <th colSpan={meses.length}>
                  <div className="cp-periodo-header">
                    <span>{nombrePeriodo} - Año</span>
                    <select
                      value={cronograma.actividades[0]?.anio}
                      onChange={(e) => {
                        const nuevoAño = e.target.value
                        setCronogramas(
                          cronogramas.map((c) =>
                            c.id !== cronograma.id
                              ? c
                              : { ...c, actividades: c.actividades.map((a) => ({ ...a, anio: nuevoAño })) }
                          )
                        )
                      }}
                    >
                      {añosCronogramaDisponibles().map((año) => (
                        <option key={año} value={año}>{año}</option>
                      ))}
                    </select>
                    <span>/Mes</span>
                  </div>
                </th>
                <th className="cp-col-quitar" rowSpan={2} aria-hidden="true" />
              </tr>
              <tr>
                {meses.map((mes) => (
                  <th key={mes} className="cp-mes-header">{mes}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {cronograma.actividades.map((a) => (
                <tr key={a.id}>
                  <td className="cp-col-actividad">
                    <input
                      type="text"
                      value={a.actividad}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'actividad', capitalizarPrimera(e.target.value))}
                    />
                  </td>
                  <td className="cp-col-resultado">
                    <input
                      type="text"
                      value={a.resultado}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'resultado', capitalizarPrimera(e.target.value))}
                    />
                  </td>
                  <td className="cp-col-responsable">
                    {(() => {
                      // Varios responsables van en el mismo texto, uno por línea.
                      const responsables = a.responsable.split('\n')
                      const cambiar = (nuevos: string[]) =>
                        actualizarResponsable(cronograma.id, a.id, nuevos.join('\n'))
                      return (
                        <div className={`cp-responsables-lista ${responsables.length > 1 ? 'cp-responsables-varios' : ''}`}>
                          {responsables.map((nombre, i) => (
                            <div key={i} className="cp-responsable-fila">
                              <input
                                type="text"
                                value={nombre}
                                aria-label={`Responsable ${i + 1}`}
                                onChange={(e) => cambiar(responsables.map((r, j) => (j === i ? capitalizarPrimera(e.target.value) : r)))}
                              />
                              <div className="cp-responsable-acciones">
                                {responsables.length > 1 && (
                                  <button
                                    type="button"
                                    className="cp-responsable-btn cp-responsable-btn-quitar"
                                    aria-label={`Quitar responsable ${i + 1}`}
                                    title="Quitar responsable"
                                    onClick={() => cambiar(responsables.filter((_, j) => j !== i))}
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                                {i === responsables.length - 1 && (
                                  <button
                                    type="button"
                                    className="cp-responsable-btn cp-responsable-btn-agregar"
                                    aria-label="Agregar responsable"
                                    title="Agregar responsable"
                                    onClick={() => cambiar([...responsables, ''])}
                                  >
                                    <Plus size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </td>
                  {a.meses.map((marcado, mesIndex) => (
                    <td key={mesIndex} className="cp-mes-cell">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggleMes(cronograma.id, a.id, mesIndex)}
                      />
                    </td>
                  ))}
                  <td className="cp-col-quitar">
                    {cronograma.actividades.length > 1 && (
                      <button
                        type="button"
                        className="cp-mini-table-quitar"
                        aria-label="Quitar esta actividad"
                        onClick={() => quitarActividad(cronograma.id, a.id)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <button
            type="button"
            className="cp-add-grupo"
            onClick={() => addActividad(cronograma.id)}
          >
            <Plus size={14} />
            Añadir otra actividad
          </button>
        </div>
      )})}

      {cronogramas.length < maxCronogramas && (
        <button type="button" className="cp-add-grupo cp-add-cronograma" onClick={addCronograma}>
          <Plus size={14} />
          Añadir otro cronograma
        </button>
      )}
    </div>
  )
}

interface ResultadosEsperadosProps {
  categorias: CategoriaProductoLocal[]
  cantidades: Record<number, string>
  setCantidades: React.Dispatch<React.SetStateAction<Record<number, string>>>
  /** true = ya se intentó guardar y falta alguno de estos — recién ahí se resaltan en rojo. */
  mostrarErrorObligatorios: boolean
}

function CeldaCantidadProducto({
  tipo,
  cantidades,
  manejarCambioCantidad,
  mostrarErrorObligatorios,
}: {
  tipo: TipoProductoLocal
  cantidades: Record<number, string>
  manejarCambioCantidad: (idTipo: number, valor: string) => void
  mostrarErrorObligatorios: boolean
}) {
  const vacio = !(Number(cantidades[tipo.id]) > 0)
  const conError = tipo.obligatorio && vacio && mostrarErrorObligatorios
  return (
    <td className="cp-resultados-td-numero">
      <input
        type="text"
        inputMode="numeric"
        className={conError ? 'cp-input-error' : ''}
        value={cantidades[tipo.id] ?? ''}
        onChange={(e) => manejarCambioCantidad(tipo.id, e.target.value)}
      />
    </td>
  )
}

function BloqueCategoriaProducto({
  cat,
  cantidades,
  actualizarCantidad,
  mostrarErrorObligatorios,
}: {
  cat: CategoriaProductoLocal
  cantidades: Record<number, string>
  actualizarCantidad: (idTipo: number, valor: string) => void
  mostrarErrorObligatorios: boolean
}) {
  const manejarCambioCantidad = (idTipo: number, valorCrudo: string) => {
    actualizarCantidad(idTipo, valorCrudo.replace(/[^0-9]/g, ''))
  }
  const nombreConMarca = (nombre: string, obligatorio: boolean) => (obligatorio ? `${nombre} *` : nombre)

  return (
    <div>
      <div className="cp-section-header cp-resultados-header">
        {cat.nombre}
        {cat.subtitulo && <span className="cp-resultados-subtitulo">{cat.subtitulo}</span>}
      </div>

      <div className="cp-table-scroll">
        <table className="cp-resultados-table">
          <thead>
            <tr>
              <th colSpan={2}>Categoría</th>
              <th className="cp-resultados-th-numero">Número de productos</th>
            </tr>
          </thead>
          <tbody>
            {cat.subcategorias.map((sub) => {
              if (sub.tipos.length === 1 && sub.tipos[0].nombre === sub.nombre) {

                const tipo = sub.tipos[0]
                return (
                  <tr key={sub.id}>
                    <td colSpan={2}>{nombreConMarca(sub.nombre, tipo.obligatorio)}</td>
                    <CeldaCantidadProducto
                      tipo={tipo}
                      cantidades={cantidades}
                      manejarCambioCantidad={manejarCambioCantidad}
                      mostrarErrorObligatorios={mostrarErrorObligatorios}
                    />
                  </tr>
                )
              }

              return (
                <>
                  {sub.tipos.map((tipo, index) => (
                    <tr key={tipo.id}>
                      {index === 0 && (
                        <td className="cp-resultados-categoria" rowSpan={sub.tipos.length}>
                          {sub.nombre}
                        </td>
                      )}
                      <td>{nombreConMarca(tipo.nombre, tipo.obligatorio)}</td>
                      <CeldaCantidadProducto
                        tipo={tipo}
                        cantidades={cantidades}
                        manejarCambioCantidad={manejarCambioCantidad}
                        mostrarErrorObligatorios={mostrarErrorObligatorios}
                      />
                    </tr>
                  ))}
                  {sub.nota && (
                    <tr key={`${sub.id}-nota`}>
                      <td colSpan={3} className="cp-resultados-nota">
                        Nota: {sub.nota}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResultadosEsperados({ categorias, cantidades, setCantidades, mostrarErrorObligatorios }: ResultadosEsperadosProps) {
  const actualizarCantidad = (idTipo: number, valor: string) => {
    setCantidades({ ...cantidades, [idTipo]: valor })
  }

  if (categorias.length === 0) {
    return (
      <div className="cp-section">
        <p className="cp-hint-text">Cargando catálogo de productos de investigación...</p>
      </div>
    )
  }

  return (
    <div className="cp-section">
      <p className="cp-hint-text">Los productos marcados con * son obligatorios: hay que registrar al menos una unidad.</p>
      {categorias.map((cat) => (
        <BloqueCategoriaProducto
          key={cat.id}
          cat={cat}
          cantidades={cantidades}
          actualizarCantidad={actualizarCantidad}
          mostrarErrorObligatorios={mostrarErrorObligatorios}
        />
      ))}
    </div>
  )
}

function ComponenteEtico({
  datos,
  setDatos,
  camposInvalidos,
}: {
  datos: DatosTexto
  setDatos: React.Dispatch<React.SetStateAction<DatosTexto>>
  camposInvalidos: Set<CampoGeneral>
}) {
  return (
    <div className="cp-section">
      <div className="cp-section-header">Componente ético</div>

      <div className="cp-etico-info">
        <p>(Determinar si se va o no a utilizar consentimiento informado)</p>
        <p>(Determinar si se va o no a utilizar asentimiento informado)</p>
        <p>(Determinar si se puede colocar en riesgo a seres humanos y medio ambiente)</p>
        <p className="cp-etico-nota">
          Nota. Todos los proyectos de investigación que interactúen con personas, deben incluir
          el formato de consentimiento informado y si son menores de edad el formato de
          asentimiento
        </p>
      </div>

      {/* La redacción debe cubrir las 3 indicaciones de arriba: si usa
          consentimiento/asentimiento informado y si hay riesgo para personas
          o el medio ambiente. Se guarda en proyectos.componente_etico. */}
      <TextareaConContador
        value={datos.componenteEtico}
        onChange={(v) => setDatos({ ...datos, componenteEtico: v })}
        claveLimite="componenteEtico"
        claseWrapper={camposInvalidos.has('componenteEtico') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('componenteEtico') && (
        <p className="cp-campo-error-msg">El componente ético es obligatorio.</p>
      )}

      <div className="cp-section-header">Implicaciones éticas</div>
      <TextareaSinLimite
        value={datos.implicacionesEticas}
        onChange={(v) => setDatos({ ...datos, implicacionesEticas: v })}
      />

      <div className="cp-section-header">Fuentes de financiación (Quien y cuando aporta los recursos)</div>
      <TextareaConContador
        value={datos.fuentesFinanciacion}
        onChange={(v) => setDatos({ ...datos, fuentesFinanciacion: v })}
        claveLimite="fuentesFinanciacion"
      />

      <div className="cp-section-header">
        Permisos o licencias pertinentes (Para el desarrollo del proyecto, si son necesarias)
      </div>
      <TextareaConContador
        value={datos.permisosLicencias}
        onChange={(v) => setDatos({ ...datos, permisosLicencias: v })}
        claveLimite="permisosLicencias"
      />

      <div className="cp-section-header">Funciones del estudiante auxiliar o asistente en la investigación</div>
      <TextareaConContador
        value={datos.funcionesEstudiante}
        onChange={(v) => setDatos({ ...datos, funcionesEstudiante: v })}
        claveLimite="funcionesEstudiante"
        claseWrapper={camposInvalidos.has('funcionesEstudiante') ? 'cp-textarea-error' : undefined}
      />
      {camposInvalidos.has('funcionesEstudiante') && (
        <p className="cp-campo-error-msg">Las funciones del estudiante auxiliar son obligatorias.</p>
      )}
    </div>
  )
}

export interface HojaDeVida {
  id: number
  // Determina a quién autocompleta esta ficha en "Información general" (ver
  // el useEffect junto a "hojasVida" en el componente principal) — ya no se
  // infiere de la posición en el arreglo, porque quitar una ficha de en medio
  // desplazaría los índices y confundiría a quién pertenece cada una.
  rol: 'principal' | 'coinvestigador' | 'externo'
  nombres: string
  apellidos: string
  /** Correo institucional. */
  correo: string
  /** Correo personal: recibe los enlaces de firma y el código de verificación. */
  correoPersonal: string
  lugarNacimiento: string
  fechaNacimiento: string
  nacionalidad: string
  tipoDocumento: string
  numeroDocumento: string
  direccion: string
  telefono: string
  celular: string
  orcid: string
  googleAcademico: string
  categoriaMinciencias: string
  cargoActual: string
  cargosDesempenados: string
  titulosAcademicos: string
  produccionCientifica: string
}

/** Ficha del formulario <-> campos guardados en el proyecto (mismos nombres que la hoja de vida del usuario). */
const CAMPOS_HOJA_VIDA: [keyof HojaDeVida, string][] = [
  ['nombres', 'nombres'],
  ['apellidos', 'apellidos'],
  ['correo', 'correo'],
  ['correoPersonal', 'correo_personal'],
  ['lugarNacimiento', 'lugar_nacimiento'],
  ['fechaNacimiento', 'fecha_nacimiento'],
  ['nacionalidad', 'nacionalidad'],
  ['tipoDocumento', 'tipo_documento'],
  ['numeroDocumento', 'numero_documento'],
  ['direccion', 'direccion'],
  ['telefono', 'telefono'],
  ['celular', 'celular'],
  ['orcid', 'orcid'],
  ['googleAcademico', 'google_academico'],
  ['categoriaMinciencias', 'categoria_minciencias'],
  ['cargoActual', 'cargo_actual'],
  ['cargosDesempenados', 'cargos_desempenados'],
  ['titulosAcademicos', 'titulos_academicos'],
  ['produccionCientifica', 'produccion_cientifica'],
]

function hojaVidaADatos(h: HojaDeVida): Record<string, string> {
  const datos: Record<string, string> = {}
  for (const [campoForm, campoGuardado] of CAMPOS_HOJA_VIDA) {
    const valor = h[campoForm]
    if (typeof valor === 'string' && valor.trim()) datos[campoGuardado] = valor.trim()
  }
  return datos
}

function datosAHojaVida(rol: HojaDeVida['rol'], datos: Record<string, string>): HojaDeVida {
  const hoja = crearHojaVidaVacia(rol)
  for (const [campoForm, campoGuardado] of CAMPOS_HOJA_VIDA) {
    if (datos[campoGuardado]) (hoja as unknown as Record<string, string>)[campoForm] = datos[campoGuardado]
  }
  return hoja
}

function crearHojaVidaVacia(rol: HojaDeVida['rol'] = 'coinvestigador'): HojaDeVida {
  return {
    id: Date.now() + Math.random(),
    rol,
    nombres: '',
    apellidos: '',
    correo: '',
    correoPersonal: '',
    lugarNacimiento: '',
    fechaNacimiento: '',
    nacionalidad: '',
    tipoDocumento: '',
    numeroDocumento: '',
    direccion: '',
    telefono: '',
    celular: '',
    orcid: '',
    googleAcademico: '',
    categoriaMinciencias: '',
    cargoActual: '',
    cargosDesempenados: '',
    titulosAcademicos: '',
    produccionCientifica: '',
  }
}

/**
 * Un borrador local guardado antes de que se agregara algún campo a
 * HojaDeVida (ej. orcid/googleAcademico/categoriaMinciencias, que no
 * existían al principio) trae ese campo como undefined. camposFaltantesHojaVida
 * hace `.trim()` sobre cada campo en CADA render (no solo al guardar) — con
 * un campo undefined eso revienta de inmediato (pantalla en blanco, sin
 * ningún error visible porque no hay un ErrorBoundary). Se completa con los
 * valores vacíos de crearHojaVidaVacia() cualquier campo que falte.
 */
function normalizarHojaVidaBorrador(valor: unknown, index: number): HojaDeVida {
  // Borradores guardados antes de que existiera "rol" no lo traen: se infiere
  // de la posición en que estaban en ese momento (0 = principal, el resto
  // siempre era co-investigador(a) UNICESMAG, porque "externo" no existía).
  const base = crearHojaVidaVacia(index === 0 ? 'principal' : 'coinvestigador')
  if (!valor || typeof valor !== 'object') return base
  return { ...base, ...(valor as Partial<HojaDeVida>) }
}

interface HojasVidaProps {
  hojasVida: HojaDeVida[]
  setHojasVida: React.Dispatch<React.SetStateAction<HojaDeVida[]>>
  camposInvalidos: Set<CampoHojaVida>
}

function HojasVida({ hojasVida, setHojasVida, camposInvalidos }: HojasVidaProps) {
  // Campos que no son texto libre (correo, identificadores, enlaces, números):
  // no tiene sentido forzarles una mayúscula inicial.
  const CAMPOS_HOJA_VIDA_SIN_CAPITALIZAR = new Set<keyof HojaDeVida>([
    'correo',
    'correoPersonal',
    'orcid',
    'tipoDocumento',
    'numeroDocumento',
    'telefono',
    'celular',
    'googleAcademico',
    'categoriaMinciencias',
  ])

  const actualizarHoja = (id: number, campo: keyof HojaDeVida, valor: string) => {
    const valorFinal = CAMPOS_HOJA_VIDA_SIN_CAPITALIZAR.has(campo) ? valor : capitalizarPrimera(valor)
    setHojasVida(hojasVida.map((h) => (h.id === id ? { ...h, [campo]: valorFinal } : h)))
  }

  // Solo la ficha principal (índice 0) se guarda de verdad — ver guardarHojasVida —
  // así que solo ella exige todos los campos; las fichas de co-investigador
  // adicionales son informativas y no bloquean el avance.
  const claseError = (index: number, campo: CampoHojaVida) =>
    index === 0 && camposInvalidos.has(campo) ? 'cp-input-error' : ''

  const actualizarOrcid = (hoja: HojaDeVida, valor: string) => {
    // El ORCID aquí va a la Hoja de Vida maestra del usuario logueado (RQF35),
    // y se guarda aparte del de "Información general" (ver SlotParticipante.orcid
    // — es por participante del proyecto, su propia tabla). Se escriben en
    // registros distintos, pero el de "Información general" (investigador
    // principal) se autorrellena a partir de este — ver el useEffect junto a
    // "hojasVida" en el componente principal.
    actualizarHoja(hoja.id, 'orcid', valor)
  }

  const addHojaVida = (rol: HojaDeVida['rol']) => {
    setHojasVida([...hojasVida, crearHojaVidaVacia(rol)])
  }

  const quitarHojaVida = (id: number) => {
    setHojasVida(hojasVida.filter((h) => h.id !== id))
  }

  const tieneCoInvestigador = hojasVida.some((h) => h.rol === 'coinvestigador')
  // Hasta 2 externos (externo1/externo2 en "Información general").
  const cantidadExternos = hojasVida.filter((h) => h.rol === 'externo').length

  const subtituloHoja = (hoja: HojaDeVida, index: number): string => {
    if (hoja.rol === 'principal') return 'Información investigador(a) principal'
    if (hoja.rol === 'coinvestigador') return 'Información co-investigador(a) UNICESMAG'
    // Entre los de rol "externo", cuál es "1" o "2" depende del orden en que
    // aparecen (igual que se emparejan en el useEffect de autocompletado).
    const numeroExterno = hojasVida.slice(0, index + 1).filter((h) => h.rol === 'externo').length
    return `Información co-investigador(a) externo(a) ${numeroExterno}`
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">
        HOJAS DE VIDA INVESTIGADORES
        <br />
        (se diligencia una ficha por cada investigador)
      </div>

      {hojasVida.map((hoja, index) => (
        <div className="cp-grupo-block" key={hoja.id}>
          <div className="cp-section-header cp-hv-header">
            HOJA DE VIDA (Resumen)
            {hoja.rol !== 'principal' && (
              <button
                type="button"
                className="cp-cronograma-quitar"
                aria-label="Quitar esta ficha de co-investigador(a)"
                onClick={() => quitarHojaVida(hoja.id)}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="cp-subheader">
            {subtituloHoja(hoja, index)}
          </div>

          <div className="cp-field-row">
            <label>Nombres</label>
            <input
              type="text"
              className={claseError(index, 'nombres')}
              value={hoja.nombres}
              onChange={(e) => actualizarHoja(hoja.id, 'nombres', e.target.value)}
            />
          </div>
          <div className="cp-field-row">
            <label>Apellidos</label>
            <input
              type="text"
              className={claseError(index, 'apellidos')}
              value={hoja.apellidos}
              onChange={(e) => actualizarHoja(hoja.id, 'apellidos', e.target.value)}
            />
          </div>
          <div className="cp-field-row">
            <label>ORCID</label>
            <input
              type="text"
              placeholder="0000-0000-0000-0000"
              className={claseError(index, 'orcid')}
              value={hoja.orcid}
              onChange={(e) => actualizarOrcid(hoja, e.target.value)}
            />
          </div>

          <div className="cp-field-row-4">
            <div className="cp-field-col">
              <label>Lugar de Nacimiento</label>
              <input
                type="text"
                className={claseError(index, 'lugarNacimiento')}
                value={hoja.lugarNacimiento}
                onChange={(e) => actualizarHoja(hoja.id, 'lugarNacimiento', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Fecha de Nacimiento</label>
              <DatePicker
                locale="es"
                selected={fechaStringADate(hoja.fechaNacimiento)}
                onChange={(fecha: Date | null) => actualizarHoja(hoja.id, 'fechaNacimiento', dateAFechaString(fecha))}
                dateFormat="dd/MM/yyyy"
                placeholderText="dd/mm/aaaa"
                maxDate={new Date()}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                className={claseError(index, 'fechaNacimiento')}
                wrapperClassName="cp-datepicker"
              />
            </div>
            <div className="cp-field-col">
              <label>Nacionalidad</label>
              <input
                type="text"
                className={claseError(index, 'nacionalidad')}
                value={hoja.nacionalidad}
                onChange={(e) => actualizarHoja(hoja.id, 'nacionalidad', soloLetras(e.target.value))}
              />
            </div>
            <div className="cp-field-col">
              <label>Tipo documento de identidad</label>
              <select
                className={claseError(index, 'tipoDocumento')}
                value={hoja.tipoDocumento}
                onChange={(e) => actualizarHoja(hoja.id, 'tipoDocumento', e.target.value)}
              >
                <option value="">Selecciona un tipo de documento</option>
                {TIPOS_DOCUMENTO_COLOMBIA.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="cp-field-row-4">
            <div className="cp-field-col">
              <label>No. Documento de identidad</label>
              <input
                type="text"
                inputMode="numeric"
                className={claseError(index, 'numeroDocumento')}
                value={hoja.numeroDocumento}
                onChange={(e) => actualizarHoja(hoja.id, 'numeroDocumento', soloDigitos(e.target.value))}
              />
            </div>
            <div className="cp-field-col">
              <label>{hoja.rol === 'externo' ? 'Correo electrónico' : 'Correo institucional'}</label>
              <input
                type="email"
                className={claseError(index, 'correo')}
                value={hoja.correo}
                onChange={(e) => actualizarHoja(hoja.id, 'correo', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Google Académico</label>
              <input
                type="text"
                placeholder="https://scholar.google.com/..."
                className={claseError(index, 'googleAcademico')}
                value={hoja.googleAcademico}
                onChange={(e) => actualizarHoja(hoja.id, 'googleAcademico', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Categoría Minciencias</label>
              <select
                className={claseError(index, 'categoriaMinciencias')}
                value={hoja.categoriaMinciencias}
                onChange={(e) => actualizarHoja(hoja.id, 'categoriaMinciencias', e.target.value)}
              >
                <option value="">Selecciona una categoría</option>
                {CATEGORIAS_MINCIENCIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hoja.rol !== 'externo' && (
            <div className="cp-field-row-4">
              <div className="cp-field-col">
                <label>Correo personal</label>
                <input
                  type="email"
                  placeholder="nombre@gmail.com"
                  className={claseError(index, 'correoPersonal')}
                  value={hoja.correoPersonal}
                  onChange={(e) => actualizarHoja(hoja.id, 'correoPersonal', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="cp-field-row-3">
            <div className="cp-field-col">
              <label>Dirección de residencia</label>
              <input
                type="text"
                className={claseError(index, 'direccion')}
                value={hoja.direccion}
                onChange={(e) => actualizarHoja(hoja.id, 'direccion', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Teléfono</label>
              <input
                type="text"
                inputMode="numeric"
                className={claseError(index, 'telefono')}
                value={hoja.telefono}
                onChange={(e) => actualizarHoja(hoja.id, 'telefono', soloDigitos(e.target.value))}
              />
            </div>
            <div className="cp-field-col">
              <label>Celular</label>
              <input
                type="text"
                inputMode="numeric"
                className={claseError(index, 'celular')}
                value={hoja.celular}
                onChange={(e) => actualizarHoja(hoja.id, 'celular', soloDigitos(e.target.value))}
              />
            </div>
          </div>

          <div className="cp-subheader">Cargo actual</div>
          <TextareaAutoajustable
            className={`cp-textarea ${claseError(index, 'cargoActual')}`}
            value={hoja.cargoActual}
            onChange={(e) => actualizarHoja(hoja.id, 'cargoActual', e.target.value)}
          />

          <div className="cp-subheader">Cargos desempeñados</div>
          <TextareaAutoajustable
            className={`cp-textarea ${claseError(index, 'cargosDesempenados')}`}
            value={hoja.cargosDesempenados}
            onChange={(e) => actualizarHoja(hoja.id, 'cargosDesempenados', e.target.value)}
          />

          <div className="cp-subheader">Títulos académicos obtenidos (área, disciplina, universidad, año)</div>
          <TextareaAutoajustable
            className={`cp-textarea ${claseError(index, 'titulosAcademicos')}`}
            value={hoja.titulosAcademicos}
            onChange={(e) => actualizarHoja(hoja.id, 'titulosAcademicos', e.target.value)}
          />

          <div className="cp-subheader">
            Producción científica y académica (las 5 más importantes en los últimos 5 años)
          </div>
          <TextareaAutoajustable
            className={`cp-textarea ${claseError(index, 'produccionCientifica')}`}
            value={hoja.produccionCientifica}
            onChange={(e) => actualizarHoja(hoja.id, 'produccionCientifica', e.target.value)}
          />
        </div>
      ))}

      {!tieneCoInvestigador && (
        <button type="button" className="cp-add-grupo" onClick={() => addHojaVida('coinvestigador')}>
          <Plus size={14} />
          Añadir información co-investigador(a) UNICESMAG
        </button>
      )}
      {cantidadExternos < 2 && (
        <button type="button" className="cp-add-grupo" onClick={() => addHojaVida('externo')}>
          <Plus size={14} />
          Añadir información co-investigador(a) externo(a) {cantidadExternos + 1}
        </button>
      )}
    </div>
  )
}

interface FirmasAnexosProps {
  archivosDocumentos: Record<string, File | null>
  setArchivoDocumento: (nombre: string, f: File | null) => void
  /** true = ya se intentó guardar y falta algún documento obligatorio. */
  mostrarErrorDocumentos: boolean
  estudiantesInvestigadores: EstudianteSlot[]
  archivosActaCompromiso: (File | null)[]
  setArchivoActaCompromiso: (index: number, f: File | null) => void
  /** Cuántos documentos de cada tipo ya están en el servidor (se muestran como "Ya cargado"). */
  documentosCargados: Record<string, number>
  /** null = todavía no se sabe (proyecto nuevo sin guardar, o aún consultando). */
  firmas: firmasProyectoApi.FirmaProyectoItem[] | null
  errorFirma: string
  firmandoPrincipal: boolean
  onFirmarPrincipal: () => void
  enviandoCoinvestigador: boolean
  onEnviarCoinvestigador: () => void
  formularioCompleto: boolean
  descripcionCamposFaltantes: string
  /** Correo enmascarado al que se mandó el código del Principal; null = aún no se pidió. */
  codigoPrincipalEnviadoA: string | null
  avisoCodigoPrincipal: string
  validandoCodigoPrincipal: boolean
  onValidarCodigoPrincipal: (codigo: string) => void
  onReenviarCodigoPrincipal: () => void
}

/** Los documentos anexos (y las actas de compromiso) solo se aceptan en PDF. */
function esArchivoPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function FirmasAnexos({
  archivosDocumentos,
  setArchivoDocumento,
  mostrarErrorDocumentos,
  estudiantesInvestigadores,
  archivosActaCompromiso,
  setArchivoActaCompromiso,
  documentosCargados,
  firmas,
  errorFirma,
  firmandoPrincipal,
  onFirmarPrincipal,
  enviandoCoinvestigador,
  onEnviarCoinvestigador,
  formularioCompleto,
  descripcionCamposFaltantes,
  codigoPrincipalEnviadoA,
  avisoCodigoPrincipal,
  validandoCodigoPrincipal,
  onValidarCodigoPrincipal,
  onReenviarCodigoPrincipal,
}: FirmasAnexosProps) {
  const inputsDocumentosRef = useRef<Record<string, HTMLInputElement | null>>({})
  const [errorFormatoDocumento, setErrorFormatoDocumento] = useState('')
  const [codigoPrincipal, setCodigoPrincipal] = useState('')

  // Sin esto, volver a elegir el mismo archivo tras quitarlo no dispara onChange.
  const limpiarInput = (clave: string) => {
    const input = inputsDocumentosRef.current[clave]
    if (input) input.value = ''
  }

  const principal = firmas?.find((f) => f.rol_firmante === ROL_FIRMA_PRINCIPAL) ?? null
  const principalFirmado = principal?.firmado ?? false
  const coinv = firmas?.find((f) => f.rol_firmante === ROL_FIRMA_COINVESTIGADOR) ?? null

  return (
    <div className="cp-section">
      <div className="cp-section-header">FIRMAS</div>
      {errorFirma && <p className="cp-campo-error-msg">{errorFirma}</p>}

      <div className="cp-firmas-reales-grid">
        <div className="cp-firma-real-block">
          <span className="cp-firma-rol">Investigador(a) Principal</span>
          {principalFirmado ? (
            <span className="cp-firma-estado cp-firma-estado-ok">
              <CheckCircle2 size={16} />
              Firmaste{principal?.fecha_firma ? ` el ${formatearFechaFirma(principal.fecha_firma)}` : ''}
            </span>
          ) : codigoPrincipalEnviadoA ? (
            <div className="cp-firma-codigo">
              {avisoCodigoPrincipal && <span className="cp-firma-codigo-aviso">{avisoCodigoPrincipal}</span>}
              <input
                className="cp-firma-codigo-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Código de verificación"
                placeholder="000000"
                value={codigoPrincipal}
                onChange={(e) => setCodigoPrincipal(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <div className="cp-firma-codigo-acciones">
                <button
                  type="button"
                  className="cp-firma-btn"
                  disabled={validandoCodigoPrincipal || codigoPrincipal.length !== 6}
                  onClick={() => onValidarCodigoPrincipal(codigoPrincipal)}
                >
                  {validandoCodigoPrincipal ? <Loader2 size={14} className="cp-spin" /> : null}
                  {validandoCodigoPrincipal ? 'Validando...' : 'Validar y firmar'}
                </button>
                <button
                  type="button"
                  className="cp-firma-btn cp-firma-btn-sec"
                  disabled={validandoCodigoPrincipal}
                  onClick={() => {
                    setCodigoPrincipal('')
                    onReenviarCodigoPrincipal()
                  }}
                >
                  Reenviar código
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="cp-firma-btn"
              disabled={firmandoPrincipal || !formularioCompleto}
              onClick={onFirmarPrincipal}
              title={!formularioCompleto ? `Falta por completar: ${descripcionCamposFaltantes}` : undefined}
            >
              {firmandoPrincipal ? <Loader2 size={14} className="cp-spin" /> : null}
              {firmandoPrincipal ? 'Guardando y enviando código...' : 'Hacer clic para firmar'}
            </button>
          )}
        </div>

        {coinv && (
          <div className="cp-firma-real-block">
            <span className="cp-firma-rol">
              Co-investigador(a) UNICESMAG{coinv.correo ? ` — ${coinv.correo}` : ''}
            </span>
            {coinv.firmado ? (
              <span className="cp-firma-estado cp-firma-estado-ok">
                <CheckCircle2 size={16} />
                Firmó{coinv.fecha_firma ? ` el ${formatearFechaFirma(coinv.fecha_firma)}` : ''}
              </span>
            ) : !principalFirmado ? (
              <span className="cp-firma-estado cp-firma-estado-espera">
                Disponible después de que firme el Investigador(a) Principal.
              </span>
            ) : (
              <>
              {coinv.fecha_envio && (
                <span className="cp-firma-estado cp-firma-estado-espera">
                  Enlace enviado el {formatearFechaFirma(coinv.fecha_envio)}. Esperando su firma...
                </span>
              )}
              <button
                type="button"
                className="cp-firma-btn"
                disabled={enviandoCoinvestigador}
                onClick={onEnviarCoinvestigador}
              >
                {enviandoCoinvestigador ? <Loader2 size={14} className="cp-spin" /> : <Send size={14} />}
                {enviandoCoinvestigador
                  ? 'Enviando...'
                  : coinv.fecha_envio
                    ? 'Reenviar firma al co-investigador'
                    : 'Enviar firma al co-investigador'}
              </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="cp-section-header">Cargue de documentos</div>

      <div className="cp-documentos-table">
        {DOCUMENTOS_FIRMAS.map(({ nombre, obligatorio }) => {
          const archivo = archivosDocumentos[nombre] ?? null
          return (
            <div className="cp-documentos-row" key={nombre}>
              <span>
                {obligatorio ? `${nombre} *` : nombre}
                {!archivo && (documentosCargados[nombre] ?? 0) > 0 && <span className="cp-documento-ya-cargado">Ya cargado</span>}
              </span>
              <span className="cp-documentos-acciones">
                <button
                  type="button"
                  className="cp-cargar-btn"
                  onClick={() => inputsDocumentosRef.current[nombre]?.click()}
                >
                  <Upload size={14} />
                  {archivo ? archivo.name : 'Cargar'}
                </button>
                {archivo && (
                  <button
                    type="button"
                    className="cp-quitar-archivo-btn"
                    aria-label={`Quitar archivo de ${nombre}`}
                    title="Quitar archivo"
                    onClick={() => {
                      setArchivoDocumento(nombre, null)
                      limpiarInput(nombre)
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
              <input
                ref={(el) => { inputsDocumentosRef.current[nombre] = el }}
                type="file"
                accept=".pdf,application/pdf"
                className="cp-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  if (file && !esArchivoPdf(file)) {
                    setErrorFormatoDocumento('Solo se permiten archivos en formato PDF.')
                    e.target.value = ''
                    return
                  }
                  setErrorFormatoDocumento('')
                  setArchivoDocumento(nombre, file)
                }}
              />
            </div>
          )
        })}

        {estudiantesInvestigadores
          .map((est, index) => ({ est, index }))
          .filter(({ est }) => est.nombres.trim() && est.correo.trim() && est.idRolEstudiante)
          .map(({ est, index }, posicion) => {
            const claveInput = `acta-${index}`
            const archivo = archivosActaCompromiso[index] ?? null
            return (
              <div className="cp-documentos-row" key={claveInput}>
                <span>
                  {NOMBRE_DOCUMENTO_ACTA_COMPROMISO} * — {est.nombres} {est.apellidos}
                  {!archivo && posicion < (documentosCargados[NOMBRE_DOCUMENTO_ACTA_COMPROMISO] ?? 0) && (
                    <span className="cp-documento-ya-cargado">Ya cargado</span>
                  )}
                </span>
                <span className="cp-documentos-acciones">
                  <button
                    type="button"
                    className="cp-cargar-btn"
                    onClick={() => inputsDocumentosRef.current[claveInput]?.click()}
                  >
                    <Upload size={14} />
                    {archivo ? archivo.name : 'Cargar'}
                  </button>
                  {archivo && (
                    <button
                      type="button"
                      className="cp-quitar-archivo-btn"
                      aria-label={`Quitar acta de compromiso de ${est.nombres} ${est.apellidos}`}
                      title="Quitar archivo"
                      onClick={() => {
                        setArchivoActaCompromiso(index, null)
                        limpiarInput(claveInput)
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
                <input
                  ref={(el) => { inputsDocumentosRef.current[claveInput] = el }}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="cp-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    if (file && !esArchivoPdf(file)) {
                      setErrorFormatoDocumento('Solo se permiten archivos en formato PDF.')
                      e.target.value = ''
                      return
                    }
                    setErrorFormatoDocumento('')
                    setArchivoActaCompromiso(index, file)
                  }}
                />
              </div>
            )
          })}
      </div>

      <p className="cp-hint-text">Los documentos marcados con * son obligatorios (solo se aceptan en PDF).</p>
      {errorFormatoDocumento && <p className="cp-campo-error-msg">{errorFormatoDocumento}</p>}
      {mostrarErrorDocumentos && (
        <p className="cp-campo-error-msg">Carga los documentos obligatorios antes de guardar.</p>
      )}
    </div>
  )
}

interface RadioOptionProps {
  name: string
  label: string
  checked?: boolean
  onChange?: () => void
}

function RadioOption({ name, label, checked, onChange }: RadioOptionProps) {
  return (
    <label className="cp-radio-option">
      <span>{label}</span>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
    </label>
  )
}

function DedicacionToggle({
  name,
  opciones,
  value,
  onChange,
  error,
}: {
  name: string
  opciones: string[]
  value?: string
  onChange?: (valor: string) => void
  error?: boolean
}) {
  const controlado = onChange !== undefined
  return (
    <div className={`cp-toggle-group${error ? ' cp-toggle-group-error' : ''}`}>
      {opciones.map((op) => (
        <label className="cp-toggle" key={op}>
          <input
            type="radio"
            name={name}
            value={op}
            {...(controlado
              ? { checked: value === op, onChange: () => onChange!(op) }
              : { defaultChecked: false })}
          />
          <span>{op}</span>
        </label>
      ))}
    </div>
  )
}

interface InvestigadorMiniTableProps {
  idBase: string
  lista: SlotParticipante[]
  setLista: (lista: SlotParticipante[]) => void
  titulo?: string
  textoAgregar?: string
}

function InvestigadoresMiniTable({
  idBase,
  lista,
  setLista,
  titulo = 'Investigadores del proyecto',
  textoAgregar = 'Añadir investigador',
}: InvestigadorMiniTableProps) {
  const actualizarFila = (index: number, cambios: Partial<SlotParticipante>) => {
    setLista(lista.map((f, i) => (i === index ? { ...f, ...cambios } : f)))
  }

  const quitarFila = (index: number) => {
    setLista(lista.filter((_, i) => i !== index))
  }

  return (
    <div className="cp-mini-table">
      <div className="cp-mini-table-header">
        <span>{titulo}</span>
        <span>Dedicación (Horas semanales)</span>
        <span aria-hidden="true" />
      </div>

      {lista.map((fila, index) => (
        <div className="cp-mini-table-row" key={index}>
          <input
            type="text"
            placeholder="Nombre completo"
            name={`nombre-completo-${idBase}-${index}`}
            value={fila.nombreCompleto}
            onChange={(e) => actualizarFila(index, { nombreCompleto: capitalizarPrimera(e.target.value) })}
          />
          <input
            type="number"
            min={0}
            max={30}
            name={`horas-semanales-${idBase}-${index}`}
            aria-label={`Horas semanales del investigador ${index + 1}`}
            value={fila.horasSemanales}
            onChange={(e) => actualizarFila(index, { horasSemanales: limitarHoras(e.target.value) })}
          />
          <button
            type="button"
            className="cp-mini-table-quitar"
            aria-label="Quitar este investigador"
            onClick={() => quitarFila(index)}
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        className="cp-add-fila"
        onClick={() => setLista([...lista, slotVacio()])}
      >
        <Plus size={12} />
        {textoAgregar}
      </button>
    </div>
  )
}

interface TextareaConContadorProps {
  value: string
  onChange: (value: string) => void

  claveLimite: ClaveLimiteTexto
  placeholder?: string

  claseWrapper?: string
}

function TextareaConContador({ value, onChange, claveLimite, placeholder, claseWrapper }: TextareaConContadorProps) {
  const maxPalabras = getLimite(claveLimite)
  const palabras = contarPalabras(value)
  const excedido = palabras > maxPalabras

  const manejarCambio = (valorEscrito: string) => {
    const nuevoValor = capitalizarPrimera(valorEscrito)
    const nuevasPalabras = contarPalabras(nuevoValor)
    if (nuevasPalabras <= maxPalabras || nuevasPalabras <= palabras) {
      onChange(nuevoValor)
      return
    }
    // Se añadieron palabras de más de golpe (típico al pegar un texto largo):
    // antes esto rechazaba el cambio completo y parecía que pegar no hacía
    // nada; ahora se recorta a las primeras maxPalabras palabras.
    onChange(nuevoValor.trim().split(/\s+/).slice(0, maxPalabras).join(' '))
  }

  return (
    <div className={`cp-textarea-wrapper${claseWrapper ? ` ${claseWrapper}` : ''}`}>
      <TextareaAutoajustable
        className="cp-textarea"
        value={value}
        placeholder={placeholder}
        onChange={(e) => manejarCambio(e.target.value)}
      />
      <span className={`cp-char-count${excedido ? ' cp-char-count-excedido' : ''}`}>
        {palabras}/{maxPalabras} palabras
      </span>
    </div>
  )
}

/** Como TextareaConContador, pero sin tope de palabras ni contador (p. ej. Implicaciones éticas). */
function TextareaSinLimite({
  value,
  onChange,
  placeholder,
  claseWrapper,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  claseWrapper?: string
}) {
  return (
    <div className={`cp-textarea-wrapper${claseWrapper ? ` ${claseWrapper}` : ''}`}>
      <TextareaAutoajustable
        className="cp-textarea"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(capitalizarPrimera(e.target.value))}
      />
    </div>
  )
}

export default CrearProyecto