import { useRef, useState, useEffect } from 'react'
import { Save, Plus, Download, Upload, X, ArrowLeft } from 'lucide-react'
import './CrearProyecto.css'
import { useNavigate } from 'react-router-dom'
import * as convocatoriasApi from '../../convocatorias/lib/convocatorias'
import * as convocatoriaOpcionesApi from '../../convocatorias/api/convocatoriaOpciones'
import { extraerNumeroDePeriodo } from '../../convocatorias/lib/periodos'
import {
  getLimite,
  getLimiteAntecedentes,
  setLimite,
  setLimiteAntecedentes,
  contarCaracteres,
  type ClaveLimiteTexto,
} from '../lib/limitesTexto'
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
import { ApiError } from '../../../shared/api/client'
import BuscadorUsuario from '../../usuarios/components/BuscadorUsuario'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { getLineas as getLineasMedularesLocal } from '../../convocatorias/lib/lineasInvestigacion'

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Documentos que se cargan en "Firmas y anexos" — igual al catálogo real de
 * CESMAG. El nombre debe coincidir EXACTO con el `nombre` sembrado en
 * TipoDocumento (ver backend/prisma/seed.ts) para poder resolver su
 * id_tipo_documento al subir el archivo.
 */
const NOMBRES_DOCUMENTOS_FIRMAS = [
  'Formato de proyecto firmado',
  'Formato de ética',
  'Presentación de Proyecto de Investigación',
  'Acta de compromiso estudiantes auxiliares o asistentes',
  'Solicitud de evaluación Comité de Ética',
  'Consentimiento informado',
  'Aval líder de Grupo de Investigación',
  'Asentimiento informado',
  'Carta de Intención',
  'Presupuesto Proyectos de Investigación',
]

// Claves que tienen un valor por defecto (o son solo identificadores/estado de
// navegación) aunque la persona no haya escrito nada.
const CLAVES_SIN_CONTENIDO_BORRADOR = new Set(['id', 'pais', 'anio', 'tab', 'tabsDesbloqueadas', 'maxTabIndexDesbloqueado'])

/** ¿El borrador tiene algo que la persona realmente diligenció? */
function borradorTieneContenido(valor: unknown, clave = ''): boolean {
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

type CampoHojaVida = Exclude<keyof HojaDeVida, 'id'>

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
  idPrograma: number | null
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

/** A qué pestaña saltar cuando este campo aparece marcado como faltante. */
const CAMPO_A_TAB: Record<CampoGeneral, Tab> = {
  titulo: 'general',
  modalidad: 'general',
  tipo: 'general',
  ciudad: 'general',
  departamento: 'general',
  duracion: 'general',
  programa: 'general',
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
}

const ETIQUETAS_CAMPO_HOJA_VIDA: Record<CampoHojaVida, string> = {
  nombres: 'Nombres (hoja de vida)',
  apellidos: 'Apellidos (hoja de vida)',
  correo: 'Correo (hoja de vida)',
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
  idPrograma: null,
  pais: 'Colombia',
  otroPais: '',
  ciudad: '',
  departamento: '',
  idTipoProyecto: null,
  valorSolicitado: '',
  valorContrapartida: '',
  duracion: '',
}

export interface DatosTexto {
  resumen: string
  planteamiento: string
  pregunta: string
  justificacion: string
  objetivoGeneral: string
  antecedentes: ItemLista[]
  marcoTeorico: string
  metodologia: string
  componenteEtico: string
  funcionesEstudiante: string
  referencias: ItemLista[]
}

const datosTextoIniciales: DatosTexto = {
  resumen: '',
  planteamiento: '',
  pregunta: '',
  justificacion: '',
  objetivoGeneral: '',
  antecedentes: [{ id: 1, texto: '' }],
  marcoTeorico: '',
  metodologia: '',
  componenteEtico: '',
  funcionesEstudiante: '',
  referencias: [{ id: 1, texto: '' }],
}

interface ImpactoPorObjetivo {
  impactoEsperado: string
  beneficiarioPotencial: string
  indicadorVerificable: string
}

interface GrupoSeleccionado {
  id: number
  nombre: string

  // "facultad"/"programa" (texto libre) solo aplican al grupo EXTERNO — una
  // universidad/entidad de afuera no está en nuestro catálogo. Para el grupo
  // CESMAG (interno) se usan los catálogos reales: idFacultad/idPrograma.
  facultad: string
  idFacultad: number | null

  programa: string
  idPrograma: number | null

  lider: string
  codGruplac: string
  reconocidoMinciencias: boolean
  categoria: string
  acuerdoInstitucional: string

  lineaMedular: string
  idLinea: number | null

  idOds: number | null
  investigadoresExtra: SlotParticipante[]
}

const grupoSeleccionadoVacio = (id: number): GrupoSeleccionado => ({
  id,
  nombre: '',
  facultad: '',
  idFacultad: null,
  programa: '',
  idPrograma: null,
  lider: '',
  codGruplac: '',
  reconocidoMinciencias: false,
  categoria: '',
  acuerdoInstitucional: '',
  lineaMedular: '',
  idLinea: null,
  idOds: null,
  investigadoresExtra: [slotVacio()],
})

interface EgresadoInfo {
  id: number
  slot: SlotParticipante
  idFacultad: number | null
  idPrograma: number | null
  empresa: string
  horasSemanales: string
}

interface SlotParticipante {
  usuario: usuariosApi.UsuarioBuscado | null
  idDedicacion: number | null
  // ORCID/Google Académico reportados para este proyecto (ver nota en
  // backend: UsuarioProyecto.orcid). No prellenan desde la Hoja de Vida
  // maestra del usuario — un investigador no tiene permiso para editar la
  // ficha de otra persona, así que esto queda como dato propio del proyecto.
  orcid: string
  googleAcademico: string
}

const slotVacio = (): SlotParticipante => ({ usuario: null, idDedicacion: null, orcid: '', googleAcademico: '' })

/** Participante de "Información general" escrito a mano (no busca cuentas
 * existentes): el backend decide solo si lo vincula a una cuenta existente
 * por correo, o lo guarda como texto plano (ver participantes.service.ts). */
interface ParticipanteManual {
  nombres: string
  apellidos: string
  correo: string
  idDedicacion: number | null
  // ORCID/Google Académico reportados para este proyecto (ver nota en
  // backend: UsuarioProyecto.orcid). No prellenan desde la Hoja de Vida
  // maestra del usuario — un investigador no tiene permiso para editar la
  // ficha de otra persona, así que esto queda como dato propio del proyecto.
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

function CrearProyecto() {
  const [tab, setTab] = useState<Tab>('hojasvida')
  const navigate = useNavigate()
  const { usuario } = useAuth()

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
  const [gruposCesmagSel, setGruposCesmagSel] = useState<GrupoSeleccionado[]>([grupoSeleccionadoVacio(1)])
  const [gruposExternosSel, setGruposExternosSel] = useState<GrupoSeleccionado[]>([grupoSeleccionadoVacio(1)])
  const [cronogramas, setCronogramas] = useState<CronogramaBloque[]>([
    { id: 1, actividades: [crearActividadVacia()] },
  ])
  const [egresadosInfo, setEgresadosInfo] = useState<EgresadoInfo[]>([
    { id: 1, slot: slotVacio(), idFacultad: null, idPrograma: null, empresa: '', horasSemanales: '' },
  ])
  const [tiposDocumento, setTiposDocumento] = useState<tiposDocumentoApi.TipoDocumentoItem[]>([])
  const [archivosDocumentos, setArchivosDocumentos] = useState<Record<string, File | null>>({})
  // Solo se ponen en rojo después de un intento de guardado fallido — no desde
  // que se abre la pestaña, para no regañar antes de que la persona intente nada.
  const [mostrarErrorDocumentos, setMostrarErrorDocumentos] = useState(false)
  const [mostrarErrorProductosObligatorios, setMostrarErrorProductosObligatorios] = useState(false)
  const [hojasVida, setHojasVida] = useState<HojaDeVida[]>([crearHojaVidaVacia()])

  // El ORCID/Google Académico de la Hoja de Vida (investigador principal) se
  // reflejan automáticamente en su fila de "Información general" — la persona
  // es la misma, no tiene sentido escribirlo dos veces.
  useEffect(() => {
    const principal = hojasVida[0]
    if (!principal) return
    setParticipantesPorGrupo((actual) =>
      actual.map((g, i) =>
        i === 0
          ? { ...g, principal: { ...g.principal, orcid: principal.orcid, googleAcademico: principal.googleAcademico } }
          : g
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hojasVida[0]?.orcid, hojasVida[0]?.googleAcademico])

  const [datosGeneral, setDatosGeneral] = useState<DatosGeneral>(datosGeneralIniciales)
  const [modalidades, setModalidades] = useState<catalogosApi.CatalogoItem[]>([])
  const [areas, setAreas] = useState<catalogosApi.CatalogoItem[]>([])
  const [tiposProyecto, setTiposProyecto] = useState<catalogosApi.CatalogoItem[]>([])
  const [programas, setProgramas] = useState<{ id_programa: number; nombre: string; tipoPrograma: string | null }[]>([])
  const [facultades, setFacultades] = useState<catalogosApi.FacultadItem[]>([])
  const [programasCompletos, setProgramasCompletos] = useState<catalogosApi.ProgramaItem[]>([])
  // "Línea medular": todavía no tiene catálogo propio en el backend (ver
  // Convocatorias > Líneas de investigación > Línea medular) — por ahora se
  // lee del mismo localStorage que administra esa pantalla, para que al
  // menos dentro de este mismo navegador quede conectado con lo configurado ahí.
  const [lineasMedulares, setLineasMedulares] = useState<string[]>([])
  useEffect(() => {
    setLineasMedulares(
      getLineasMedularesLocal()
        .filter((l) => l.categoria === 'medular' && l.activa)
        .map((l) => l.nombre)
    )
  }, [])
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

  // --- Borrador local: para que un recargo de página no borre lo ya escrito ---
  // Se guarda en localStorage (por usuario) todo lo que todavía no viaja al
  // backend en cada "Siguiente" (o que sí viaja, pero conviene tener también
  // localmente para repoblar los campos sin reconsultar todo). No incluye los
  // archivos de "Firmas y anexos": un File no se puede guardar en localStorage.
  const [mostrarRestaurarBorrador, setMostrarRestaurarBorrador] = useState(false)
  const [borradorListo, setBorradorListo] = useState(false)
  const claveBorradorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!usuario) return
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
        if (b.gruposCesmagSel) setGruposCesmagSel(b.gruposCesmagSel as GrupoSeleccionado[])
        if (b.gruposExternosSel) setGruposExternosSel(b.gruposExternosSel as GrupoSeleccionado[])
        if (Array.isArray(b.cronogramas)) setCronogramas((b.cronogramas as unknown[]).map(normalizarCronogramaBloque))
        if (b.egresadosInfo) setEgresadosInfo(b.egresadosInfo as EgresadoInfo[])
        if (b.hojasVida) setHojasVida(b.hojasVida as HojaDeVida[])
        if (b.datosGeneral) setDatosGeneral(b.datosGeneral as DatosGeneral)
        if (b.cantidadesProducto) setCantidadesProducto(b.cantidadesProducto as Record<number, string>)
        if (typeof b.idProyectoCreado === 'number') setIdProyectoCreado(b.idProyectoCreado)
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

  const ordenTabs: Tab[] = ['hojasvida', 'general', 'grupos', 'formulacion', 'marco', 'cronograma', 'resultados', 'etico', 'firmas']
  // Pestañas ya desbloqueadas: cada vez que "tab" cambia (ya sea por avanzar
  // normalmente o porque el formulario redirige a una pestaña posterior por un
  // campo faltante) se agrega SOLO esa pestaña al conjunto — no todas las que
  // haya de por medio. Antes se guardaba el índice máximo alcanzado y se
  // desbloqueaba todo hasta ahí de un tirón; eso hacía que, por ejemplo, al
  // saltar de "Marco teórico" a "Componente ético" (porque faltaba algo ahí),
  // "Cronograma" y "Resultados esperados" quedaran desbloqueadas de paso aunque
  // la persona nunca las hubiera visitado (RQF control de avance).
  const [tabsDesbloqueadas, setTabsDesbloqueadas] = useState<Set<Tab>>(() => new Set<Tab>(['hojasvida']))
  useEffect(() => {
    setTabsDesbloqueadas((actual) => (actual.has(tab) ? actual : new Set(actual).add(tab)))
  }, [tab])

  // Guarda el borrador (con un pequeño debounce) cada vez que cambia algo.
  // No arranca hasta que "borradorListo" es true, para no pisar un borrador
  // guardado antes de preguntarle a la persona si quiere continuarlo.
  useEffect(() => {
    if (!borradorListo || !claveBorradorRef.current) return
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
    tabsDesbloqueadas,
  ])

  const avanzarSiguienteTab = () => {
    const idx = ordenTabs.indexOf(tab)
    if (idx >= 0 && idx < ordenTabs.length - 1) setTab(ordenTabs[idx + 1])
  }

  useEffect(() => {
    async function cargar() {
      try {
        const [modalidadesRes, areasRes, tiposRes, programasRes, lineasRes, odsRes, tiposGrupoRes, dedicacionesRes, rolesProyectoRes, rolesEstudianteRes, periodosRes, categoriasProductoRes, tiposDocumentoRes, convocatoriasRes, facultadesRes] = await Promise.all([
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
        ])

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

  const opcionesDuracion = (() => {
    const numeros = periodos
      .map((p) => extraerNumeroDePeriodo(p.nombre))
      .filter((n): n is number => n !== null)
    const unicos = [...new Set(numeros)].sort((a, b) => a - b).map(String)
    return unicos.length > 0 ? unicos : ['2', '4']
  })()

  const idsUsuariosUsados: number[] = [
    ...gruposCesmagSel.flatMap((g) => g.investigadoresExtra.map((slot) => slot.usuario?.id_usuario)),
    ...gruposExternosSel.flatMap((g) => g.investigadoresExtra.map((slot) => slot.usuario?.id_usuario)),
    ...egresadosInfo.map((eg) => eg.slot.usuario?.id_usuario),
  ].filter((id): id is number => id !== undefined)

  const handleAddEstudianteInvestigador = () => {
    setEstudiantesInvestigadores([...estudiantesInvestigadores, estudianteSlotVacio()])
  }

  const handleRemoveEstudianteInvestigador = (index: number) => {
    if (estudiantesInvestigadores.length <= 1) return
    setEstudiantesInvestigadores(estudiantesInvestigadores.filter((_, i) => i !== index))
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
        const creacion = proyectosApi.agregarParticipanteProyecto(idProyecto, {
          nombre: slot.nombres.trim(),
          apellido: slot.apellidos.trim() || undefined,
          correo: slot.correo.trim(),
          id_dedicacion: idDedicacion,
          id_rol_pro: idRolPro,
          orcid: slot.orcid.trim() || undefined,
          google_academico: slot.googleAcademico.trim() || undefined,
        })
        if (cedula?.trim()) {
          tareas.push(
            creacion.then((res) =>
              proyectosApi.registrarInformacionEgresado(idProyecto, res.participante.id_usuarioproyecto, {
                cedula: cedula.trim(),
              })
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
    if (!datosGeneral.idPrograma) faltantes.add('programa')
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
    ciudad: datosGeneral.ciudad.trim() || undefined,
    departamento: datosGeneral.departamento.trim() || undefined,
    resumen: datosTexto.resumen.trim() || undefined,
    planteamiento_problema: datosTexto.planteamiento.trim() || undefined,
    pregunta_investigacion: datosTexto.pregunta.trim() || undefined,
    justificacion: datosTexto.justificacion.trim() || undefined,
    marco_teorico: datosTexto.marcoTeorico.trim() || undefined,
    metodologia_preliminar: datosTexto.metodologia.trim() || undefined,
    componente_etico: datosTexto.componenteEtico.trim() || undefined,
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
    const grupoCesmagSinOds = gruposCesmagSel.find((g) => g.nombre.trim() && !g.idOds)
    if (grupoCesmagSinOds) {
      setErrorEnvio('Selecciona el ODS obligatorio para cada grupo CESMAG que hayas diligenciado.')
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

  const CAMPOS_REQUERIDOS_HOJA_VIDA: CampoHojaVida[] = [
    'nombres',
    'apellidos',
    'correo',
    'lugarNacimiento',
    'fechaNacimiento',
    'nacionalidad',
    'tipoDocumento',
    'numeroDocumento',
    'direccion',
    'telefono',
    'celular',
    'orcid',
    'googleAcademico',
    'cargoActual',
    'cargosDesempenados',
    'titulosAcademicos',
    'produccionCientifica',
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
  const faltaDocumento = () => Object.values(archivosDocumentos).every((f) => !f)

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

    if (faltaDocumento()) {
      setMostrarErrorDocumentos(true)
      setErrorEnvio('Carga al menos un documento en "Firmas y anexos".')
      setTab('firmas')
      return
    }
    setMostrarErrorDocumentos(false)

    if (!idConvocatoriaActiva) {
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
          } else {
            throw err
          }
        }
      }
      if (!idProyecto) {
        const proyecto = await proyectosApi.crearProyecto({
          id_convocatoria: idConvocatoriaActiva,
          id_modalidad_proyecto: datosGeneral.idModalidad!,
          id_tipo_proyecto: datosGeneral.idTipoProyecto!,
          ...camposTexto,
        })
        idProyecto = proyecto.id_proyecto
        setIdProyectoCreado(idProyecto)
      }

      const advertencias: string[] = []

      // 3. Información general: área, programa, financiación, participantes del
      // grupo (información general) y estudiantes investigadores.
      const tareasGeneral: Promise<unknown>[] = []
      if (datosGeneral.idArea) tareasGeneral.push(proyectosApi.agregarAreaProyecto(idProyecto, datosGeneral.idArea))
      if (datosGeneral.idPrograma) {
        tareasGeneral.push(proyectosApi.agregarProgramaProyecto(idProyecto, { id_programa: datosGeneral.idPrograma }))
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
      tareasGeneral.push(...guardarEstudiantesInvestigadores(idProyecto))
      await Promise.all(tareasGeneral)

      // 4. Grupos y egresados.
      const idCoInvestigador = idRolPorNombre('Co investigador(a) UNICESMAG')
      const idExterno = idRolPorNombre('Co investigador(a) Externo(a)')
      const idEgresado = idRolPorNombre('Co investigador(a) Egresado(a) UNICESMAG')
      const idDedicacion = idDedicacionPorDefecto()
      const idTipoGrupoInterno = tiposGrupo.find((t) => t.nombre === 'interno')?.id_tipo_grupo
      const idTipoGrupoExterno = tiposGrupo.find((t) => t.nombre === 'externo')?.id_tipo_grupo
      const gruposNoRegistrados: string[] = []

      const registrarGrupo = async (
        g: GrupoSeleccionado,
        idTipoGrupo: number | undefined,
        idOds: number | undefined
      ): Promise<void> => {
        if (!g.nombre.trim() || !idTipoGrupo) return
        try {
          const creado = await gruposApi.crearGrupo({
            nombre: g.nombre.trim(),
            id_tipo_grupo: idTipoGrupo,
            // Grupo CESMAG (interno): facultad/programa vienen del catálogo real.
            // Grupo externo: no está en nuestro catálogo, se guarda como texto libre.
            id_facultad: g.idFacultad ?? undefined,
            id_programa: g.idPrograma ?? undefined,
            facultad_otra: !g.idFacultad ? g.facultad.trim() || undefined : undefined,
            programa_otro: !g.idPrograma ? g.programa.trim() || undefined : undefined,
            lider_grupo: g.lider.trim() || undefined,
            cod_gruplac: g.codGruplac.trim() || undefined,
            reconocido_minciencias: g.reconocidoMinciencias,
            categoria: g.categoria.trim() || undefined,
            acuerdo_institucional: g.acuerdoInstitucional.trim() || undefined,
            linea_medular: g.lineaMedular.trim() || undefined,
          })
          await proyectosApi.agregarGrupoProyecto(idProyecto, {
            id_grupo: creado.grupo.id_grupo,
            id_linea_investigacion: g.idLinea ?? undefined,
            id_ods: idOds,
          })
        } catch {
          gruposNoRegistrados.push(g.nombre.trim())
        }
      }

      const tareasGrupos: Promise<unknown>[] = []
      for (const g of gruposCesmagSel) {
        tareasGrupos.push(registrarGrupo(g, idTipoGrupoInterno, g.idOds ?? undefined))
        for (const slot of g.investigadoresExtra) {
          if (slot.usuario && slot.idDedicacion && idCoInvestigador) {
            tareasGrupos.push(
              proyectosApi.agregarParticipanteProyecto(idProyecto, {
                participante: slot.usuario.id_usuario,
                id_dedicacion: slot.idDedicacion,
                id_rol_pro: idCoInvestigador,
              })
            )
          }
        }
      }
      for (const g of gruposExternosSel) {
        tareasGrupos.push(registrarGrupo(g, idTipoGrupoExterno, undefined))
        for (const slot of g.investigadoresExtra) {
          if (slot.usuario && slot.idDedicacion && idExterno) {
            tareasGrupos.push(
              proyectosApi.agregarParticipanteProyecto(idProyecto, {
                participante: slot.usuario.id_usuario,
                id_dedicacion: slot.idDedicacion,
                id_rol_pro: idExterno,
              })
            )
          }
        }
      }
      for (const eg of egresadosInfo) {
        if (!eg.slot.usuario || !idEgresado || !idDedicacion) continue
        tareasGrupos.push(
          (async () => {
            const creado = await proyectosApi.agregarParticipanteProyecto(idProyecto, {
              participante: eg.slot.usuario!.id_usuario,
              id_dedicacion: idDedicacion,
              id_rol_pro: idEgresado,
            })
            await proyectosApi.registrarInformacionEgresado(idProyecto, creado.participante.id_usuarioproyecto, {
              id_facultad: eg.idFacultad ?? undefined,
              id_programa: eg.idPrograma ?? undefined,
              empresa_entidad: eg.empresa || undefined,
              dedicacion_horas_semanales: eg.horasSemanales ? Number(eg.horasSemanales) : undefined,
            })
          })()
        )
      }
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

      const tareasFormulacion: Promise<unknown>[] = []
      for (const antecedente of datosTexto.antecedentes) {
        if (antecedente.texto.trim()) {
          tareasFormulacion.push(proyectosApi.agregarAntecedenteProyecto(idProyecto, antecedente.texto.trim()))
        }
      }
      await Promise.all(tareasFormulacion)

      // 6. Marco teórico y metodología: referencias e impacto de cada objetivo específico.
      const tareasMarco: Promise<unknown>[] = []
      for (const referencia of datosTexto.referencias) {
        if (referencia.texto.trim()) tareasMarco.push(proyectosApi.agregarReferenciaProyecto(idProyecto, referencia.texto.trim()))
      }
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

      // 7. Cronograma de actividades.
      for (const bloque of cronogramas) {
        const indiceBloque = cronogramas.indexOf(bloque)
        const periodoDelBloque = periodos[indiceBloque]
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
      await Promise.all(tareasDocumentos)

      if (advertencias.length > 0) {
        // El proyecto y el resto de la información ya quedaron guardados: se
        // avisa de lo puntual que faltó, pero no se navega para que se alcance
        // a leer (el registro ya existe; "Guardar" de nuevo no lo duplica).
        setErrorEnvio(`El proyecto se guardó, pero ${advertencias.join('; y ')}. El resto de la información sí quedó guardada.`)
        return
      }

      if (claveBorradorRef.current) localStorage.removeItem(claveBorradorRef.current)
      setMostrarProyectoCreado(true)
    } catch (err) {
      manejarErrorGuardado(err, 'No se pudo guardar el proyecto.')
    } finally {
      setEnviando(false)
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
    ]
    if (faltaDocumento()) partes.push('Al menos un documento de "Cargue de documentos"')
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
      case 'general':
        return Boolean(datosGeneral.titulo.trim()) || idProyectoCreado !== null
      case 'grupos':
        return (
          gruposCesmagSel.some((g) => g.nombre.trim()) ||
          gruposExternosSel.some((g) => g.nombre.trim()) ||
          egresadosInfo.some((eg) => eg.slot.usuario !== null)
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

  return (
    <div className="crear-proyecto">
      <div className="crear-proyecto-title">
        <button
          type="button"
          className="cp-volver-btn"
          onClick={() => {
            // "Volver" es salir a propósito: no se deja borrador para preguntar después.
            if (claveBorradorRef.current) localStorage.removeItem(claveBorradorRef.current)
            navigate('/proyectos')
          }}
        >
          <ArrowLeft size={16} />
          Volver
        </button>
        <h1>Registra la información de tu proyecto</h1>
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
            dedicaciones={dedicaciones}
            facultades={facultades}
            programasCompletos={programasCompletos}
            lineasMedulares={lineasMedulares}
            gruposCesmagSel={gruposCesmagSel}
            setGruposCesmagSel={setGruposCesmagSel}
            gruposExternosSel={gruposExternosSel}
            setGruposExternosSel={setGruposExternosSel}
            egresadosInfo={egresadosInfo}
            setEgresadosInfo={setEgresadosInfo}
            idsUsuariosUsados={idsUsuariosUsados}
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
            maxCronogramas={periodos.length}
            periodos={periodos}
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
          />
        )}

        <div className="crear-proyecto-actions">
          {tab !== 'firmas' ? (
            <button type="button" className="cp-siguiente-btn" disabled={enviando} onClick={handleGuardarPasoActual}>
              <Save size={16} />
              {enviando ? 'Guardando...' : 'Siguiente'}
            </button>
          ) : (
            // "Guardar" solo existe en la última pestaña: es lo único que crea el
            // proyecto (con todo lo diligenciado), así que no tiene sentido antes.
            <button
              type="button"
              className="cp-save-btn"
              disabled={enviando || !formularioCompleto}
              onClick={handleGuardarPasoActual}
              title={!formularioCompleto ? `Falta por completar: ${descripcionCamposFaltantes()}` : undefined}
            >
              <Save size={16} />
              {enviando ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>
      </form>

      {mostrarProyectoCreado && (
        <ConfirmModal
          mensaje="El proyecto se creó con éxito."
          botonPrimario={{ label: 'Ok', onClick: () => navigate('/proyectos'), variante: 'azul' }}
          onClose={() => navigate('/proyectos')}
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
}: {
  nombres: string
  apellidos: string
  correo: string
  onChange: (cambios: { nombres?: string; apellidos?: string; correo?: string }) => void
}) {
  return (
    <div className="cp-participante-manual">
      <input
        type="text"
        className="cp-participante-nombres"
        placeholder="Nombres"
        value={nombres}
        onChange={(e) => onChange({ nombres: e.target.value })}
      />
      <input
        type="text"
        className="cp-participante-apellidos"
        placeholder="Apellidos"
        value={apellidos}
        onChange={(e) => onChange({ apellidos: e.target.value })}
      />
      <input
        type="email"
        className="cp-participante-correo"
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
  const programasFiltrados = tipoProgramaFiltro
    ? programas.filter((p) => p.tipoPrograma === tipoProgramaFiltro)
    : programas

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
          onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
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
                  <span className="cp-dedicacion-label">Rol del estudiante:</span>
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
              setDatos({ ...datos, idPrograma: null })
            }}
          >
            Pregrado
          </button>
          <button
            type="button"
            className={`cp-programa-tipo-btn ${tipoProgramaFiltro === 'posgrado' ? 'cp-programa-tipo-btn-active' : ''}`}
            onClick={() => {
              setTipoProgramaFiltro((actual) => (actual === 'posgrado' ? null : 'posgrado'))
              setDatos({ ...datos, idPrograma: null })
            }}
          >
            Posgrado
          </button>
        </div>
        <select
          className={camposInvalidos.has('programa') ? 'cp-input-error' : ''}
          value={datos.idPrograma ?? ''}
          onChange={(e) => setDatos({ ...datos, idPrograma: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Selecciona un programa</option>
          {programasFiltrados.map((p) => (
            <option key={p.id_programa} value={p.id_programa}>
              {p.nombre}
            </option>
          ))}
        </select>
        {camposInvalidos.has('programa') && (
          <p className="cp-campo-error-msg">Selecciona el programa académico al que se articula el proyecto.</p>
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
              onChange={(e) => setDatos({ ...datos, departamento: e.target.value })}
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
              onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })}
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
  onCambiar,
}: {
  sel: GrupoSeleccionado
  esExterno: boolean
  facultades: catalogosApi.FacultadItem[]
  programasCompletos: catalogosApi.ProgramaItem[]
  onCambiar: (cambios: Partial<GrupoSeleccionado>) => void
}) {
  // "Facultad"/"Programa" con catálogo real solo aplican al grupo CESMAG
  // (interno): una universidad o entidad externa no está en ese catálogo,
  // así que ahí se sigue escribiendo a mano (Universidad/Entidad, Dependencia).
  const programasDeFacultad = sel.idFacultad
    ? programasCompletos.filter((p) => p.id_facultad === sel.idFacultad)
    : programasCompletos

  return (
    <>
      <div className="cp-field-row">
        <label>Nombre del Grupo:</label>
        <input type="text" value={sel.nombre} onChange={(e) => onCambiar({ nombre: e.target.value })} />
      </div>

      <div className="cp-field-row">
        <label>{esExterno ? 'Universidad / Entidad:' : 'Facultad/Departamento:'}</label>
        {esExterno ? (
          <input type="text" value={sel.facultad} onChange={(e) => onCambiar({ facultad: e.target.value })} />
        ) : (
          <select
            value={sel.idFacultad ?? ''}
            onChange={(e) =>
              onCambiar({
                idFacultad: e.target.value ? Number(e.target.value) : null,
                idPrograma: null,
              })
            }
          >
            <option value="">Selecciona una facultad</option>
            {facultades.map((f) => (
              <option key={f.id_facultad} value={f.id_facultad}>
                {f.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="cp-field-row">
        <label>{esExterno ? 'Programa Académico/Dependencia:' : 'Programa Académico:'}</label>
        {esExterno ? (
          <input type="text" value={sel.programa} onChange={(e) => onCambiar({ programa: e.target.value })} />
        ) : (
          <select
            value={sel.idPrograma ?? ''}
            onChange={(e) => onCambiar({ idPrograma: e.target.value ? Number(e.target.value) : null })}
            disabled={!sel.idFacultad}
          >
            <option value="">{sel.idFacultad ? 'Selecciona un programa' : 'Primero elige una facultad'}</option>
            {programasDeFacultad.map((p) => (
              <option key={p.id_programa} value={p.id_programa}>
                {p.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="cp-field-row">
        <label>{esExterno ? 'Director del Grupo:' : 'Líder del grupo:'}</label>
        <input type="text" value={sel.lider} onChange={(e) => onCambiar({ lider: e.target.value })} />
      </div>

      <div className="cp-field-row">
        <label>Código GrupLac:</label>
        <input type="text" value={sel.codGruplac} onChange={(e) => onCambiar({ codGruplac: e.target.value })} />
        <span className="cp-dedicacion-label">Reconocido por MINCIENCIAS:</span>
        <DedicacionToggle
          name={`minciencias-${esExterno ? 'ext' : 'cesmag'}-${sel.id}`}
          opciones={['Sí', 'No']}
          value={sel.reconocidoMinciencias ? 'Sí' : 'No'}
          onChange={(v) => onCambiar({ reconocidoMinciencias: v === 'Sí' })}
        />
      </div>

      <div className="cp-field-row">
        <label>Categoría:</label>
        <input type="text" value={sel.categoria} onChange={(e) => onCambiar({ categoria: e.target.value })} />
        <span className="cp-dedicacion-label">Acuerdo Institucional:</span>
        <input
          type="text"
          className="cp-google-academico-input"
          value={sel.acuerdoInstitucional}
          onChange={(e) => onCambiar({ acuerdoInstitucional: e.target.value })}
        />
      </div>
    </>
  )
}

interface GruposEgresadosProps {
  lineasInvestigacion: catalogosApi.CatalogoItem[]
  ods: catalogosApi.CatalogoItem[]
  dedicaciones: catalogosApi.CatalogoItem[]
  facultades: catalogosApi.FacultadItem[]
  programasCompletos: catalogosApi.ProgramaItem[]
  lineasMedulares: string[]
  gruposCesmagSel: GrupoSeleccionado[]
  setGruposCesmagSel: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>
  gruposExternosSel: GrupoSeleccionado[]
  setGruposExternosSel: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>
  egresadosInfo: EgresadoInfo[]
  setEgresadosInfo: React.Dispatch<React.SetStateAction<EgresadoInfo[]>>
  idsUsuariosUsados: number[]
}

function GruposEgresados({
  lineasInvestigacion,
  ods,
  dedicaciones,
  facultades,
  programasCompletos,
  lineasMedulares,
  gruposCesmagSel,
  setGruposCesmagSel,
  gruposExternosSel,
  setGruposExternosSel,
  egresadosInfo,
  setEgresadosInfo,
  idsUsuariosUsados,
}: GruposEgresadosProps) {
  const actualizarSel = (
    lista: GrupoSeleccionado[],
    setLista: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>,
    id: number,
    cambios: Partial<GrupoSeleccionado>
  ) => {
    setLista(lista.map((g) => (g.id === id ? { ...g, ...cambios } : g)))
  }

  const quitarEgresado = (id: number) => {
    if (egresadosInfo.length <= 1) return
    setEgresadosInfo(egresadosInfo.filter((eg) => eg.id !== id))
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">
        GRUPO DE INVESTIGACIÓN AL CUAL ESTÁ ADSCRITO EL PROYECTO EN UNICESMAG
      </div>

      {gruposCesmagSel.map((sel) => (
        <div className="cp-grupo-block" key={sel.id}>
          <CamposGrupoManual
            sel={sel}
            esExterno={false}
            facultades={facultades}
            programasCompletos={programasCompletos}
            onCambiar={(cambios) => actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, cambios)}
          />

          <div className="cp-field-row">
            <label>Línea activa de Investigación en la cual está vinculado el proyecto:</label>
            <select
              value={sel.idLinea ?? ''}
              onChange={(e) =>
                actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, {
                  idLinea: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Selecciona una línea de investigación</option>
              {lineasInvestigacion.map((l) => (
                <option key={l.id_linea} value={l.id_linea}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="cp-field-row">
            <label>Objetivo de Desarrollo Sostenible ODS en el cual está asociado el proyecto (Obligatorio):</label>
            <select
              value={sel.idOds ?? ''}
              onChange={(e) =>
                actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, {
                  idOds: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Selecciona un ODS</option>
              {ods.map((o) => (
                <option key={o.id_ods} value={o.id_ods}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>

          <InvestigadoresMiniTable
            idBase={`cesmag-${sel.id}`}
            lista={sel.investigadoresExtra}
            setLista={(lista) => actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, { investigadoresExtra: lista })}
            dedicaciones={dedicaciones}
            idsUsuariosUsados={idsUsuariosUsados}
          />
        </div>
      ))}

      <div className="cp-section-header">GRUPO DE INVESTIGACIÓN EXTERNO</div>

      {gruposExternosSel.map((sel) => (
        <div className="cp-grupo-block" key={sel.id}>
          <CamposGrupoManual
            sel={sel}
            esExterno
            facultades={facultades}
            programasCompletos={programasCompletos}
            onCambiar={(cambios) => actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, cambios)}
          />

          <div className="cp-field-row">
            <label>Línea activa de Investigación en la cual está vinculado el proyecto:</label>
            <select
              value={sel.idLinea ?? ''}
              onChange={(e) =>
                actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, {
                  idLinea: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Selecciona una línea de investigación</option>
              {lineasInvestigacion.map((l) => (
                <option key={l.id_linea} value={l.id_linea}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="cp-field-row">
            <label>Línea medular Institucional en la cual está asociado el proyecto (Obligatorio):</label>
            <select
              value={sel.lineaMedular}
              onChange={(e) =>
                actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, { lineaMedular: e.target.value })
              }
            >
              <option value="">Selecciona una línea medular</option>
              {lineasMedulares.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>

          <InvestigadoresMiniTable
            idBase={`ext-${sel.id}`}
            lista={sel.investigadoresExtra}
            setLista={(lista) => actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, { investigadoresExtra: lista })}
            dedicaciones={dedicaciones}
            idsUsuariosUsados={idsUsuariosUsados}
          />
        </div>
      ))}

      <div className="cp-section-header">INFORMACIÓN GENERAL DE EGRESADOS(AS)</div>

      {egresadosInfo.map((eg, index) => (
        <div className="cp-grupo-block" key={eg.id}>
          {egresadosInfo.length > 1 && (
            <div className="cp-grupo-header">
              <p className="cp-grupo-label">Egresado(a) {index + 1}</p>
              <button
                type="button"
                className="cp-grupo-quitar"
                aria-label="Quitar este egresado"
                onClick={() => quitarEgresado(eg.id)}
              >
                <X size={14} />
                Quitar
              </button>
            </div>
          )}

          <div className="cp-field-row">
            <label>Facultad</label>
            <select
              value={eg.idFacultad ?? ''}
              onChange={(e) =>
                setEgresadosInfo(
                  egresadosInfo.map((x) =>
                    x.id === eg.id
                      ? { ...x, idFacultad: e.target.value ? Number(e.target.value) : null, idPrograma: null }
                      : x
                  )
                )
              }
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
              value={eg.idPrograma ?? ''}
              onChange={(e) =>
                setEgresadosInfo(
                  egresadosInfo.map((x) =>
                    x.id === eg.id ? { ...x, idPrograma: e.target.value ? Number(e.target.value) : null } : x
                  )
                )
              }
              disabled={!eg.idFacultad}
            >
              <option value="">{eg.idFacultad ? 'Selecciona un programa' : 'Primero elige una facultad'}</option>
              {programasCompletos
                .filter((p) => p.id_facultad === eg.idFacultad)
                .map((p) => (
                  <option key={p.id_programa} value={p.id_programa}>
                    {p.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div className="cp-field-row">
            <label>Empresa o Entidad</label>
            <input
              type="text"
              value={eg.empresa}
              onChange={(e) =>
                setEgresadosInfo(egresadosInfo.map((x) => (x.id === eg.id ? { ...x, empresa: e.target.value } : x)))
              }
            />
          </div>

          <div className="cp-mini-table">
            <div className="cp-mini-table-header">
              <span>Co investigador(a) Egresado(a)</span>
              <span>Dedicación (Horas semanales)</span>
            </div>
            <div className="cp-mini-table-row">
              <BuscadorUsuario
                value={eg.slot.usuario}
                onChange={(usuario) =>
                  setEgresadosInfo(
                    egresadosInfo.map((x) => (x.id === eg.id ? { ...x, slot: { ...x.slot, usuario } } : x))
                  )
                }
                excluidos={idsUsuariosUsados}
              />
              <input
                type="number"
                min={0}
                value={eg.horasSemanales}
                onChange={(e) =>
                  setEgresadosInfo(
                    egresadosInfo.map((x) => (x.id === eg.id ? { ...x, horasSemanales: e.target.value } : x))
                  )
                }
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() =>
          setEgresadosInfo([
            ...egresadosInfo,
            { id: Date.now(), slot: slotVacio(), idFacultad: null, idPrograma: null, empresa: '', horasSemanales: '' },
          ])
        }
      >
        <Plus size={14} />
        Añadir otra información de egresados
      </button>
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
      {datos.antecedentes.map((item) => (
        <div className="cp-item-row" key={item.id}>
          <TextareaConContador
            value={item.texto}
            onChange={(v) =>
              setDatos({
                ...datos,
                antecedentes: datos.antecedentes.map((a) => (a.id === item.id ? { ...a, texto: v } : a)),
              })
            }
            claveLimite="antecedente"
            placeholder="Preferiblemente de los últimos 5 años"
            claseWrapper="cp-textarea-numbered"
          />
          {datos.antecedentes.length > 1 && (
            <button
              type="button"
              className="cp-mini-table-quitar cp-item-quitar"
              aria-label="Quitar este antecedente"
              onClick={() =>
                setDatos({ ...datos, antecedentes: datos.antecedentes.filter((a) => a.id !== item.id) })
              }
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {datos.antecedentes.length < getLimiteAntecedentes() && (
        <button
          type="button"
          className="cp-add-grupo"
          onClick={() =>
            setDatos({ ...datos, antecedentes: [...datos.antecedentes, { id: Date.now(), texto: '' }] })
          }
        >
          <Plus size={14} />
          Añadir otro antecedente máx({getLimiteAntecedentes()})
        </button>
      )}
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
                <input
                  type="text"
                  value={getImpacto(obj.id).impactoEsperado}
                  onChange={(e) => actualizarImpactoEsperado(obj.id, e.target.value)}
                />
              </td>
              <td className="cp-impacto-value">
                <input
                  type="text"
                  value={getImpacto(obj.id).beneficiarioPotencial}
                  onChange={(e) => actualizarBeneficiario(obj.id, e.target.value)}
                />
              </td>
              <td className="cp-impacto-value">
                <input
                  type="text"
                  value={getImpacto(obj.id).indicadorVerificable}
                  onChange={(e) => actualizarIndicador(obj.id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cp-section-header">REFERENCIAS</div>
      {datos.referencias.map((item) => (
        <div className="cp-item-row" key={item.id}>
          <TextareaConContador
            value={item.texto}
            onChange={(v) =>
              setDatos({
                ...datos,
                referencias: datos.referencias.map((r) => (r.id === item.id ? { ...r, texto: v } : r)),
              })
            }
            claveLimite="referencia"
            placeholder="Ej. Apellido, A. (Año). Título del trabajo. Editorial/Revista."
            claseWrapper="cp-textarea-numbered"
          />
          {datos.referencias.length > 1 && (
            <button
              type="button"
              className="cp-mini-table-quitar cp-item-quitar"
              aria-label="Quitar esta referencia"
              onClick={() =>
                setDatos({ ...datos, referencias: datos.referencias.filter((r) => r.id !== item.id) })
              }
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
          setDatos({ ...datos, referencias: [...datos.referencias, { id: Date.now(), texto: '' }] })
        }
      >
        <Plus size={14} />
        Añadir otra referencia
      </button>
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
  periodos: catalogosApi.CatalogoItem[]
}

function Cronograma({ cronogramas, setCronogramas, maxCronogramas, periodos }: CronogramaProps) {
  const addCronograma = () => {
    if (cronogramas.length >= maxCronogramas) return
    setCronogramas([
      ...cronogramas,
      { id: Date.now(), actividades: [crearActividadVacia()] },
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
                    <span>{periodos[cIndex]?.nombre ?? `Periodo ${cIndex + 1}`} - Año</span>
                    <select
                      value={cronograma.actividades[0]?.anio}
                      onChange={(e) =>
                        cronograma.actividades.forEach((a) =>
                          actualizarActividad(cronograma.id, a.id, 'anio', e.target.value)
                        )
                      }
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
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
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'actividad', e.target.value)}
                    />
                  </td>
                  <td className="cp-col-resultado">
                    <input
                      type="text"
                      value={a.resultado}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'resultado', e.target.value)}
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
                                onChange={(e) => cambiar(responsables.map((r, j) => (j === i ? e.target.value : r)))}
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
  nombres: string
  apellidos: string
  correo: string
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

function crearHojaVidaVacia(): HojaDeVida {
  return {
    id: Date.now() + Math.random(),
    nombres: '',
    apellidos: '',
    correo: '',
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

interface HojasVidaProps {
  hojasVida: HojaDeVida[]
  setHojasVida: React.Dispatch<React.SetStateAction<HojaDeVida[]>>
  camposInvalidos: Set<CampoHojaVida>
}

function HojasVida({ hojasVida, setHojasVida, camposInvalidos }: HojasVidaProps) {
  const actualizarHoja = (id: number, campo: keyof HojaDeVida, valor: string) => {
    setHojasVida(hojasVida.map((h) => (h.id === id ? { ...h, [campo]: valor } : h)))
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

  const addHojaVida = () => {
    setHojasVida([...hojasVida, crearHojaVidaVacia()])
  }

  const quitarHojaVida = (id: number) => {
    setHojasVida(hojasVida.filter((h) => h.id !== id))
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
            {index > 0 && (
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
            {index === 0 ? 'Información investigador(a) principal' : 'Información co-investigador(a)'}
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
              <input
                type="date"
                className={claseError(index, 'fechaNacimiento')}
                value={hoja.fechaNacimiento}
                onChange={(e) => actualizarHoja(hoja.id, 'fechaNacimiento', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Nacionalidad</label>
              <input
                type="text"
                className={claseError(index, 'nacionalidad')}
                value={hoja.nacionalidad}
                onChange={(e) => actualizarHoja(hoja.id, 'nacionalidad', e.target.value)}
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
              <label>Correo Electrónico</label>
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
          <textarea
            className={`cp-textarea ${claseError(index, 'cargoActual')}`}
            value={hoja.cargoActual}
            onChange={(e) => actualizarHoja(hoja.id, 'cargoActual', e.target.value)}
          />

          <div className="cp-subheader">Cargos desempeñados</div>
          <textarea
            className={`cp-textarea ${claseError(index, 'cargosDesempenados')}`}
            value={hoja.cargosDesempenados}
            onChange={(e) => actualizarHoja(hoja.id, 'cargosDesempenados', e.target.value)}
          />

          <div className="cp-subheader">Títulos académicos obtenidos (área, disciplina, universidad, año)</div>
          <textarea
            className={`cp-textarea ${claseError(index, 'titulosAcademicos')}`}
            value={hoja.titulosAcademicos}
            onChange={(e) => actualizarHoja(hoja.id, 'titulosAcademicos', e.target.value)}
          />

          <div className="cp-subheader">
            Producción científica y académica (las 5 más importantes en los últimos 5 años)
          </div>
          <textarea
            className={`cp-textarea ${claseError(index, 'produccionCientifica')}`}
            value={hoja.produccionCientifica}
            onChange={(e) => actualizarHoja(hoja.id, 'produccionCientifica', e.target.value)}
          />
        </div>
      ))}

      <button type="button" className="cp-add-grupo" onClick={addHojaVida}>
        <Plus size={14} />
        Añadir otra información co-investigador(a)
      </button>
    </div>
  )
}

interface FirmasAnexosProps {
  archivosDocumentos: Record<string, File | null>
  setArchivoDocumento: (nombre: string, f: File | null) => void
  /** true = ya se intentó guardar sin ningún documento cargado. */
  mostrarErrorDocumentos: boolean
}

interface FirmaFinal {
  archivo: string | null
  nombreCompleto: string
}

const ROLES_FIRMA_FINAL = [
  'Investigador(a) Principal',
  'Co Investigador(a) UNICESMAG',
  'Co Investigador(a) Externo(a)',
  'Co Investigador(a) Externo(a)',
  'Co Investigador(a) Egresado(a)',
  'Co Investigador(a) Egresado(a)',
]

function crearFirmasFinalesVacias(): FirmaFinal[] {
  return ROLES_FIRMA_FINAL.map(() => ({ archivo: null, nombreCompleto: '' }))
}

function FirmasAnexos({
  archivosDocumentos,
  setArchivoDocumento,
  mostrarErrorDocumentos,
}: FirmasAnexosProps) {
  const inputsDocumentosRef = useRef<Record<string, HTMLInputElement | null>>({})

  const [firmas, setFirmas] = useState<FirmaFinal[]>(crearFirmasFinalesVacias())
  const [diaFirma, setDiaFirma] = useState('')
  const [mesFirma, setMesFirma] = useState('')
  const [anioFirma, setAnioFirma] = useState('')

  const actualizarFirma = (index: number, cambios: Partial<FirmaFinal>) => {
    setFirmas(firmas.map((f, i) => (i === index ? { ...f, ...cambios } : f)))
  }

  const handleCargarFirmaFinal = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    actualizarFirma(index, { archivo: file.name })
    e.target.value = ''
  }

  const handleDescargarFormato = () => {
    console.log('Descargar plantilla de proyecto — pendiente de un archivo real que enlazar')
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">FIRMAS</div>
      <p className="cp-firma-fecha-linea">
        Se firma a los
        <input
          type="text"
          className="cp-firma-fecha-input"
          placeholder="XX"
          maxLength={2}
          value={diaFirma}
          onChange={(e) => setDiaFirma(e.target.value)}
        />
        días del mes de
        <input
          type="text"
          className="cp-firma-fecha-input cp-firma-fecha-input-mes"
          placeholder="XXXX"
          value={mesFirma}
          onChange={(e) => setMesFirma(e.target.value)}
        />
        de
        <input
          type="text"
          className="cp-firma-fecha-input"
          placeholder="XXXX"
          maxLength={4}
          value={anioFirma}
          onChange={(e) => setAnioFirma(e.target.value)}
        />
        , en acuerdo de lo expuesto anteriormente:
      </p>

      <p className="cp-hint-text">
        Por ahora la firma se hace subiendo una imagen de la firma digital — el mecanismo definitivo
        (firma electrónica, biométrica, etc.) todavía está por confirmarse.
      </p>

      <div className="cp-firmas-grid">
        {ROLES_FIRMA_FINAL.map((rol, index) => {
          const firma = firmas[index]
          return (
            <div className="cp-firma-block" key={index}>
              <span className="cp-firma-label">Firma</span>
              <label className="cp-firma-upload-btn">
                <Upload size={14} />
                {firma.archivo ?? 'Adjuntar firma digital'}
                <input
                  type="file"
                  className="cp-file-input"
                  onChange={(e) => handleCargarFirmaFinal(index, e)}
                />
              </label>
              <input
                type="text"
                className="cp-firma-nombre-input"
                placeholder="Nombre Completo"
                value={firma.nombreCompleto}
                onChange={(e) => actualizarFirma(index, { nombreCompleto: e.target.value })}
              />
              <span className="cp-firma-rol">{rol}</span>
            </div>
          )
        })}
      </div>

      <div className="cp-section-header">PROYECTO EN FORMATO</div>
      <button type="button" className="cp-descargar-btn" onClick={handleDescargarFormato}>
        <Download size={16} />
        Descargar
      </button>

      <div className="cp-section-header">Cargue de documentos</div>

      <div className="cp-documentos-table">
        {NOMBRES_DOCUMENTOS_FIRMAS.map((nombre) => {
          const archivo = archivosDocumentos[nombre] ?? null
          return (
            <div className="cp-documentos-row" key={nombre}>
              <span>{nombre}</span>
              <button
                type="button"
                className="cp-cargar-btn"
                onClick={() => inputsDocumentosRef.current[nombre]?.click()}
              >
                <Upload size={14} />
                {archivo ? archivo.name : 'Cargar'}
              </button>
              <input
                ref={(el) => { inputsDocumentosRef.current[nombre] = el }}
                type="file"
                className="cp-file-input"
                onChange={(e) => setArchivoDocumento(nombre, e.target.files?.[0] ?? null)}
              />
            </div>
          )
        })}
      </div>

      <p className="cp-hint-text">Adicionar los formatos vigentes para la convocatoria (obligatorio cargar al menos uno).</p>
      {mostrarErrorDocumentos && (
        <p className="cp-campo-error-msg">Carga al menos un documento antes de guardar.</p>
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
  dedicaciones: catalogosApi.CatalogoItem[]
  idsUsuariosUsados: number[]
}

function InvestigadoresMiniTable({ idBase, lista, setLista, dedicaciones, idsUsuariosUsados }: InvestigadorMiniTableProps) {
  const actualizarFila = (index: number, cambios: Partial<SlotParticipante>) => {
    setLista(lista.map((f, i) => (i === index ? { ...f, ...cambios } : f)))
  }

  const quitarFila = (index: number) => {
    setLista(lista.filter((_, i) => i !== index))
  }

  return (
    <div className="cp-mini-table">
      <div className="cp-mini-table-header">
        <span>Investigadores del proyecto</span>
        <span>Dedicación</span>
        <span aria-hidden="true" />
      </div>

      {lista.map((fila, index) => (
        <div className="cp-mini-table-row" key={index}>
          <BuscadorUsuario
            value={fila.usuario}
            onChange={(usuario) => actualizarFila(index, { usuario })}
            excluidos={idsUsuariosUsados}
          />
          <DedicacionToggle
            name={`investigador-dedicacion-${idBase}-${index}`}
            opciones={['TC', 'MT', 'HC']}
            value={dedicaciones.find((d) => d.id_dedicacion === fila.idDedicacion)?.nombre}
            onChange={(nombre) =>
              actualizarFila(index, {
                idDedicacion: dedicaciones.find((d) => d.nombre === nombre)?.id_dedicacion ?? null,
              })
            }
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
        Añadir investigador
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
  const maxCaracteres = getLimite(claveLimite)
  const caracteres = contarCaracteres(value)
  const excedido = caracteres > maxCaracteres

  const manejarCambio = (nuevoValor: string) => {

    const nuevosCaracteres = contarCaracteres(nuevoValor)
    if (nuevosCaracteres > maxCaracteres && nuevosCaracteres > caracteres) return
    onChange(nuevoValor)
  }

  return (
    <div className={`cp-textarea-wrapper${claseWrapper ? ` ${claseWrapper}` : ''}`}>
      <textarea
        className="cp-textarea"
        value={value}
        placeholder={placeholder}
        onChange={(e) => manejarCambio(e.target.value)}
      />
      <span className={`cp-char-count${excedido ? ' cp-char-count-excedido' : ''}`}>
        {caracteres}/{maxCaracteres} caracteres
      </span>
    </div>
  )
}

export default CrearProyecto