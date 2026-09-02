import { useRef, useState, useEffect } from 'react'
import { Save, Plus, Download, Upload } from 'lucide-react'
import './CrearProyecto.css'
import { useNavigate } from 'react-router-dom'
import * as convocatoriasApi from '../api/convocatorias'
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
  idGrupo: number | null
  idLinea: number | null // solo aplica a grupos CESMAG
  idOds: number | null // solo aplica a grupos CESMAG (obligatorio)
  investigadoresExtra: SlotParticipante[]
}

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
  estudiante: SlotParticipante
  idRolEstudiante: number | null // Auxiliar / Asistente
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
  estudiante: slotVacio(),
  idRolEstudiante: null,
})

function CrearProyecto() {
  const [tab, setTab] = useState<Tab>('general')
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [grupos, setGrupos] = useState<Bloque[]>([{ id: 1 }])
  const [participantesPorGrupo, setParticipantesPorGrupo] = useState<GrupoParticipantes[]>([
    crearGrupoParticipantesVacio(1),
  ])

  const [objetivosEspecificos, setObjetivosEspecificos] = useState<ItemLista[]>([
    { id: 1, texto: '' },
  ])
  const [datosTexto, setDatosTexto] = useState<DatosTexto>(datosTextoIniciales)
  const [impactos, setImpactos] = useState<Record<number, ImpactoPorObjetivo>>({})
  const [gruposCesmagSel, setGruposCesmagSel] = useState<GrupoSeleccionado[]>([
    { id: 1, idGrupo: null, idLinea: null, idOds: null, investigadoresExtra: [] },
  ])
  const [gruposExternosSel, setGruposExternosSel] = useState<GrupoSeleccionado[]>([
    { id: 1, idGrupo: null, idLinea: null, idOds: null, investigadoresExtra: [] },
  ])
  const [cronogramas, setCronogramas] = useState<CronogramaBloque[]>([
    { id: 1, actividades: [crearActividadVacia()] },
  ])
  const [egresadosInfo, setEgresadosInfo] = useState<EgresadoInfo[]>([])
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
  const [gruposDisponibles, setGruposDisponibles] = useState<gruposApi.GrupoInvestigacionItem[]>([])
  const [dedicaciones, setDedicaciones] = useState<catalogosApi.CatalogoItem[]>([])
  const [rolesProyecto, setRolesProyecto] = useState<catalogosApi.CatalogoItem[]>([])
  const [rolesEstudiante, setRolesEstudiante] = useState<catalogosApi.CatalogoItem[]>([])
  const [categoriasProducto, setCategoriasProducto] = useState<productosApi.CategoriaProductoItem[]>([])
  const [cantidadesProducto, setCantidadesProducto] = useState<Record<number, string>>({})
  const [periodos, setPeriodos] = useState<catalogosApi.CatalogoItem[]>([])
  const [idConvocatoriaActiva, setIdConvocatoriaActiva] = useState<number | null>(null)
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)
  const [errorEnvio, setErrorEnvio] = useState('')
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
        const [modalidadesRes, areasRes, tiposRes, programasRes, lineasRes, odsRes, gruposRes, dedicacionesRes, rolesProyectoRes, rolesEstudianteRes, periodosRes, categoriasProductoRes, tiposDocumentoRes, convocatoriasRes] = await Promise.all([
          catalogosApi.listarModalidadesProyecto(),
          catalogosApi.listarAreasConocimiento(),
          catalogosApi.listarTiposProyecto(),
          catalogosApi.listarProgramas(),
          catalogosApi.listarLineasInvestigacion(),
          catalogosApi.listarOds(),
          gruposApi.listarGrupos(),
          catalogosApi.listarDedicaciones(),
          catalogosApi.listarRolesProyecto(),
          catalogosApi.listarRolesEstudiante(),
          catalogosApi.listarPeriodos(),
          productosApi.listarCategoriasProducto(),
          tiposDocumentoApi.listarTiposDocumento(),
          convocatoriasApi.listarConvocatorias(),
        ])
        setModalidades(modalidadesRes)
        setAreas(areasRes)
        setTiposProyecto(tiposRes)
        setProgramas(programasRes)
        setLineasInvestigacion(lineasRes)
        setOds(odsRes)
        setGruposDisponibles(gruposRes)
        setDedicaciones(dedicacionesRes)
        setRolesProyecto(rolesProyectoRes)
        setRolesEstudiante(rolesEstudianteRes)
        setPeriodos(periodosRes)
        setCategoriasProducto(categoriasProductoRes)
        setTiposDocumento(tiposDocumentoRes)

        const activa = convocatoriasRes.find((c) => c.estado === 'activa')
        setIdConvocatoriaActiva(activa ? activa.id_convocatoria : null)
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
  const idsUsuariosUsados: number[] = [
    ...participantesPorGrupo.flatMap((gp) =>
      [gp.principal, gp.coInvestigador, gp.externo1, gp.externo2, gp.egresado1, gp.egresado2, gp.estudiante].map(
        (slot) => slot.usuario?.id_usuario
      )
    ),
    ...gruposCesmagSel.flatMap((g) => g.investigadoresExtra.map((slot) => slot.usuario?.id_usuario)),
    ...gruposExternosSel.flatMap((g) => g.investigadoresExtra.map((slot) => slot.usuario?.id_usuario)),
    ...egresadosInfo.map((eg) => eg.slot.usuario?.id_usuario),
  ].filter((id): id is number => id !== undefined)

  const handleAddGrupo = () => {
    if (grupos.length >= 3) return
    const nuevoId = Date.now()
    setGrupos([...grupos, { id: nuevoId }])
    setParticipantesPorGrupo([...participantesPorGrupo, crearGrupoParticipantesVacio(nuevoId)])
  }

  const idRolPorNombre = (nombre: string) => rolesProyecto.find((r) => r.nombre === nombre)?.id_rol_pro

  const guardarParticipantesDeGrupo = (idProyecto: number, gp: GrupoParticipantes): Promise<unknown>[] => {
    const idPrincipal = idRolPorNombre('Investigador(a) Principal UNICESMAG')
    const idCoInvestigador = idRolPorNombre('Co investigador(a) UNICESMAG')
    const idExterno = idRolPorNombre('Co investigador(a) Externo(a)')
    const idEgresado = idRolPorNombre('Co investigador(a) Egresado(a) UNICESMAG')
    const idEstudianteRol = idRolPorNombre('Estudiante Investigador(a)')

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
    if (gp.estudiante.usuario && gp.estudiante.idDedicacion && idEstudianteRol && gp.idRolEstudiante) {
      tareas.push(
        proyectosApi.agregarParticipanteProyecto(idProyecto, {
          participante: gp.estudiante.usuario.id_usuario,
          id_dedicacion: gp.estudiante.idDedicacion,
          id_rol_pro: idEstudianteRol,
          id_rol_estudiante: gp.idRolEstudiante,
        })
      )
    }
    return tareas
  }

  // ---------- Paso 1: Información general ----------
  const guardarInformacionGeneral = async () => {
    setErrorEnvio('')
    if (!datosGeneral.titulo.trim()) {
      setErrorEnvio('El título del proyecto es obligatorio.')
      return
    }
    if (!datosGeneral.idModalidad || !datosGeneral.idTipoProyecto) {
      setErrorEnvio('Selecciona modalidad y tipo de proyecto.')
      return
    }
    if (!idConvocatoriaActiva) {
      setErrorEnvio('No hay ninguna convocatoria activa en este momento. No se puede registrar el proyecto.')
      return
    }

    setEnviando(true)
    try {
      let idProyecto = idProyectoCreado
      if (!idProyecto) {
        const proyecto = await proyectosApi.crearProyecto({
          id_convocatoria: idConvocatoriaActiva,
          id_modalidad_proyecto: datosGeneral.idModalidad,
          id_tipo_proyecto: datosGeneral.idTipoProyecto,
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
      await Promise.all(tareas)

      avanzarSiguienteTab()
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
      setErrorEnvio('Primero guarda "Información general" — ahí se crea el proyecto.')
      setTab('general')
      return
    }
    const grupoCesmagSinOds = gruposCesmagSel.find((g) => g.idGrupo && !g.idOds)
    if (grupoCesmagSinOds) {
      setErrorEnvio('Selecciona el ODS obligatorio para cada grupo CESMAG que hayas elegido.')
      return
    }

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      const idCoInvestigador = idRolPorNombre('Co investigador(a) UNICESMAG')
      const idExterno = idRolPorNombre('Co investigador(a) Externo(a)')
      const idEgresado = idRolPorNombre('Co investigador(a) Egresado(a) UNICESMAG')
      const idDedicacionPorDefecto =
        dedicaciones.find((d) => d.nombre === 'HC')?.id_dedicacion ?? dedicaciones[0]?.id_dedicacion

      const tareas: Promise<unknown>[] = []
      for (const g of gruposCesmagSel) {
        if (g.idGrupo) {
          tareas.push(
            proyectosApi.agregarGrupoProyecto(idProyecto, {
              id_grupo: g.idGrupo,
              id_linea_investigacion: g.idLinea ?? undefined,
              id_ods: g.idOds ?? undefined,
            })
          )
        }
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
        if (g.idGrupo) tareas.push(proyectosApi.agregarGrupoProyecto(idProyecto, { id_grupo: g.idGrupo }))
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
        if (!eg.slot.usuario || !idEgresado || !idDedicacionPorDefecto) continue
        tareas.push(
          (async () => {
            const creado = await proyectosApi.agregarParticipanteProyecto(idProyecto, {
              participante: eg.slot.usuario!.id_usuario,
              id_dedicacion: idDedicacionPorDefecto,
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
      setErrorEnvio('Primero guarda "Información general" — ahí se crea el proyecto.')
      setTab('general')
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
      setErrorEnvio('Primero guarda "Información general" — ahí se crea el proyecto.')
      setTab('general')
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
      setErrorEnvio('Primero guarda "Información general" — ahí se crea el proyecto.')
      setTab('general')
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
      setErrorEnvio('Primero guarda "Información general" — ahí se crea el proyecto.')
      setTab('general')
      return
    }

    setEnviando(true)
    try {
      const idProyecto = idProyectoCreado
      const tareas: Promise<unknown>[] = []
      for (const [idTipoProductoStr, cantidadStr] of Object.entries(cantidadesProducto)) {
        const cantidad = Number(cantidadStr)
        if (cantidad > 0) {
          tareas.push(proyectosApi.agregarProductoProyecto(idProyecto, { id_tipo_producto: Number(idTipoProductoStr), cantidad }))
        }
      }
      await Promise.all(tareas)

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
      setErrorEnvio('Primero guarda "Información general" — ahí se crea el proyecto.')
      setTab('general')
      return
    }

    setEnviando(true)
    try {
      await proyectosApi.actualizarProyecto(idProyectoCreado, {
        componente_etico: datosTexto.componenteEtico || undefined,
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
      setErrorEnvio('Primero guarda "Información general" — ahí se crea el proyecto.')
      setTab('general')
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
            onAddGrupo={handleAddGrupo}
            datos={datosGeneral}
            setDatos={setDatosGeneral}
            modalidades={modalidades}
            areas={areas}
            tiposProyecto={tiposProyecto}
            programas={programas}
            cargando={cargandoCatalogos}
            participantesPorGrupo={participantesPorGrupo}
            setParticipantesPorGrupo={setParticipantesPorGrupo}
            dedicaciones={dedicaciones}
            rolesEstudiante={rolesEstudiante}
            idsUsuariosUsados={idsUsuariosUsados}
          />
        )}
        {tab === 'grupos' && (
          <GruposEgresados
            gruposDisponibles={gruposDisponibles}
            lineasInvestigacion={lineasInvestigacion}
            ods={ods}
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
          {idProyectoCreado && tab !== 'firmas' && (
            <p className="cp-hint-text">
              Ya se creó el proyecto — puedes seguir guardando pestaña por pestaña, en el orden que prefieras.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

// ---------- Pestaña: Información general ----------

interface InformacionGeneralProps {
  grupos: Bloque[]
  onAddGrupo: () => void
  datos: DatosGeneral
  setDatos: React.Dispatch<React.SetStateAction<DatosGeneral>>
  modalidades: catalogosApi.CatalogoItem[]
  areas: catalogosApi.CatalogoItem[]
  tiposProyecto: catalogosApi.CatalogoItem[]
  programas: catalogosApi.ProgramaItem[]
  cargando: boolean
  participantesPorGrupo: GrupoParticipantes[]
  setParticipantesPorGrupo: React.Dispatch<React.SetStateAction<GrupoParticipantes[]>>
  dedicaciones: catalogosApi.CatalogoItem[]
  rolesEstudiante: catalogosApi.CatalogoItem[]
  idsUsuariosUsados: number[]
}

function InformacionGeneral({
  grupos,
  onAddGrupo,
  datos,
  setDatos,
  modalidades,
  areas,
  tiposProyecto,
  programas,
  cargando,
  participantesPorGrupo,
  setParticipantesPorGrupo,
  dedicaciones,
  rolesEstudiante,
  idsUsuariosUsados,
}: InformacionGeneralProps) {
  const valorTotal =
    (Number(datos.valorSolicitado) || 0) + (Number(datos.valorContrapartida) || 0)

  const getGrupoP = (grupoId: number): GrupoParticipantes =>
    participantesPorGrupo.find((g) => g.id === grupoId) ?? crearGrupoParticipantesVacio(grupoId)

  const actualizarSlot = (
    grupoId: number,
    slot: keyof Omit<GrupoParticipantes, 'id' | 'idRolEstudiante'>,
    cambios: Partial<SlotParticipante>
  ) => {
    setParticipantesPorGrupo(
      participantesPorGrupo.map((g) =>
        g.id === grupoId ? { ...g, [slot]: { ...g[slot], ...cambios } } : g
      )
    )
  }

  const actualizarRolEstudiante = (grupoId: number, idRolEstudiante: number | null) => {
    setParticipantesPorGrupo(
      participantesPorGrupo.map((g) => (g.id === grupoId ? { ...g, idRolEstudiante } : g))
    )
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">INFORMACIÓN GENERAL DEL PROYECTO</div>

      <div className="cp-field-row">
        <label>Título del proyecto:</label>
        <input
          type="text"
          value={datos.titulo}
          onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
        />
      </div>

      {grupos.map((grupo, index) => {
        const gp = getGrupoP(grupo.id)
        return (
          <div className="cp-grupo-block" key={grupo.id}>
            {grupos.length > 1 && <p className="cp-grupo-label">Grupo {index + 1}</p>}

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

            <div className="cp-field-row">
              <label>Co investigador(a) Egresado(a) UNICESMAG:</label>
              <BuscadorUsuario
                value={gp.egresado1.usuario}
                onChange={(usuario) => actualizarSlot(grupo.id, 'egresado1', { usuario })}
                excluidos={idsUsuariosUsados}
              />
              <span className="cp-dedicacion-label">Dedicación:</span>
              <DedicacionToggle
                name={`dedicacion-egr1-${grupo.id}`}
                opciones={['TC', 'MT', 'HC']}
                value={dedicaciones.find((d) => d.id_dedicacion === gp.egresado1.idDedicacion)?.nombre}
                onChange={(nombre) =>
                  actualizarSlot(grupo.id, 'egresado1', {
                    idDedicacion: dedicaciones.find((d) => d.nombre === nombre)?.id_dedicacion ?? null,
                  })
                }
              />
            </div>

            <div className="cp-field-row">
              <label>Co investigador(a) Egresado(a) UNICESMAG:</label>
              <BuscadorUsuario
                value={gp.egresado2.usuario}
                onChange={(usuario) => actualizarSlot(grupo.id, 'egresado2', { usuario })}
                excluidos={idsUsuariosUsados}
              />
              <span className="cp-dedicacion-label">Dedicación:</span>
              <DedicacionToggle
                name={`dedicacion-egr2-${grupo.id}`}
                opciones={['TC', 'MT', 'HC']}
                value={dedicaciones.find((d) => d.id_dedicacion === gp.egresado2.idDedicacion)?.nombre}
                onChange={(nombre) =>
                  actualizarSlot(grupo.id, 'egresado2', {
                    idDedicacion: dedicaciones.find((d) => d.nombre === nombre)?.id_dedicacion ?? null,
                  })
                }
              />
            </div>

            <div className="cp-field-row">
              <label>Estudiante Investigador(a)s:</label>
              <BuscadorUsuario
                value={gp.estudiante.usuario}
                onChange={(usuario) => actualizarSlot(grupo.id, 'estudiante', { usuario })}
                excluidos={idsUsuariosUsados}
              />
              <span className="cp-dedicacion-label">Rol del estudiante:</span>
              <DedicacionToggle
                name={`tipo-estudiante-${grupo.id}`}
                opciones={['Auxiliar', 'Asistente']}
                value={
                  rolesEstudiante.find((r) => r.id_rolestudiante === gp.idRolEstudiante)?.nombre === 'auxiliar'
                    ? 'Auxiliar'
                    : rolesEstudiante.find((r) => r.id_rolestudiante === gp.idRolEstudiante)?.nombre === 'asistente'
                      ? 'Asistente'
                      : undefined
                }
                onChange={(nombre) =>
                  actualizarRolEstudiante(
                    grupo.id,
                    rolesEstudiante.find((r) => r.nombre.toLowerCase() === nombre.toLowerCase())?.id_rolestudiante ?? null
                  )
                }
              />
            </div>
          </div>
        )
      })}

      {grupos.length < 3 && (
        <button type="button" className="cp-add-grupo" onClick={onAddGrupo}>
          <Plus size={14} />
          Añadir otro grupo Estudiante investigador (máximo 3)
        </button>
      )}

      <div className="cp-section-header">MODALIDAD DEL PROYECTO</div>
      <div className="cp-radio-grid">
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
            opciones={['2', '4']}
            value={datos.duracion}
            onChange={(valor) => setDatos({ ...datos, duracion: valor })}
          />
        </div>
      </div>

      <div className="cp-section-header">TIPO DE PROYECTO</div>
      <div className="cp-radio-grid">
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

      <div className="cp-section-header">FINANCIACIÓN TOTAL SOLICITADA</div>
      <div className="cp-field-row">
        <label>Valor solicitado UNICESMAG</label>
        <input
          type="number"
          value={datos.valorSolicitado}
          onChange={(e) => setDatos({ ...datos, valorSolicitado: e.target.value })}
        />
      </div>
      <div className="cp-field-row">
        <label>Valor contrapartida</label>
        <input
          type="number"
          value={datos.valorContrapartida}
          onChange={(e) => setDatos({ ...datos, valorContrapartida: e.target.value })}
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

interface GruposEgresadosProps {
  gruposDisponibles: gruposApi.GrupoInvestigacionItem[]
  lineasInvestigacion: catalogosApi.CatalogoItem[]
  ods: catalogosApi.CatalogoItem[]
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
  gruposDisponibles,
  lineasInvestigacion,
  ods,
  dedicaciones,
  gruposCesmagSel,
  setGruposCesmagSel,
  gruposExternosSel,
  setGruposExternosSel,
  egresadosInfo,
  setEgresadosInfo,
  idsUsuariosUsados,
}: GruposEgresadosProps) {
  const gruposCesmag = gruposDisponibles.filter((g) => g.tipoGrupo.nombre === 'interno')
  const gruposExternosDisp = gruposDisponibles.filter((g) => g.tipoGrupo.nombre === 'externo')

  const actualizarSel = (
    lista: GrupoSeleccionado[],
    setLista: React.Dispatch<React.SetStateAction<GrupoSeleccionado[]>>,
    id: number,
    cambios: Partial<GrupoSeleccionado>
  ) => {
    setLista(lista.map((g) => (g.id === id ? { ...g, ...cambios } : g)))
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">
        GRUPO DE INVESTIGACIÓN AL CUAL ESTÁ ADSCRITO EL PROYECTO EN UNICESMAG
      </div>
      <p className="cp-hint-text">
        Selecciona un grupo ya registrado en la institución. Si el grupo que necesitas no aparece,
        pide a un administrador que lo registre primero en el catálogo.
      </p>

      {gruposCesmagSel.map((sel, index) => (
        <div className="cp-grupo-block" key={sel.id}>
          {gruposCesmagSel.length > 1 && <p className="cp-grupo-label">Grupo CESMAG {index + 1}</p>}

          <div className="cp-field-row">
            <label>Grupo de investigación:</label>
            <select
              value={sel.idGrupo ?? ''}
              onChange={(e) =>
                actualizarSel(gruposCesmagSel, setGruposCesmagSel, sel.id, {
                  idGrupo: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Selecciona un grupo</option>
              {gruposCesmag.map((g) => (
                <option key={g.id_grupo} value={g.id_grupo}>
                  {g.nombre} {g.lider_grupo ? `— líder: ${g.lider_grupo}` : ''}
                </option>
              ))}
            </select>
          </div>

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
              <option value="">Selecciona una ODS</option>
              {ods.map((o) => (
                <option key={o.id_ods} value={o.id_ods}>
                  {o.nombre}
                </option>
              ))}
            </select>
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

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() =>
          setGruposCesmagSel([...gruposCesmagSel, { id: Date.now(), idGrupo: null, idLinea: null, idOds: null, investigadoresExtra: [] }])
        }
      >
        <Plus size={14} />
        Añadir otro grupo de investigación CESMAG
      </button>

      <div className="cp-section-header">GRUPO DE INVESTIGACIÓN EXTERNO</div>

      {gruposExternosSel.map((sel, index) => (
        <div className="cp-grupo-block" key={sel.id}>
          {gruposExternosSel.length > 1 && <p className="cp-grupo-label">Grupo externo {index + 1}</p>}

          <div className="cp-field-row">
            <label>Grupo de investigación externo:</label>
            <select
              value={sel.idGrupo ?? ''}
              onChange={(e) =>
                actualizarSel(gruposExternosSel, setGruposExternosSel, sel.id, {
                  idGrupo: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Selecciona un grupo</option>
              {gruposExternosDisp.map((g) => (
                <option key={g.id_grupo} value={g.id_grupo}>
                  {g.nombre} {g.lider_grupo ? `— líder: ${g.lider_grupo}` : ''}
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

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() =>
          setGruposExternosSel([...gruposExternosSel, { id: Date.now(), idGrupo: null, idLinea: null, idOds: null, investigadoresExtra: [] }])
        }
      >
        <Plus size={14} />
        Añadir otro grupo de investigación externo
      </button>

      <div className="cp-section-header">INFORMACIÓN GENERAL DE EGRESADOS(AS)</div>

      {egresadosInfo.map((eg, index) => (
        <div className="cp-grupo-block" key={eg.id}>
          {egresadosInfo.length > 1 && <p className="cp-grupo-label">Egresado(a) {index + 1}</p>}

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
        maxLength={300}
      />

      <div className="cp-section-header">DESCRIPCIÓN DEL PROYECTO</div>

      <div className="cp-subheader">Planteamiento del problema</div>
      <TextareaConContador
        value={datos.planteamiento}
        onChange={(v) => setDatos({ ...datos, planteamiento: v })}
        maxLength={600}
        placeholder="Al menos 2 citas con sus correspondientes referencias"
      />

      <div className="cp-subheader">Pregunta de investigación</div>
      <textarea
        className="cp-textarea"
        value={datos.pregunta}
        onChange={(e) => setDatos({ ...datos, pregunta: e.target.value })}
        placeholder="Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio"
      />

      <div className="cp-subheader">Justificación</div>
      <TextareaConContador
        value={datos.justificacion}
        onChange={(v) => setDatos({ ...datos, justificacion: v })}
        maxLength={500}
      />

      <div className="cp-subheader">Objetivo general</div>
      <textarea
        className="cp-textarea"
        value={datos.objetivoGeneral}
        onChange={(e) => setDatos({ ...datos, objetivoGeneral: e.target.value })}
      />

      <div className="cp-subheader">Objetivos específicos</div>
      {objetivosEspecificos.map((item, index) => (
        <div className="cp-numbered-item" key={item.id}>
          <span className="cp-numbered-index">{index + 1}.</span>
          <textarea
            className="cp-textarea cp-textarea-numbered"
            value={item.texto}
            onChange={(e) =>
              actualizarItem(objetivosEspecificos, setObjetivosEspecificos, item.id, e.target.value)
            }
          />
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
        <textarea
          key={item.id}
          className="cp-textarea"
          value={item.texto}
          onChange={(e) =>
            setDatos({
              ...datos,
              antecedentes: datos.antecedentes.map((a) => (a.id === item.id ? { ...a, texto: e.target.value } : a)),
            })
          }
          placeholder="Preferiblemente de los últimos 5 años"
        />
      ))}
      {datos.antecedentes.length < 5 && (
        <button
          type="button"
          className="cp-add-grupo"
          onClick={() =>
            setDatos({ ...datos, antecedentes: [...datos.antecedentes, { id: Date.now(), texto: '' }] })
          }
        >
          <Plus size={14} />
          Añadir otro antecedente máx(5)
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
        maxLength={2000}
        placeholder="Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio"
      />

      <div className="cp-section-header">METODOLOGÍA PRELIMINAR PROPUESTA</div>
      <textarea
        className="cp-textarea"
        value={datos.metodologia}
        onChange={(e) => setDatos({ ...datos, metodologia: e.target.value })}
        placeholder="Mencionar Paradigma, Enfoque, Método, Técnicas de recolección de información y demás aspectos pertinentes al enfoque. Además, determinar las acciones por cada objetivo específico"
      />

      <div className="cp-section-header">IMPACTO (POR CADA OBJETIVO ESPECÍFICO)</div>

      {objetivosEspecificos.length === 0 ? (
        <p className="cp-hint-text">
          Registra al menos un objetivo específico en la pestaña "Formulación del proyecto" para
          completar esta tabla.
        </p>
      ) : (
        <table className="cp-impacto-table">
          <tbody>
            {filas.map(({ key, label }) => (
              <tr key={key}>
                <td className="cp-impacto-label" rowSpan={objetivosEspecificos.length}>
                  {label}
                </td>
                {objetivosEspecificos.map((obj, index) => (
                  <td className="cp-impacto-value" key={obj.id}>
                    <span className="cp-impacto-ob-tag">OB. E. {index + 1}</span>
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
        <textarea
          key={item.id}
          className="cp-textarea"
          value={item.texto}
          onChange={(e) =>
            setDatos({
              ...datos,
              referencias: datos.referencias.map((r) => (r.id === item.id ? { ...r, texto: e.target.value } : r)),
            })
          }
          placeholder="Ej. Apellido, A. (Año). Título del trabajo. Editorial/Revista."
        />
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
    meses: [false, false, false, false, false, false],
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
          <div className="cp-section-header">CRONOGRAMA DE ACTIVIDADES</div>
          {periodos[cIndex] ? (
            <p className="cp-hint-text">Este bloque se guardará bajo: {periodos[cIndex].nombre}</p>
          ) : (
            <p className="cp-nota-pendiente">
              ⚠️ No hay un periodo registrado para este bloque en el catálogo — pide a un administrador que
              registre uno más antes de guardar.
            </p>
          )}

          <table className="cp-cronograma-table">
            <thead>
              <tr>
                <th rowSpan={2}>Actividad</th>
                <th rowSpan={2}>Resultado</th>
                <th rowSpan={2}>Responsable</th>
                <th colSpan={6}>
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
              </tr>
              <tr>
                {[1, 2, 3, 4, 5, 6].map((mes) => (
                  <th key={mes} className="cp-mes-header">{mes}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {cronograma.actividades.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="text"
                      value={a.actividad}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'actividad', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={a.resultado}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'resultado', e.target.value)}
                    />
                  </td>
                  <td>
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
                </tr>
              ))}
            </tbody>
          </table>

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
  categorias: productosApi.CategoriaProductoItem[]
  cantidades: Record<number, string>
  setCantidades: React.Dispatch<React.SetStateAction<Record<number, string>>>
}

// Subtítulo de cada categoría (según el documento institucional original —
// no viene del backend, es texto fijo del formato de convocatoria).
const SUBTITULO_POR_CATEGORIA: Record<string, string> = {
  'Generación de nuevo conocimiento': '(Selección obligatoria)',
  'Formación de Recurso Humano en CTeI': '(Selección obligatoria)',
  'Desarrollo tecnológico e innovación': '(Selección opcional)',
  'Apropiación social del conocimiento': '(Selección Opcional)',
}

// Nota aclaratoria bajo una subcategoría específica (también del formato original).
const NOTA_POR_SUBCATEGORIA: Record<string, string> = {
  'Artículos de investigación':
    'Nota: Se sugiere que la categorización de la revista esté asociada a un cuartil Q1, Q2, Q3 o Q4 de JCR o SJR.',
}

function ResultadosEsperados({ categorias, cantidades, setCantidades }: ResultadosEsperadosProps) {
  const actualizarCantidad = (idTipoProducto: number, valor: string) => {
    setCantidades({ ...cantidades, [idTipoProducto]: valor })
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
        <div key={cat.id_categoria}>
          <div className="cp-section-header cp-resultados-header">
            {cat.nombre}
            {SUBTITULO_POR_CATEGORIA[cat.nombre] && (
              <span className="cp-resultados-subtitulo">{SUBTITULO_POR_CATEGORIA[cat.nombre]}</span>
            )}
          </div>

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
                    <tr key={sub.id_subcategoria}>
                      <td colSpan={2}>{sub.nombre}</td>
                      <td className="cp-resultados-td-numero">
                        <input
                          type="number"
                          min={0}
                          value={cantidades[tipo.id_tipo_producto] ?? ''}
                          onChange={(e) => actualizarCantidad(tipo.id_tipo_producto, e.target.value)}
                        />
                      </td>
                    </tr>
                  )
                }

                return (
                  <>
                    {sub.tipos.map((tipo, index) => (
                      <tr key={tipo.id_tipo_producto}>
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
                            value={cantidades[tipo.id_tipo_producto] ?? ''}
                            onChange={(e) => actualizarCantidad(tipo.id_tipo_producto, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                    {NOTA_POR_SUBCATEGORIA[sub.nombre] && (
                      <tr key={`${sub.id_subcategoria}-nota`}>
                        <td colSpan={3} className="cp-resultados-nota">
                          {NOTA_POR_SUBCATEGORIA[sub.nombre]}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
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

      <div className="cp-section-header">Descripción del componente ético</div>
      <TextareaConContador
        value={datos.componenteEtico}
        onChange={(v) => setDatos({ ...datos, componenteEtico: v })}
        maxLength={800}
        placeholder="Describe si el proyecto usa consentimiento/asentimiento informado, los riesgos identificados para las personas o el medio ambiente, y cómo se van a mitigar"
      />

      <div className="cp-section-header">Funciones del estudiante auxiliar o asistente en la investigación</div>
      <TextareaConContador
        value={datos.funcionesEstudiante}
        onChange={(v) => setDatos({ ...datos, funcionesEstudiante: v })}
        maxLength={500}
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
          <div className="cp-section-header cp-hv-header">HOJA DE VIDA (Resumen)</div>
          <div className="cp-subheader">
            {index === 0 ? 'Información investigador(a) principal' : 'Información co-investigador(a)'}
          </div>
          {index === 0 && (
            <p className="cp-hint-text">
              Esta ficha (la primera) se guarda en tu propio perfil al hacer clic en "Guardar y continuar".
            </p>
          )}

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
              <label>Dirección</label>
              <input
                type="text"
                value={hoja.direccion}
                onChange={(e) => actualizarHoja(hoja.id, 'direccion', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Correo</label>
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

  return (
    <div className="cp-mini-table">
      <div className="cp-mini-table-header">
        <span>Investigadores del proyecto</span>
        <span>Dedicación</span>
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
  maxLength: number
  placeholder?: string
}

function TextareaConContador({ value, onChange, maxLength, placeholder }: TextareaConContadorProps) {
  return (
    <div className="cp-textarea-wrapper">
      <textarea
        className="cp-textarea"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="cp-char-count">
        {value.length}/{maxLength}
      </span>
    </div>
  )
}

export default CrearProyecto