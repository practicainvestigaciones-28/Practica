import { useRef, useState, useEffect } from 'react'
import { Save, Plus, Download, Upload, X } from 'lucide-react'
import './CrearProyecto.css'
import { useNavigate } from 'react-router-dom'
import * as convocatoriasApi from '../lib/convocatorias'
import {
  getModalidadTipoItemsActivos,
  sincronizarConBackend as sincronizarModalidadTipoConBackend,
} from '../lib/modalidadTipo'
import { getAreasActivas, sincronizarConBackend as sincronizarAreasConBackend } from '../lib/areasConocimiento'
import { getProgramasActivos, sincronizarConBackend as sincronizarProgramasConBackend } from '../lib/programas'
import {
  getPeriodos as getPeriodosLocal,
  getPeriodosActivos,
  sincronizarConBackend as sincronizarPeriodosConBackend,
  extraerNumeroDePeriodo,
} from '../lib/periodos'
import { getPerfilAcademico, setPerfilAcademico, type PerfilAcademico } from '../lib/perfilAcademico'
import {
  getLineasActivas,
  sincronizarConBackend as sincronizarLineasConBackend,
} from '../lib/lineasInvestigacion'
import {
  getLimite,
  getLimiteAntecedentes,
  contarPalabras,
  type ClaveLimiteTexto,
} from '../lib/limitesTexto'
import { combinarConBackend, type CategoriaProductoLocal } from '../lib/productosInvestigacion'
import * as catalogosApi from '../api/catalogos'
import * as gruposApi from '../api/grupos'
import * as usuariosApi from '../api/usuarios'
import * as productosApi from '../api/productos'
import * as tiposDocumentoApi from '../api/tiposDocumento'
import * as documentosApi from '../api/documentos'
import { useAuth } from '../context/AuthContext'
import * as proyectosApi from '../api/proyectos'
import { ApiError } from '../api/client'
import BuscadorUsuario from '../components/BuscadorUsuario'
import ConfirmModal from '../components/ConfirmModal'

/** Deja solo dígitos — lo que realmente se guarda en el estado y se manda al backend. */
function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** Puntos de miles para mostrar en pantalla (ej. "20000000" -> "20.000.000"). */
function formatearMiles(valor: string): string {
  const digitos = soloDigitos(valor)
  if (!digitos) return ''
  return Number(digitos).toLocaleString('es-CO')
}

type Tab =
  | 'general'
  | 'grupos'
  | 'formulacion'
  | 'marco'
  | 'cronograma'
  | 'resultados'
  | 'etico'
  | 'firmas'

const tabs: { id: Tab; label: string }[] = [
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

// Datos de "Información general" que sí tienen un lugar real en el backend.
// (Los investigadores por nombre y la duración en periodos todavía NO se
// guardan — ver nota al pie del archivo, sección InformacionGeneral.)
export interface DatosGeneral {
  titulo: string
  idModalidad: number | null
  idArea: number | null
  idPrograma: number | null
  programaOtro: string
  ciudad: string
  departamento: string
  idTipoProyecto: number | null
  valorSolicitado: string
  valorContrapartida: string
  duracion: string
}

/** Campos de "Información general" que se marcan en rojo cuando faltan por diligenciar. */
export type CampoGeneral = 'titulo' | 'modalidad' | 'tipo'

const datosGeneralIniciales: DatosGeneral = {
  titulo: '',
  idModalidad: null,
  idArea: null,
  idPrograma: null,
  programaOtro: '',
  ciudad: '',
  departamento: '',
  idTipoProyecto: null,
  valorSolicitado: '',
  valorContrapartida: '',
  duracion: '',
}

// "Formulación del proyecto" y "Marco teórico y metodología": van directo
// como campos de texto de Proyecto (se mandan en el mismo POST de creación).
export interface DatosTexto {
  resumen: string
  planteamiento: string
  pregunta: string
  justificacion: string
  objetivoGeneral: string
  antecedentes: ItemLista[]
  marcoTeorico: string
  metodologia: string
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
  funcionesEstudiante: '',
  referencias: [{ id: 1, texto: '' }],
}

interface ImpactoPorObjetivo {
  impactoEsperado: string
  beneficiarioPotencial: string
  indicadorVerificable: string
}

/** El grupo ya NO se elige de un catálogo — se escribe a mano, igual que
 * en el formulario en físico (INV-IC-FR v7). Al guardar el proyecto se
 * registra como un grupo nuevo en el catálogo real (RQF23), que es una
 * acción solo de Administrador — si quien crea el proyecto es
 * investigador, ese registro puede fallar; el resto del proyecto se
 * guarda igual, solo que sin ese grupo asociado. */
interface GrupoSeleccionado {
  id: number
  nombre: string
  /** "Facultad/Departamento" (CESMAG) o "Universidad/Entidad" (externo). */
  facultad: string
  /** "Programa Académico" (CESMAG) o "Programa Académico/Dependencia" (externo). */
  programa: string
  /** "Líder del grupo" (CESMAG) o "Director del Grupo" (externo). */
  lider: string
  codGruplac: string
  reconocidoMinciencias: boolean
  categoria: string
  acuerdoInstitucional: string
  /** Solo aplica a grupos externos. */
  lineaMedular: string
  idLinea: number | null
  /** Solo aplica a grupos CESMAG (obligatorio). No hay pantalla de admin
   * para el catálogo de ODS, así que se escribe libremente (no es un
   * selector) — al guardar se intenta registrar/reutilizar en el
   * catálogo real, pero sin bloquear el guardado si no se puede. */
  odsTexto: string
  investigadoresExtra: SlotParticipante[]
}

const grupoSeleccionadoVacio = (id: number): GrupoSeleccionado => ({
  id,
  nombre: '',
  facultad: '',
  programa: '',
  lider: '',
  codGruplac: '',
  reconocidoMinciencias: false,
  categoria: '',
  acuerdoInstitucional: '',
  lineaMedular: '',
  idLinea: null,
  odsTexto: '',
  investigadoresExtra: [slotVacio()],
})

interface EgresadoInfo {
  id: number
  slot: SlotParticipante
  facultad: string
  programaAcademico: string
  empresa: string
  horasSemanales: string
}

interface SlotParticipante {
  usuario: usuariosApi.UsuarioBuscado | null
  idDedicacion: number | null
}

interface GrupoParticipantes {
  id: number
  principal: SlotParticipante
  coInvestigador: SlotParticipante
  externo1: SlotParticipante
  externo2: SlotParticipante
  egresado1: SlotParticipante
  egresado2: SlotParticipante
  // El formulario en físico pide la cédula del egresado, pero no siempre
  // viene con el usuario elegido (ni el backend la trae siempre) — se
  // escribe a mano, no se autocompleta.
  cedulaEgresado1: string
  cedulaEgresado2: string
}

const slotVacio = (): SlotParticipante => ({ usuario: null, idDedicacion: null })

const crearGrupoParticipantesVacio = (id: number): GrupoParticipantes => ({
  id,
  principal: slotVacio(),
  coInvestigador: slotVacio(),
  externo1: slotVacio(),
  externo2: slotVacio(),
  egresado1: slotVacio(),
  egresado2: slotVacio(),
  cedulaEgresado1: '',
  cedulaEgresado2: '',
})

/** "Estudiante Investigador(a)" ya NO va dentro de cada grupo — en el
 * formulario en físico (INV-IC-FR v7) son hasta 3 filas independientes en
 * la sección de Información General, cada una con su propio rol. */
interface EstudianteSlot {
  usuario: usuariosApi.UsuarioBuscado | null
  idRolEstudiante: number | null
  /** Se escribe a mano — el buscador de usuarios no trae el código estudiantil. */
  codigo: string
}

const estudianteSlotVacio = (): EstudianteSlot => ({ usuario: null, idRolEstudiante: null, codigo: '' })

function CrearProyecto() {
  const [tab, setTab] = useState<Tab>('general')
  const navigate = useNavigate()
  const { usuario } = useAuth()
  // Un solo grupo de investigadores fijo — ya no se puede agregar más
  // (ese espacio ahora es para "Estudiante Investigador(a)", que sí admite varios).
  const grupos: Bloque[] = [{ id: 1 }]
  const [participantesPorGrupo, setParticipantesPorGrupo] = useState<GrupoParticipantes[]>([
    crearGrupoParticipantesVacio(1),
  ])
  const [estudiantesInvestigadores, setEstudiantesInvestigadores] = useState<EstudianteSlot[]>([
    estudianteSlotVacio(),
  ])

  const [objetivosEspecificos, setObjetivosEspecificos] = useState<ItemLista[]>([
    { id: 1, texto: '' },
  ])
  const [datosTexto, setDatosTexto] = useState<DatosTexto>(datosTextoIniciales)
  const [impactos, setImpactos] = useState<Record<number, ImpactoPorObjetivo>>({})
  const [gruposCesmagSel, setGruposCesmagSel] = useState<GrupoSeleccionado[]>([grupoSeleccionadoVacio(1)])
  const [gruposExternosSel, setGruposExternosSel] = useState<GrupoSeleccionado[]>([grupoSeleccionadoVacio(1)])
  const [cronogramas, setCronogramas] = useState<CronogramaBloque[]>([
    { id: 1, actividades: [crearActividadVacia()] },
  ])
  const [egresadosInfo, setEgresadosInfo] = useState<EgresadoInfo[]>([
    { id: 1, slot: slotVacio(), facultad: '', programaAcademico: '', empresa: '', horasSemanales: '' },
  ])
  const [tiposDocumento, setTiposDocumento] = useState<tiposDocumentoApi.TipoDocumentoItem[]>([])
  const [archivoFirmado, setArchivoFirmado] = useState<File | null>(null)
  const [archivoEtica, setArchivoEtica] = useState<File | null>(null)
  const [hojasVida, setHojasVida] = useState<HojaDeVida[]>([crearHojaVidaVacia()])

  const [datosGeneral, setDatosGeneral] = useState<DatosGeneral>(datosGeneralIniciales)
  const [modalidades, setModalidades] = useState<catalogosApi.CatalogoItem[]>([])
  const [areas, setAreas] = useState<catalogosApi.CatalogoItem[]>([])
  const [tiposProyecto, setTiposProyecto] = useState<catalogosApi.CatalogoItem[]>([])
  const [programas, setProgramas] = useState<catalogosApi.ProgramaItem[]>([])
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
  const [mostrarProyectoCreado, setMostrarProyectoCreado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [idProyectoCreado, setIdProyectoCreado] = useState<number | null>(null)
  const [objetivosCreadosIds, setObjetivosCreadosIds] = useState<Record<number, number>>({})

  const ordenTabs: Tab[] = ['general', 'grupos', 'formulacion', 'marco', 'cronograma', 'resultados', 'etico', 'firmas']
  const avanzarSiguienteTab = () => {
    const idx = ordenTabs.indexOf(tab)
    if (idx >= 0 && idx < ordenTabs.length - 1) setTab(ordenTabs[idx + 1])
  }

  useEffect(() => {
    async function cargar() {
      try {
        const [modalidadesRes, areasRes, tiposRes, programasRes, lineasRes, odsRes, tiposGrupoRes, dedicacionesRes, rolesProyectoRes, rolesEstudianteRes, periodosRes, categoriasProductoRes, tiposDocumentoRes, convocatoriasRes] = await Promise.all([
          catalogosApi.listarModalidadesProyecto(),
          catalogosApi.listarAreasConocimiento(),
          catalogosApi.listarTiposProyecto(),
          catalogosApi.listarProgramas(),
          catalogosApi.listarLineasInvestigacion(),
          catalogosApi.listarOds(),
          catalogosApi.listarTiposGrupo(),
          catalogosApi.listarDedicaciones(),
          catalogosApi.listarRolesProyecto(),
          catalogosApi.listarRolesEstudiante(),
          catalogosApi.listarPeriodos(),
          productosApi.listarCategoriasProducto(),
          tiposDocumentoApi.listarTiposDocumento(),
          convocatoriasApi.listarConvocatorias({ estado: 'activa' }),
        ])
        // El admin puede desactivar/renombrar/eliminar modalidades, tipos,
        // áreas de conocimiento y programas académicos desde sus pantallas
        // — pero eso hoy vive en listas locales (todavía no hay endpoints
        // reales para editar/desactivar/eliminar), así que cada una se
        // sincroniza con lo que trajo el backend (para que los ids sean
        // reales) y se usa ESA lista, ya filtrada por activas, en vez del
        // catálogo crudo.
        sincronizarModalidadTipoConBackend(modalidadesRes, tiposRes)
        setModalidades(
          getModalidadTipoItemsActivos('modalidad').map((i) => ({ id_modalidad: i.id, nombre: i.nombre }))
        )
        setTiposProyecto(
          getModalidadTipoItemsActivos('tipo').map((i) => ({ id_tipo_proyecto: i.id, nombre: i.nombre }))
        )
        sincronizarAreasConBackend(areasRes)
        setAreas(getAreasActivas().map((a) => ({ id_area_conocimiento: a.id, nombre: a.nombre })))
        sincronizarProgramasConBackend(programasRes)
        setProgramas(getProgramasActivos().map((p) => ({ id_programa: p.id, nombre: p.nombre })))
        sincronizarLineasConBackend(lineasRes)
        setLineasInvestigacion(
          getLineasActivas('investigacion').map((l) => ({ id_linea: l.id, nombre: l.nombre }))
        )
        setOds(odsRes)
        setTiposGrupo(tiposGrupoRes)
        setDedicaciones(dedicacionesRes)
        setRolesProyecto(rolesProyectoRes)
        setRolesEstudiante(rolesEstudianteRes)
        sincronizarPeriodosConBackend(periodosRes)
        setPeriodos(getPeriodosActivos().map((p) => ({ id_periodo: p.id, nombre: p.nombre })))
        setCategoriasProducto(combinarConBackend(categoriasProductoRes))
        setTiposDocumento(tiposDocumentoRes)

        setIdConvocatoriaActiva(convocatoriasRes[0] ? convocatoriasRes[0].id_convocatoria : null)
      } catch (err) {
        setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudieron cargar los catálogos.')
      } finally {
        setCargandoCatalogos(false)
      }
    }
    cargar()
  }, [])

  // Usuarios ya elegidos en CUALQUIER campo del formulario — para no
  // dejar seleccionar dos veces al mismo en distintos lugares.
  // "Duración del proyecto (en periodos)" se arma con los períodos que el
  // admin tenga activos EN LOCAL — a diferencia de "periodos" (usado en
  // Cronograma), aquí no hace falta que tengan id real: este campo solo
  // guarda un número (duracion_periodos), no una referencia a un período
  // puntual. Por eso se lee directo de la lista local completa, filtrada
  // solo por activo — así el toggle de activar/desactivar del admin se ve
  // reflejado de una al crear un proyecto, sin depender del backend.
  // Siempre en número (2, 3...), sin importar si el admin los escribió en
  // romano ("II") o en arábigo.
  const opcionesDuracion = (() => {
    const numeros = getPeriodosLocal()
      .filter((p) => p.activo)
      .map((p) => extraerNumeroDePeriodo(p.nombre))
      .filter((n): n is number => n !== null)
    const unicos = [...new Set(numeros)].sort((a, b) => a - b).map(String)
    return unicos.length > 0 ? unicos : ['2', '4']
  })()

  const idsUsuariosUsados: number[] = [
    ...participantesPorGrupo.flatMap((gp) =>
      [gp.principal, gp.coInvestigador, gp.externo1, gp.externo2, gp.egresado1, gp.egresado2].map(
        (slot) => slot.usuario?.id_usuario
      )
    ),
    ...estudiantesInvestigadores.map((e) => e.usuario?.id_usuario),
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

  /** Dedicación (TC/MT/HC) que el formulario en físico NO pide para
   * egresados ni estudiantes — se manda "HC" fija por debajo porque la
   * base de datos igual la exige, sin mostrarla en pantalla. */
  const idDedicacionPorDefecto = (): number | undefined =>
    dedicaciones.find((d) => d.nombre === 'HC')?.id_dedicacion ?? dedicaciones[0]?.id_dedicacion

  const guardarParticipantesDeGrupo = (idProyecto: number, gp: GrupoParticipantes): Promise<unknown>[] => {
    const idPrincipal = idRolPorNombre('Investigador(a) Principal UNICESMAG')
    const idCoInvestigador = idRolPorNombre('Co investigador(a) UNICESMAG')
    const idExterno = idRolPorNombre('Co investigador(a) Externo(a)')
    const idEgresado = idRolPorNombre('Co investigador(a) Egresado(a) UNICESMAG')

    const tareas: Promise<unknown>[] = []
    const slots: { slot: SlotParticipante; idRolPro: number | undefined }[] = [
      { slot: gp.principal, idRolPro: idPrincipal },
      { slot: gp.coInvestigador, idRolPro: idCoInvestigador },
      { slot: gp.externo1, idRolPro: idExterno },
      { slot: gp.externo2, idRolPro: idExterno },
      { slot: gp.egresado1, idRolPro: idEgresado },
      { slot: gp.egresado2, idRolPro: idEgresado },
    ]
    for (const { slot, idRolPro } of slots) {
      if (slot.usuario && slot.idDedicacion && idRolPro) {
        tareas.push(
          proyectosApi.agregarParticipanteProyecto(idProyecto, {
            participante: slot.usuario.id_usuario,
            id_dedicacion: slot.idDedicacion,
            id_rol_pro: idRolPro,
          })
        )
      }
    }
    return tareas
  }

  const guardarEstudiantesInvestigadores = (idProyecto: number): Promise<unknown>[] => {
    const idEstudianteRol = idRolPorNombre('Estudiante Investigador(a)')
    const idDedicacion = idDedicacionPorDefecto()

    const tareas: Promise<unknown>[] = []
    for (const est of estudiantesInvestigadores) {
      if (est.usuario && est.idRolEstudiante && idEstudianteRol && idDedicacion) {
        tareas.push(
          proyectosApi.agregarParticipanteProyecto(idProyecto, {
            participante: est.usuario.id_usuario,
            id_dedicacion: idDedicacion,
            id_rol_pro: idEstudianteRol,
            id_rol_estudiante: est.idRolEstudiante,
          })
        )
      }
    }
    return tareas
  }

  // En vez de cortar en el primer campo que falte, se juntan todos los que
  // estén vacíos de una vez — así el investigador los ve resaltados en
  // rojo y los completa todos en una sola pasada, sin ir y volver.
  const camposFaltantesGeneral = (): Set<CampoGeneral> => {
    const faltantes = new Set<CampoGeneral>()
    if (!datosGeneral.titulo.trim()) faltantes.add('titulo')
    if (!datosGeneral.idModalidad) faltantes.add('modalidad')
    if (!datosGeneral.idTipoProyecto) faltantes.add('tipo')
    return faltantes
  }

  /** Se usa cuando el investigador intenta guardar otra pestaña sin haber
   * guardado antes "Información general" (ahí es donde se crea el
   * proyecto): lo manda de vuelta a esa pestaña marcando en rojo lo que
   * le falte, en vez de un mensaje genérico de "guarda primero". */
  const exigirInformacionGeneralGuardada = () => {
    const faltantes = camposFaltantesGeneral()
    setCamposInvalidos(faltantes)
    setErrorEnvio(
      faltantes.size > 0
        ? 'Primero completa "Información general" — hay espacios vacíos marcados en rojo.'
        : 'Primero guarda "Información general" — ahí se crea el proyecto.'
    )
    setTab('general')
  }

  // ---------- Paso 1: Información general ----------
  const guardarInformacionGeneral = async () => {
    setErrorEnvio('')

    const faltantes = camposFaltantesGeneral()
    if (faltantes.size > 0) {
      setCamposInvalidos(faltantes)
      setErrorEnvio('Hay espacios vacíos por completar')
      return
    }
    setCamposInvalidos(new Set())

    if (!idConvocatoriaActiva) {
      setErrorEnvio('No hay ninguna convocatoria activa en este momento. No se puede registrar el proyecto.')
      return
    }

    setEnviando(true)
    try {
      let idProyecto = idProyectoCreado
      const esCreacionNueva = !idProyecto
      if (!idProyecto) {
        const proyecto = await proyectosApi.crearProyecto({
          id_convocatoria: idConvocatoriaActiva,
          id_modalidad_proyecto: datosGeneral.idModalidad!,
          id_tipo_proyecto: datosGeneral.idTipoProyecto!,
          titulo: datosGeneral.titulo.trim(),
          ciudad: datosGeneral.ciudad || undefined,
          departamento: datosGeneral.departamento || undefined,
          duracion_periodos: datosGeneral.duracion ? Number(datosGeneral.duracion) : undefined,
        })
        idProyecto = proyecto.id_proyecto
        setIdProyectoCreado(idProyecto)
      } else {
        await proyectosApi.actualizarProyecto(idProyecto, { titulo: datosGeneral.titulo.trim() })
      }

      const tareas: Promise<unknown>[] = []
      if (datosGeneral.idArea) tareas.push(proyectosApi.agregarAreaProyecto(idProyecto, datosGeneral.idArea))
      if (datosGeneral.idPrograma || datosGeneral.programaOtro.trim()) {
        tareas.push(
          proyectosApi.agregarProgramaProyecto(idProyecto, {
            id_programa: datosGeneral.idPrograma ?? undefined,
            programa_otro: datosGeneral.programaOtro.trim() || undefined,
          })
        )
      }
      if (datosGeneral.valorSolicitado) {
        tareas.push(
          proyectosApi.registrarFinanciacionProyecto(idProyecto, {
            valor_solicitado_unicesmag: Number(datosGeneral.valorSolicitado) || 0,
            valor_contrapartida: Number(datosGeneral.valorContrapartida) || 0,
          })
        )
      }
      for (const gp of participantesPorGrupo) tareas.push(...guardarParticipantesDeGrupo(idProyecto, gp))
      tareas.push(...guardarEstudiantesInvestigadores(idProyecto))
      await Promise.all(tareas)

      avanzarSiguienteTab()
      if (esCreacionNueva) setMostrarProyectoCreado(true)
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar Información general.')
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Paso 2: Grupos y egresados ----------
  const guardarGrupos = async () => {
    setErrorEnvio('')
    if (!idProyectoCreado) {
      exigirInformacionGeneralGuardada()
      return
    }
    const grupoCesmagSinOds = gruposCesmagSel.find((g) => g.nombre.trim() && !g.odsTexto.trim())
    if (grupoCesmagSinOds) {
      setErrorEnvio('Escribe el ODS obligatorio para cada grupo CESMAG que hayas diligenciado.')
      return
    }

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      const idCoInvestigador = idRolPorNombre('Co investigador(a) UNICESMAG')
      const idExterno = idRolPorNombre('Co investigador(a) Externo(a)')
      const idEgresado = idRolPorNombre('Co investigador(a) Egresado(a) UNICESMAG')
      const idDedicacion = idDedicacionPorDefecto()
      const idTipoGrupoInterno = tiposGrupo.find((t) => t.nombre === 'interno')?.id_tipo_grupo
      const idTipoGrupoExterno = tiposGrupo.find((t) => t.nombre === 'externo')?.id_tipo_grupo

      // El grupo se registra en el catálogo real al guardar (RQF23) — eso
      // es una acción solo de Administrador. Si quien crea el proyecto es
      // investigador, ese registro puntual puede fallar (403); se avisa
      // pero no se bloquea el resto del guardado.
      const gruposNoRegistrados: string[] = []

      // El ODS no tiene pantalla de admin, así que se escribe libremente —
      // se reutiliza si ya existe uno con ese nombre exacto, o se intenta
      // crear (también solo Administrador). Si no se puede, el grupo igual
      // se guarda, solo que sin ODS asociado.
      const resolverOds = async (texto: string): Promise<number | undefined> => {
        const nombre = texto.trim()
        if (!nombre) return undefined
        const existente = ods.find((o) => o.nombre.toLowerCase() === nombre.toLowerCase())
        if (existente?.id_ods) return existente.id_ods
        try {
          const respuesta = await catalogosApi.crearOds(nombre)
          return respuesta.registro.id_ods
        } catch {
          return undefined
        }
      }

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
            facultad_otra: g.facultad.trim() || undefined,
            programa_otro: g.programa.trim() || undefined,
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

      const tareas: Promise<unknown>[] = []
      for (const g of gruposCesmagSel) {
        tareas.push(resolverOds(g.odsTexto).then((idOds) => registrarGrupo(g, idTipoGrupoInterno, idOds)))
        for (const slot of g.investigadoresExtra) {
          if (slot.usuario && slot.idDedicacion && idCoInvestigador) {
            tareas.push(
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
        tareas.push(registrarGrupo(g, idTipoGrupoExterno, undefined))
        for (const slot of g.investigadoresExtra) {
          if (slot.usuario && slot.idDedicacion && idExterno) {
            tareas.push(
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
        tareas.push(
          (async () => {
            const creado = await proyectosApi.agregarParticipanteProyecto(idProyecto, {
              participante: eg.slot.usuario!.id_usuario,
              id_dedicacion: idDedicacion,
              id_rol_pro: idEgresado,
            })
            await proyectosApi.registrarInformacionEgresado(idProyecto, creado.participante.id_usuarioproyecto, {
              facultad: eg.facultad || undefined,
              programa_academico: eg.programaAcademico || undefined,
              empresa_entidad: eg.empresa || undefined,
              dedicacion_horas_semanales: eg.horasSemanales ? Number(eg.horasSemanales) : undefined,
            })
          })()
        )
      }
      await Promise.all(tareas)

      if (gruposNoRegistrados.length > 0) {
        setErrorEnvio(
          `El proyecto se guardó, pero no se pudo registrar en el catálogo: ${gruposNoRegistrados.join(', ')} ` +
            '(solo un Administrador puede registrar grupos nuevos). El resto de la información sí quedó guardada.'
        )
      }

      avanzarSiguienteTab()
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar Grupos y egresados.')
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Paso 3: Formulación del proyecto ----------
  const guardarFormulacion = async () => {
    setErrorEnvio('')
    if (!idProyectoCreado) {
      exigirInformacionGeneralGuardada()
      return
    }

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      await proyectosApi.actualizarProyecto(idProyecto, {
        resumen: datosTexto.resumen || undefined,
        planteamiento_problema: datosTexto.planteamiento || undefined,
        pregunta_investigacion: datosTexto.pregunta || undefined,
        justificacion: datosTexto.justificacion || undefined,
      })

      if (datosTexto.objetivoGeneral.trim() && !objetivosCreadosIds[-1]) {
        await proyectosApi.agregarObjetivoProyecto(idProyecto, 'general', datosTexto.objetivoGeneral.trim())
        setObjetivosCreadosIds((prev) => ({ ...prev, [-1]: 1 }))
      }

      const nuevosIds: Record<number, number> = {}
      for (const obj of objetivosEspecificos) {
        if (!obj.texto.trim() || objetivosCreadosIds[obj.id]) continue
        const creado = await proyectosApi.agregarObjetivoProyecto(idProyecto, 'especifico', obj.texto.trim())
        nuevosIds[obj.id] = creado.id_objetivo
      }
      if (Object.keys(nuevosIds).length > 0) {
        setObjetivosCreadosIds((prev) => ({ ...prev, ...nuevosIds }))
      }

      const tareasAntecedentes: Promise<unknown>[] = []
      for (const antecedente of datosTexto.antecedentes) {
        if (antecedente.texto.trim()) {
          tareasAntecedentes.push(proyectosApi.agregarAntecedenteProyecto(idProyecto, antecedente.texto.trim()))
        }
      }
      await Promise.all(tareasAntecedentes)

      avanzarSiguienteTab()
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar Formulación del proyecto.')
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Paso 4: Marco teórico y metodología ----------
  const guardarMarco = async () => {
    setErrorEnvio('')
    if (!idProyectoCreado) {
      exigirInformacionGeneralGuardada()
      return
    }

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      await proyectosApi.actualizarProyecto(idProyecto, {
        marco_teorico: datosTexto.marcoTeorico || undefined,
        metodologia_preliminar: datosTexto.metodologia || undefined,
      })

      const tareas: Promise<unknown>[] = []
      for (const referencia of datosTexto.referencias) {
        if (referencia.texto.trim()) tareas.push(proyectosApi.agregarReferenciaProyecto(idProyecto, referencia.texto.trim()))
      }

      let faltaObjetivo = false
      for (const obj of objetivosEspecificos) {
        const impacto = impactos[obj.id]
        if (!impacto || (!impacto.impactoEsperado && !impacto.beneficiarioPotencial && !impacto.indicadorVerificable)) continue
        const idObjetivoReal = objetivosCreadosIds[obj.id]
        if (!idObjetivoReal) {
          faltaObjetivo = true
          continue
        }
        tareas.push(
          proyectosApi.agregarImpactoObjetivo(idProyecto, idObjetivoReal, {
            impacto_esperado: impacto.impactoEsperado || 'No especificado',
            beneficiario_potencial: impacto.beneficiarioPotencial || undefined,
            indicador_verificable: impacto.indicadorVerificable || undefined,
          })
        )
      }
      await Promise.all(tareas)

      if (faltaObjetivo) {
        setErrorEnvio('Guarda primero "Formulación del proyecto" para poder asociar los impactos a sus objetivos.')
        setTab('formulacion')
        return
      }

      avanzarSiguienteTab()
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar Marco teórico y metodología.')
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Paso 5: Cronograma ----------
  const guardarCronograma = async () => {
    setErrorEnvio('')
    if (!idProyectoCreado) {
      exigirInformacionGeneralGuardada()
      return
    }
    if (!usuario) return

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      for (const bloque of cronogramas) {
        const periodoDelBloque = periodos[cronogramas.indexOf(bloque)]
        for (const act of bloque.actividades) {
          if (!act.actividad.trim()) continue

          const creada = await proyectosApi.agregarActividadCronograma(idProyecto, {
            responsable: usuario.id_usuario,
            actividad: act.actividad.trim(),
            resultado: act.resultado || undefined,
          })

          if (!periodoDelBloque) continue

          const mesesTareas = act.meses
            .map((marcado, i) => (marcado ? i + 1 : null))
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

      avanzarSiguienteTab()
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar el Cronograma.')
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Paso 6: Resultados esperados ----------
  const guardarResultados = async () => {
    setErrorEnvio('')
    if (!idProyectoCreado) {
      exigirInformacionGeneralGuardada()
      return
    }

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      const tiposPorId = new Map(
        categoriasProducto.flatMap((c) => c.subcategorias.flatMap((s) => s.tipos.map((t) => [t.id, t] as const)))
      )
      const tareas: Promise<unknown>[] = []
      const sinRegistrar: string[] = []
      for (const [idTipoStr, cantidadStr] of Object.entries(cantidadesProducto)) {
        const cantidad = Number(cantidadStr)
        if (cantidad <= 0) continue
        const tipo = tiposPorId.get(Number(idTipoStr))
        if (tipo?.idReal != null) {
          tareas.push(proyectosApi.agregarProductoProyecto(idProyecto, { id_tipo_producto: tipo.idReal, cantidad }))
        } else if (tipo) {
          sinRegistrar.push(tipo.nombre)
        }
      }
      await Promise.all(tareas)

      if (sinRegistrar.length > 0) {
        setErrorEnvio(
          `El proyecto se guardó, pero estos productos todavía no existen en el catálogo real y no se pudieron registrar: ${sinRegistrar.join(', ')}. El resto de la información sí quedó guardada.`
        )
      }

      avanzarSiguienteTab()
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar Resultados esperados.')
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Paso 7: Componente ético ----------
  const guardarEtico = async () => {
    setErrorEnvio('')
    if (!idProyectoCreado) {
      exigirInformacionGeneralGuardada()
      return
    }

    setEnviando(true)
    try {
      await proyectosApi.actualizarProyecto(idProyectoCreado, {
        funciones_estudiante_auxiliar: datosTexto.funcionesEstudiante || undefined,
      })

      avanzarSiguienteTab()
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar Componente ético.')
    } finally {
      setEnviando(false)
    }
  }

  // ---------- Paso 8: Firmas y anexos (último — finaliza) ----------
  const guardarFirmasYFinalizar = async () => {
    setErrorEnvio('')
    if (!idProyectoCreado) {
      exigirInformacionGeneralGuardada()
      return
    }

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      const idTipoFirmado = tiposDocumento.find((t) => t.nombre === 'Formato de proyecto firmado')?.id_tipo_documento
      const idTipoEtica = tiposDocumento.find((t) => t.nombre === 'Formato de ética')?.id_tipo_documento
      const tareasDocumentos: Promise<unknown>[] = []
      if (archivoFirmado && idTipoFirmado) tareasDocumentos.push(documentosApi.cargarDocumentoProyecto(idProyecto, idTipoFirmado, archivoFirmado))
      if (archivoEtica && idTipoEtica) tareasDocumentos.push(documentosApi.cargarDocumentoProyecto(idProyecto, idTipoEtica, archivoEtica))
      await Promise.all(tareasDocumentos)

      const principal = hojasVida[0]
      const hayDatosHojaVida = principal && Object.values(principal).some((v) => typeof v === 'string' && v.trim() !== '')
      if (hayDatosHojaVida && usuario) {
        await usuariosApi.guardarHojaVida(usuario.id_usuario, {
          lugar_nacimiento: principal.lugarFechaNacimiento || undefined,
          nacionalidad: principal.nacionalidad || undefined,
          tipo_documento: principal.tipoDocumento || undefined,
          numero_documento: principal.numeroDocumento || undefined,
          direccion: principal.direccion || undefined,
          telefono: principal.telefono || undefined,
          celular: principal.celular || undefined,
          cargo_actual: principal.cargoActual || undefined,
          cargos_desempenados: principal.cargosDesempenados || undefined,
          titulos_academicos: principal.titulosAcademicos || undefined,
          produccion_cientifica: principal.produccionCientifica || undefined,
        })
      }

      navigate('/proyectos')
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo finalizar el proyecto.')
    } finally {
      setEnviando(false)
    }
  }

  const pasosPorTab: Record<Tab, () => Promise<void>> = {
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

  return (
    <div className="crear-proyecto">
      <h1 className="crear-proyecto-title">Registra la información de tu proyecto</h1>

      <div className="crear-proyecto-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`cp-tab ${tab === t.id ? 'cp-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {errorEnvio && <p className="cp-form-error">{errorEnvio}</p>}

      <form className="crear-proyecto-form" onSubmit={(e) => e.preventDefault()}>
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
            idsUsuariosUsados={idsUsuariosUsados}
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
            dedicaciones={dedicaciones}
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
          />
        )}
        {tab === 'marco' && (
          <MarcoTeoricoMetodologia
            objetivosEspecificos={objetivosEspecificos}
            datos={datosTexto}
            setDatos={setDatosTexto}
            impactos={impactos}
            setImpactos={setImpactos}
          />
        )}
        {tab === 'cronograma' && (
          <Cronograma
            cronogramas={cronogramas}
            setCronogramas={setCronogramas}
            periodos={periodos}
            nombreResponsable={usuario ? `${usuario.nombre} ${usuario.apellido}` : ''}
          />
        )}
        {tab === 'resultados' && (
          <ResultadosEsperados
            categorias={categoriasProducto}
            cantidades={cantidadesProducto}
            setCantidades={setCantidadesProducto}
          />
        )}
        {tab === 'etico' && <ComponenteEtico datos={datosTexto} setDatos={setDatosTexto} />}
        {tab === 'firmas' && (
          <FirmasAnexos
            hojasVida={hojasVida}
            setHojasVida={setHojasVida}
            archivoFirmado={archivoFirmado}
            setArchivoFirmado={setArchivoFirmado}
            archivoEtica={archivoEtica}
            setArchivoEtica={setArchivoEtica}
          />
        )}

        <div className="crear-proyecto-actions">
          <button type="button" className="cp-save-btn" disabled={enviando} onClick={handleGuardarPasoActual}>
            <Save size={16} />
            {enviando ? 'Guardando...' : tab === 'firmas' ? 'Finalizar' : 'Guardar y continuar'}
          </button>
        </div>
      </form>

      {mostrarProyectoCreado && (
        <ConfirmModal
          mensaje="El proyecto se creó con éxito."
          botonPrimario={{ label: 'Ok', onClick: () => setMostrarProyectoCreado(false), variante: 'azul' }}
          onClose={() => setMostrarProyectoCreado(false)}
        />
      )}
    </div>
  )
}

// ---------- Pestaña: Información general ----------

interface InformacionGeneralProps {
  grupos: Bloque[]
  datos: DatosGeneral
  setDatos: React.Dispatch<React.SetStateAction<DatosGeneral>>
  modalidades: catalogosApi.CatalogoItem[]
  areas: catalogosApi.CatalogoItem[]
  tiposProyecto: catalogosApi.CatalogoItem[]
  programas: catalogosApi.ProgramaItem[]
  /** Opciones numéricas para "Duración del proyecto", derivadas de los
   * períodos activos del admin (siempre en número, aunque él los haya
   * puesto en romano). */
  opcionesDuracion: string[]
  cargando: boolean
  participantesPorGrupo: GrupoParticipantes[]
  setParticipantesPorGrupo: React.Dispatch<React.SetStateAction<GrupoParticipantes[]>>
  dedicaciones: catalogosApi.CatalogoItem[]
  rolesEstudiante: catalogosApi.CatalogoItem[]
  idsUsuariosUsados: number[]
  /** Campos vacíos detectados en el último intento de guardar — se marcan en rojo. */
  camposInvalidos: Set<CampoGeneral>
  estudiantesInvestigadores: EstudianteSlot[]
  onAddEstudianteInvestigador: () => void
  onRemoveEstudianteInvestigador: (index: number) => void
  onActualizarEstudiante: (index: number, cambios: Partial<EstudianteSlot>) => void
}

/** Fila de ORCID / Google Académico para un investigador — componente
 * aparte (no anidado dentro de InformacionGeneral) para que los inputs no
 * pierdan el foco al escribir en cada letra. */
function CamposAcademicos({
  usuario,
  perfil,
  onChange,
}: {
  usuario: usuariosApi.UsuarioBuscado | null
  perfil: PerfilAcademico
  onChange: (cambios: Partial<PerfilAcademico>) => void
}) {
  return (
    <div className="cp-field-row">
      <label>ORCID:</label>
      <input
        type="text"
        value={perfil.orcid}
        disabled={!usuario}
        onChange={(e) => onChange({ orcid: e.target.value })}
        placeholder={usuario ? '0000-0000-0000-0000' : 'Elige primero un investigador'}
      />
      <span className="cp-dedicacion-label">Google Académico:</span>
      <input
        type="text"
        className="cp-google-academico-input"
        value={perfil.googleAcademico}
        disabled={!usuario}
        onChange={(e) => onChange({ googleAcademico: e.target.value })}
        placeholder={usuario ? 'Enlace del perfil' : ''}
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
  idsUsuariosUsados,
  camposInvalidos,
  estudiantesInvestigadores,
  onAddEstudianteInvestigador,
  onRemoveEstudianteInvestigador,
  onActualizarEstudiante,
}: InformacionGeneralProps) {
  const valorTotal =
    (Number(datos.valorSolicitado) || 0) + (Number(datos.valorContrapartida) || 0)

  const getGrupoP = (grupoId: number): GrupoParticipantes =>
    participantesPorGrupo.find((g) => g.id === grupoId) ?? crearGrupoParticipantesVacio(grupoId)

  const actualizarSlot = (
    grupoId: number,
    slot: keyof Omit<GrupoParticipantes, 'id' | 'cedulaEgresado1' | 'cedulaEgresado2'>,
    cambios: Partial<SlotParticipante>
  ) => {
    setParticipantesPorGrupo(
      participantesPorGrupo.map((g) =>
        g.id === grupoId ? { ...g, [slot]: { ...g[slot], ...cambios } } : g
      )
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

  // El formulario en físico no pide Dedicación para egresados — se manda
  // "HC" fija por debajo porque la base de datos igual la exige.
  const dedicacionPorDefecto = dedicaciones.find((d) => d.nombre === 'HC')?.id_dedicacion ?? dedicaciones[0]?.id_dedicacion ?? null

  // ORCID / Google Académico van ligados al usuario elegido (no al
  // proyecto), como su cédula — pero al no existir esas columnas todavía
  // en el backend, se leen/guardan en local (lib/perfilAcademico.ts). Este
  // estado es solo para que la pantalla se actualice al escribir; lo que
  // persiste de verdad entre sesiones es localStorage.
  const [perfilesAcademicos, setPerfilesAcademicos] = useState<Record<number, PerfilAcademico>>({})

  const obtenerPerfilAcademico = (idUsuario?: number): PerfilAcademico =>
    idUsuario ? (perfilesAcademicos[idUsuario] ?? getPerfilAcademico(idUsuario)) : { orcid: '', googleAcademico: '' }

  const actualizarPerfilAcademico = (idUsuario: number, cambios: Partial<PerfilAcademico>) => {
    const nuevo = { ...obtenerPerfilAcademico(idUsuario), ...cambios }
    setPerfilAcademico(idUsuario, nuevo)
    setPerfilesAcademicos((prev) => ({ ...prev, [idUsuario]: nuevo }))
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
              <BuscadorUsuario
                value={gp.principal.usuario}
                onChange={(usuario) => actualizarSlot(grupo.id, 'principal', { usuario })}
                excluidos={idsUsuariosUsados}
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
              usuario={gp.principal.usuario}
              perfil={obtenerPerfilAcademico(gp.principal.usuario?.id_usuario)}
              onChange={(cambios) =>
                gp.principal.usuario && actualizarPerfilAcademico(gp.principal.usuario.id_usuario, cambios)
              }
            />

            <div className="cp-field-row">
              <label>Co investigador(a) UNICESMAG:</label>
              <BuscadorUsuario
                value={gp.coInvestigador.usuario}
                onChange={(usuario) => actualizarSlot(grupo.id, 'coInvestigador', { usuario })}
                excluidos={idsUsuariosUsados}
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
              usuario={gp.coInvestigador.usuario}
              perfil={obtenerPerfilAcademico(gp.coInvestigador.usuario?.id_usuario)}
              onChange={(cambios) =>
                gp.coInvestigador.usuario && actualizarPerfilAcademico(gp.coInvestigador.usuario.id_usuario, cambios)
              }
            />

            <div className="cp-field-row">
              <label>Co investigador(a) Externo(a):</label>
              <BuscadorUsuario
                value={gp.externo1.usuario}
                onChange={(usuario) => actualizarSlot(grupo.id, 'externo1', { usuario })}
                excluidos={idsUsuariosUsados}
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
              usuario={gp.externo1.usuario}
              perfil={obtenerPerfilAcademico(gp.externo1.usuario?.id_usuario)}
              onChange={(cambios) =>
                gp.externo1.usuario && actualizarPerfilAcademico(gp.externo1.usuario.id_usuario, cambios)
              }
            />

            <div className="cp-field-row">
              <label>Co investigador(a) Externo(a):</label>
              <BuscadorUsuario
                value={gp.externo2.usuario}
                onChange={(usuario) => actualizarSlot(grupo.id, 'externo2', { usuario })}
                excluidos={idsUsuariosUsados}
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
              usuario={gp.externo2.usuario}
              perfil={obtenerPerfilAcademico(gp.externo2.usuario?.id_usuario)}
              onChange={(cambios) =>
                gp.externo2.usuario && actualizarPerfilAcademico(gp.externo2.usuario.id_usuario, cambios)
              }
            />

            <div className="cp-field-row">
              <label>Co investigador(a) Egresado(a) UNICESMAG:</label>
              <BuscadorUsuario
                value={gp.egresado1.usuario}
                onChange={(usuario) =>
                  actualizarSlot(grupo.id, 'egresado1', {
                    usuario,
                    idDedicacion: usuario ? dedicacionPorDefecto : null,
                  })
                }
                excluidos={idsUsuariosUsados}
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
              <BuscadorUsuario
                value={gp.egresado2.usuario}
                onChange={(usuario) =>
                  actualizarSlot(grupo.id, 'egresado2', {
                    usuario,
                    idDedicacion: usuario ? dedicacionPorDefecto : null,
                  })
                }
                excluidos={idsUsuariosUsados}
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
                <BuscadorUsuario
                  value={est.usuario}
                  onChange={(usuario) => onActualizarEstudiante(index, { usuario })}
                  excluidos={idsUsuariosUsados}
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
        <select
          value={datos.idPrograma ?? ''}
          onChange={(e) => setDatos({ ...datos, idPrograma: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Selecciona un programa</option>
          {programas.map((p) => (
            <option key={p.id_programa} value={p.id_programa}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="cp-field-row">
        <label>Otro:</label>
        <input
          type="text"
          value={datos.programaOtro}
          onChange={(e) => setDatos({ ...datos, programaOtro: e.target.value })}
          placeholder="Escribe el programa si no aparece en la lista de arriba"
        />
      </div>

      <div className="cp-section-header">LUGAR DE EJECUCIÓN DEL PROYECTO</div>
      <div className="cp-field-row-3">
        <div className="cp-field-col">
          <label>Ciudad:</label>
          <input
            type="text"
            value={datos.ciudad}
            onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })}
            placeholder="Ej. Pasto"
          />
        </div>

        <div className="cp-field-col">
          <label>Departamento:</label>
          <input
            type="text"
            value={datos.departamento}
            onChange={(e) => setDatos({ ...datos, departamento: e.target.value })}
            placeholder="Ej. Nariño"
          />
        </div>

        <div className="cp-field-col">
          <label>Duración del proyecto (en periodos):</label>
          <DedicacionToggle
            name="duracion"
            opciones={opcionesDuracion}
            value={datos.duracion}
            onChange={(valor) => setDatos({ ...datos, duracion: valor })}
          />
        </div>
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

// ---------- Pestaña: Grupos y egresados ----------

/** Datos del grupo elegido en el dropdown — de solo lectura, ya los trae
 * el catálogo (los registró un administrador), no se vuelven a pedir. */
/** Los datos del grupo (Facultad, Líder, GrupLac...) ya NO se eligen de un
 * catálogo — se escriben a mano, igual que en el formulario en físico. */
function CamposGrupoManual({
  sel,
  esExterno,
  onCambiar,
}: {
  sel: GrupoSeleccionado
  esExterno: boolean
  onCambiar: (cambios: Partial<GrupoSeleccionado>) => void
}) {
  return (
    <>
      <div className="cp-field-row">
        <label>Nombre del Grupo:</label>
        <input type="text" value={sel.nombre} onChange={(e) => onCambiar({ nombre: e.target.value })} />
      </div>

      <div className="cp-field-row">
        <label>{esExterno ? 'Universidad / Entidad:' : 'Facultad/Departamento:'}</label>
        <input type="text" value={sel.facultad} onChange={(e) => onCambiar({ facultad: e.target.value })} />
      </div>

      <div className="cp-field-row">
        <label>{esExterno ? 'Programa Académico/Dependencia:' : 'Programa Académico:'}</label>
        <input type="text" value={sel.programa} onChange={(e) => onCambiar({ programa: e.target.value })} />
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
  dedicaciones: catalogosApi.CatalogoItem[]
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
  dedicaciones,
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

  // Se deja siempre al menos 1 — no tiene sentido un formulario sin la
  // sección de egresados.
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
            <input
              type="text"
              value={sel.odsTexto}
              onChange={(e) =>
                actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, { odsTexto: e.target.value })
              }
              placeholder="Ej. ODS 4: Educación de calidad"
            />
          </div>

          {/* ⚠️ PENDIENTE — la tabla de investigadores del grupo necesita un
              selector de usuarios reales (mismo bloqueo que en Información general). */}
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
            <input
              type="text"
              value={sel.lineaMedular}
              onChange={(e) =>
                actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, { lineaMedular: e.target.value })
              }
            />
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
            <input
              type="text"
              value={eg.facultad}
              onChange={(e) =>
                setEgresadosInfo(egresadosInfo.map((x) => (x.id === eg.id ? { ...x, facultad: e.target.value } : x)))
              }
            />
          </div>
          <div className="cp-field-row">
            <label>Programa Académico</label>
            <input
              type="text"
              value={eg.programaAcademico}
              onChange={(e) =>
                setEgresadosInfo(
                  egresadosInfo.map((x) => (x.id === eg.id ? { ...x, programaAcademico: e.target.value } : x))
                )
              }
            />
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
            { id: Date.now(), slot: slotVacio(), facultad: '', programaAcademico: '', empresa: '', horasSemanales: '' },
          ])
        }
      >
        <Plus size={14} />
        Añadir otra información de egresados
      </button>
    </div>
  )
}

// ---------- Pestaña: Formulación del proyecto ----------

interface FormulacionProyectoProps {
  objetivosEspecificos: ItemLista[]
  setObjetivosEspecificos: (items: ItemLista[]) => void
  datos: DatosTexto
  setDatos: React.Dispatch<React.SetStateAction<DatosTexto>>
}

function FormulacionProyecto({
  objetivosEspecificos,
  setObjetivosEspecificos,
  datos,
  setDatos,
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
      />

      <div className="cp-section-header">DESCRIPCIÓN DEL PROYECTO</div>

      <div className="cp-subheader">Planteamiento del problema</div>
      <TextareaConContador
        value={datos.planteamiento}
        onChange={(v) => setDatos({ ...datos, planteamiento: v })}
        claveLimite="planteamientoProblema"
        placeholder="Al menos 2 citas con sus correspondientes referencias"
      />

      <div className="cp-subheader">Pregunta de investigación</div>
      <TextareaConContador
        value={datos.pregunta}
        onChange={(v) => setDatos({ ...datos, pregunta: v })}
        claveLimite="preguntaInvestigacion"
        placeholder="Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio"
      />

      <div className="cp-subheader">Justificación</div>
      <TextareaConContador
        value={datos.justificacion}
        onChange={(v) => setDatos({ ...datos, justificacion: v })}
        claveLimite="justificacion"
      />

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
          {objetivosEspecificos.length > 1 && (
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

// ---------- Pestaña: Marco teórico y metodología ----------

interface MarcoTeoricoMetodologiaProps {
  objetivosEspecificos: ItemLista[]
  datos: DatosTexto
  setDatos: React.Dispatch<React.SetStateAction<DatosTexto>>
  impactos: Record<number, ImpactoPorObjetivo>
  setImpactos: React.Dispatch<React.SetStateAction<Record<number, ImpactoPorObjetivo>>>
}

function MarcoTeoricoMetodologia({
  objetivosEspecificos,
  datos,
  setDatos,
  impactos,
  setImpactos,
}: MarcoTeoricoMetodologiaProps) {
  const getImpacto = (id: number): ImpactoPorObjetivo =>
    impactos[id] ?? { impactoEsperado: '', beneficiarioPotencial: '', indicadorVerificable: '' }

  const actualizarImpacto = (id: number, campo: keyof ImpactoPorObjetivo, valor: string) => {
    setImpactos({
      ...impactos,
      [id]: { ...getImpacto(id), [campo]: valor },
    })
  }

  const filas: { key: keyof ImpactoPorObjetivo; label: string }[] = [
    { key: 'impactoEsperado', label: 'Impacto esperado' },
    { key: 'beneficiarioPotencial', label: 'Beneficiario potencial' },
    { key: 'indicadorVerificable', label: 'Indicador verificable' },
  ]

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
      />

      <div className="cp-section-header">METODOLOGÍA PRELIMINAR PROPUESTA</div>
      <TextareaConContador
        value={datos.metodologia}
        onChange={(v) => setDatos({ ...datos, metodologia: v })}
        claveLimite="metodologia"
        placeholder="Mencionar Paradigma, Enfoque, Método, Técnicas de recolección de información y demás aspectos pertinentes al enfoque. Además, determinar las acciones por cada objetivo específico"
      />

      <div className="cp-section-header">IMPACTO (POR CADA OBJETIVO ESPECÍFICO)</div>

      {objetivosEspecificos.length === 0 ? (
        <p className="cp-hint-text">
          Registra al menos un objetivo específico en la pestaña "Formulación del proyecto" para
          completar esta tabla.
        </p>
      ) : (
        // Igual que en la hoja: una sola tabla de 3 columnas fijas (Impacto
        // esperado / Beneficiario potencial / Indicador verificable) y una
        // fila por cada objetivo específico, hacia abajo.
        <table className="cp-impacto-table">
          <thead>
            <tr>
              {filas.map(({ key, label }) => (
                <th key={key}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {objetivosEspecificos.map((obj, index) => (
              <tr key={obj.id}>
                {filas.map(({ key }) => (
                  <td className="cp-impacto-value" key={key}>
                    <input
                      type="text"
                      value={getImpacto(obj.id)[key]}
                      onChange={(e) => actualizarImpacto(obj.id, key, e.target.value)}
                      placeholder={obj.texto || `Objetivo específico ${index + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

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

// ---------- Pestaña: Cronograma ----------

interface ActividadCronograma {
  id: number
  actividad: string
  resultado: string
  responsable: string
  anio: string
  meses: boolean[]
}

interface CronogramaBloque {
  id: number
  actividades: ActividadCronograma[]
}

function crearActividadVacia(): ActividadCronograma {
  return {
    id: Date.now() + Math.random(),
    actividad: '',
    resultado: '',
    responsable: '',
    anio: '2025',
    // Los 12 meses del año, igual que en la hoja física (INV-IC-FR v7).
    meses: Array(12).fill(false),
  }
}

interface CronogramaProps {
  cronogramas: CronogramaBloque[]
  setCronogramas: React.Dispatch<React.SetStateAction<CronogramaBloque[]>>
  periodos: catalogosApi.CatalogoItem[]
  nombreResponsable: string
}

function Cronograma({ cronogramas, setCronogramas, periodos, nombreResponsable }: CronogramaProps) {
  const addCronograma = () => {
    setCronogramas([...cronogramas, { id: Date.now(), actividades: [crearActividadVacia()] }])
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
    campo: 'actividad' | 'resultado' | 'responsable' | 'anio',
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
      {cronogramas.map((cronograma, cIndex) => (
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
          {!periodos[cIndex] && (
            <p className="cp-nota-pendiente">
              ⚠️ No hay un periodo registrado para este bloque en el catálogo — pide a un administrador que
              registre uno más antes de guardar.
            </p>
          )}

          <div className="cp-table-scroll">
          <table className="cp-cronograma-table">
            <thead>
              <tr>
                <th className="cp-col-actividad" rowSpan={2}>Actividad</th>
                <th className="cp-col-resultado" rowSpan={2}>Resultado</th>
                <th className="cp-col-responsable" rowSpan={2}>Responsable</th>
                <th colSpan={12}>
                  <div className="cp-periodo-header">
                    <span>Periodo {cIndex + 1} - Año</span>
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
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
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
                    <input type="text" value={nombreResponsable} readOnly title="Se asigna automáticamente a quien está creando el proyecto" />
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
      ))}

      <button type="button" className="cp-add-grupo cp-add-cronograma" onClick={addCronograma}>
        <Plus size={14} />
        Añadir otro cronograma
      </button>
    </div>
  )
}

// ---------- Pestaña: Resultados esperados ----------

interface ResultadosEsperadosProps {
  categorias: CategoriaProductoLocal[]
  cantidades: Record<number, string>
  setCantidades: React.Dispatch<React.SetStateAction<Record<number, string>>>
}

function BloqueCategoriaProducto({
  cat,
  cantidades,
  actualizarCantidad,
}: {
  cat: CategoriaProductoLocal
  cantidades: Record<number, string>
  actualizarCantidad: (idTipo: number, valor: string) => void
}) {
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
                // Subcategoría con un solo tipo implícito (mismo nombre) — una sola fila
                const tipo = sub.tipos[0]
                return (
                  <tr key={sub.id}>
                    <td colSpan={2}>{sub.nombre}</td>
                    <td className="cp-resultados-td-numero">
                      <input
                        type="number"
                        min={0}
                        value={cantidades[tipo.id] ?? ''}
                        onChange={(e) => actualizarCantidad(tipo.id, e.target.value)}
                      />
                    </td>
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
                      <td>{tipo.nombre}</td>
                      <td className="cp-resultados-td-numero">
                        <input
                          type="number"
                          min={0}
                          value={cantidades[tipo.id] ?? ''}
                          onChange={(e) => actualizarCantidad(tipo.id, e.target.value)}
                        />
                      </td>
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

function ResultadosEsperados({ categorias, cantidades, setCantidades }: ResultadosEsperadosProps) {
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
      {categorias.map((cat) => (
        <BloqueCategoriaProducto key={cat.id} cat={cat} cantidades={cantidades} actualizarCantidad={actualizarCantidad} />
      ))}
    </div>
  )
}

// ---------- Pestaña: Componente ético ----------

function ComponenteEtico({ datos, setDatos }: { datos: DatosTexto; setDatos: React.Dispatch<React.SetStateAction<DatosTexto>> }) {
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

      <div className="cp-section-header">Funciones del estudiante auxiliar o asistente en la investigación</div>
      <TextareaConContador
        value={datos.funcionesEstudiante}
        onChange={(v) => setDatos({ ...datos, funcionesEstudiante: v })}
        claveLimite="funcionesEstudiante"
      />
    </div>
  )
}

// ---------- Pestaña: Firmas y anexos ----------

export interface HojaDeVida {
  id: number
  nombres: string
  apellidos: string
  lugarFechaNacimiento: string
  nacionalidad: string
  tipoDocumento: string
  numeroDocumento: string
  direccion: string
  correo: string
  telefono: string
  celular: string
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
    lugarFechaNacimiento: '',
    nacionalidad: '',
    tipoDocumento: '',
    numeroDocumento: '',
    direccion: '',
    correo: '',
    telefono: '',
    celular: '',
    cargoActual: '',
    cargosDesempenados: '',
    titulosAcademicos: '',
    produccionCientifica: '',
  }
}

interface FirmasAnexosProps {
  hojasVida: HojaDeVida[]
  setHojasVida: React.Dispatch<React.SetStateAction<HojaDeVida[]>>
  archivoFirmado: File | null
  setArchivoFirmado: (f: File | null) => void
  archivoEtica: File | null
  setArchivoEtica: (f: File | null) => void
}

function FirmasAnexos({
  hojasVida,
  setHojasVida,
  archivoFirmado,
  setArchivoFirmado,
  archivoEtica,
  setArchivoEtica,
}: FirmasAnexosProps) {
  const inputFirmadoRef = useRef<HTMLInputElement>(null)
  const inputEticaRef = useRef<HTMLInputElement>(null)

  const actualizarHoja = (id: number, campo: keyof HojaDeVida, valor: string) => {
    setHojasVida(hojasVida.map((h) => (h.id === id ? { ...h, [campo]: valor } : h)))
  }

  const addHojaVida = () => {
    setHojasVida([...hojasVida, crearHojaVidaVacia()])
  }

  // La primera ficha (índice 0) es la del investigador(a) principal — se
  // guarda en el propio perfil y no se puede quitar. Solo las fichas de
  // co-investigador(a) que se van añadiendo se pueden quitar.
  const quitarHojaVida = (id: number) => {
    setHojasVida(hojasVida.filter((h) => h.id !== id))
  }

  const handleDescargarFormato = () => {
    console.log('Descargar plantilla de proyecto — pendiente de un archivo real que enlazar')
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
              value={hoja.nombres}
              onChange={(e) => actualizarHoja(hoja.id, 'nombres', e.target.value)}
            />
          </div>
          <div className="cp-field-row">
            <label>Apellidos</label>
            <input
              type="text"
              value={hoja.apellidos}
              onChange={(e) => actualizarHoja(hoja.id, 'apellidos', e.target.value)}
            />
          </div>

          <div className="cp-field-row-4">
            <div className="cp-field-col">
              <label>Lugar y fecha de Nacimiento</label>
              <input
                type="text"
                value={hoja.lugarFechaNacimiento}
                onChange={(e) => actualizarHoja(hoja.id, 'lugarFechaNacimiento', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Nacionalidad</label>
              <input
                type="text"
                value={hoja.nacionalidad}
                onChange={(e) => actualizarHoja(hoja.id, 'nacionalidad', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Tipo documento de identidad</label>
              <input
                type="text"
                value={hoja.tipoDocumento}
                onChange={(e) => actualizarHoja(hoja.id, 'tipoDocumento', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>No. Documento de identidad</label>
              <input
                type="text"
                value={hoja.numeroDocumento}
                onChange={(e) => actualizarHoja(hoja.id, 'numeroDocumento', e.target.value)}
              />
            </div>
          </div>

          <div className="cp-field-row-4">
            <div className="cp-field-col">
              <label>Dirección de residencia</label>
              <input
                type="text"
                value={hoja.direccion}
                onChange={(e) => actualizarHoja(hoja.id, 'direccion', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Correo electrónico</label>
              <input
                type="text"
                value={hoja.correo}
                onChange={(e) => actualizarHoja(hoja.id, 'correo', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Teléfono</label>
              <input
                type="text"
                value={hoja.telefono}
                onChange={(e) => actualizarHoja(hoja.id, 'telefono', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Celular</label>
              <input
                type="text"
                value={hoja.celular}
                onChange={(e) => actualizarHoja(hoja.id, 'celular', e.target.value)}
              />
            </div>
          </div>

          <div className="cp-subheader">Cargo actual</div>
          <textarea
            className="cp-textarea"
            value={hoja.cargoActual}
            onChange={(e) => actualizarHoja(hoja.id, 'cargoActual', e.target.value)}
          />

          <div className="cp-subheader">Cargos desempeñados</div>
          <textarea
            className="cp-textarea"
            value={hoja.cargosDesempenados}
            onChange={(e) => actualizarHoja(hoja.id, 'cargosDesempenados', e.target.value)}
          />

          <div className="cp-subheader">Títulos académicos obtenidos (área, disciplina, universidad, año)</div>
          <textarea
            className="cp-textarea"
            value={hoja.titulosAcademicos}
            onChange={(e) => actualizarHoja(hoja.id, 'titulosAcademicos', e.target.value)}
          />

          <div className="cp-subheader">
            Producción científica y académica (las 5 más importantes en los últimos 5 años)
          </div>
          <textarea
            className="cp-textarea"
            value={hoja.produccionCientifica}
            onChange={(e) => actualizarHoja(hoja.id, 'produccionCientifica', e.target.value)}
          />
        </div>
      ))}

      <button type="button" className="cp-add-grupo" onClick={addHojaVida}>
        <Plus size={14} />
        Añadir otra información co-investigador(a)
      </button>

      <div className="cp-section-header">PROYECTO EN FORMATO</div>
      <button type="button" className="cp-descargar-btn" onClick={handleDescargarFormato}>
        <Download size={16} />
        Descargar
      </button>

      <div className="cp-section-header">Cargue de documentos</div>

      <div className="cp-documentos-table">
        <div className="cp-documentos-row">
          <span>Formato de proyecto firmado</span>
          <button type="button" className="cp-cargar-btn" onClick={() => inputFirmadoRef.current?.click()}>
            <Upload size={14} />
            {archivoFirmado ? archivoFirmado.name : 'Cargar'}
          </button>
          <input
            ref={inputFirmadoRef}
            type="file"
            className="cp-file-input"
            onChange={(e) => setArchivoFirmado(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="cp-documentos-row">
          <span>Formato de ética</span>
          <button type="button" className="cp-cargar-btn" onClick={() => inputEticaRef.current?.click()}>
            <Upload size={14} />
            {archivoEtica ? archivoEtica.name : 'Cargar'}
          </button>
          <input
            ref={inputEticaRef}
            type="file"
            className="cp-file-input"
            onChange={(e) => setArchivoEtica(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <p className="cp-hint-text">Adicionar los formatos vigentes para la convocatoria</p>
    </div>
  )
}

// ---------- Subcomponentes reutilizables ----------

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
}: {
  name: string
  opciones: string[]
  value?: string
  onChange?: (valor: string) => void
}) {
  const controlado = onChange !== undefined
  return (
    <div className="cp-toggle-group">
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

  // A diferencia de los grupos/estudiantes, esta lista sí puede quedar en
  // cero filas si se quitan todas — arranca con una fila por defecto para
  // que no se vea vacía, pero no hay mínimo obligatorio.
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
  /** Clave del límite en lib/limitesTexto.ts — el máximo se cuenta en
   * palabras (como pide la hoja física), no en caracteres. */
  claveLimite: ClaveLimiteTexto
  placeholder?: string
  /** Para encajar en layouts que le dan flex/ancho al recuadro directamente
   * (p. ej. "Objetivos específicos" numerados). */
  claseWrapper?: string
}

function TextareaConContador({ value, onChange, claveLimite, placeholder, claseWrapper }: TextareaConContadorProps) {
  const maxPalabras = getLimite(claveLimite)
  const palabras = contarPalabras(value)
  const excedido = palabras > maxPalabras

  const manejarCambio = (nuevoValor: string) => {
    // Deja borrar/editar libremente; solo bloquea el cambio si agrega
    // palabras por encima del límite.
    const nuevasPalabras = contarPalabras(nuevoValor)
    if (nuevasPalabras > maxPalabras && nuevasPalabras > palabras) return
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
        {palabras}/{maxPalabras} palabras
      </span>
    </div>
  )
}

export default CrearProyecto