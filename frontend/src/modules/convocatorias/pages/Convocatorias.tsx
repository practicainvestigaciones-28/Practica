import { useState, useEffect } from 'react'
import { FilePlus, BookPlus, Search, SquarePen, Trash2, Save, X as XIcon } from 'lucide-react'
import DateRangeCalendar, { CalendarIcon, formatearRango } from '../../../shared/components/common/DateRangeCalendar'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import * as convocatoriasApi from '../api/convocatorias'
import type { ConvocatoriaBackend } from '../api/convocatorias'
import { ApiError } from '../../../shared/api/client'
import * as catalogosApi from '../../catalogos/api/catalogos'
// "Línea medular" no tiene catálogo propio en el backend (ver nota en
// LineasInvestigacion.tsx) — sigue en localStorage. Periodos y Programas
// ya están conectados a BD real (catalogosApi), sin lib local.
import {
  getLineas as getLineasMedularesLocal,
  addLinea as addLineaMedularLocal,
  editarLinea as editarLineaMedularLocal,
  eliminarLinea as eliminarLineaMedularLocal,
  toggleLineaActiva as toggleLineaMedularLocal,
  type Linea as LineaMedularLocal,
} from '../lib/lineasInvestigacion'
import {
  getLimites,
  setLimite,
  getLimiteAntecedentes,
  setLimiteAntecedentes,
  type LimiteTextoInfo,
  type ClaveLimiteTexto,
} from '../../proyectos/lib/limitesTexto'
import './Convocatorias.css'
import './ProgramasAcademicos.css'
import './LineasInvestigacion.css'
import './AreaConocimiento.css'
import './ModalidadTipoProyecto.css'
import './LimitesTexto.css'
import './Ods.css'
import ResultadosEsperadosTab from '../components/ResultadosEsperadosTab'

interface Convocatoria {
  id: number
  nombre: string
  activa: boolean
  proyectos: number
  vigenciaInicio: Date | null
  vigenciaFin: Date | null
}

function mapearConvocatoria(c: ConvocatoriaBackend): Convocatoria {
  return {
    id: c.id_convocatoria,
    nombre: c.nombre,
    activa: c.estado === 'activa',
    proyectos: c._count?.proyectos ?? 0,
    vigenciaInicio: new Date(c.fecha_inicio),
    vigenciaFin: new Date(c.fecha_fin),
  }
}

type TipoPrograma = 'pregrado' | 'posgrado'
type CategoriaLinea = 'investigacion' | 'medular'

// Fila unificada de la pestaña "Líneas": "investigación" viene de BD real,
// "medular" sigue en localStorage (ver nota junto a los imports).
interface FilaLinea {
  id: number
  nombre: string
  activa: boolean
}

const textosLinea: Record<CategoriaLinea, {
  tab: string
  addBtn: string
  buscarPlaceholder: string
  modalTituloCrear: string
  modalTituloEditar: string
  campoLabel: string
  exitoMensaje: string
}> = {
  investigacion: {
    tab: 'Línea de investigación',
    addBtn: 'Añadir línea de investigación',
    buscarPlaceholder: 'Buscar línea',
    modalTituloCrear: 'Registrar línea de investigación',
    modalTituloEditar: 'Editar línea de investigación',
    campoLabel: 'Nombre de la línea de investigación:',
    exitoMensaje: 'Registro de línea de investigación exitoso.',
  },
  medular: {
    tab: 'Línea medular',
    addBtn: 'Añadir línea medular de investigación',
    buscarPlaceholder: 'Buscar línea medular',
    modalTituloCrear: 'Registrar línea medular',
    modalTituloEditar: 'Editar línea medular',
    campoLabel: 'Nombre de la línea medular:',
    exitoMensaje: 'Registro de línea medular investigación exitoso.',
  },
}

type Tab = 'convocatorias' | 'periodos' | 'programas' | 'lineas' | 'areas' | 'modalidad' | 'limites' | 'ods' | 'resultados'
type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

type CategoriaModalidadTipo = 'modalidad' | 'tipo'

const textosMt: Record<CategoriaModalidadTipo, {
  tab: string
  addBtn: string
  buscarPlaceholder: string
  modalTituloCrear: string
  modalTituloEditar: string
  campoLabel: string
  exitoMensaje: string
}> = {
  modalidad: {
    tab: 'Modalidad de proyecto',
    addBtn: 'Añadir modalidad',
    buscarPlaceholder: 'Buscar modalidad de proyecto',
    modalTituloCrear: 'Registrar modalidad',
    modalTituloEditar: 'Editar modalidad',
    campoLabel: 'Nombre de la modalidad del proyecto:',
    exitoMensaje: 'Registro de modalidad exitoso.',
  },
  tipo: {
    tab: 'Tipo de proyecto',
    addBtn: 'Añadir proyecto',
    buscarPlaceholder: 'Buscar proyecto',
    modalTituloCrear: 'Registrar proyecto',
    modalTituloEditar: 'Editar proyecto',
    campoLabel: 'Nombre del proyecto:',
    exitoMensaje: 'Registro de proyecto exitoso.',
  },
}

function Convocatorias() {
  const [tab, setTab] = useState<Tab>('convocatorias')
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [vigenciaInicio, setVigenciaInicio] = useState<Date | null>(null)
  const [vigenciaFin, setVigenciaFin] = useState<Date | null>(null)
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFin, setHoraFin] = useState('23:59')
  const [modal, setModal] = useState<ModalTipo>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const [periodos, setPeriodos] = useState<catalogosApi.PeriodoItem[]>([])
  const [cargandoPeriodos, setCargandoPeriodos] = useState(true)
  const [busquedaPeriodo, setBusquedaPeriodo] = useState('')
  const [periodoModoFormulario, setPeriodoModoFormulario] = useState<ModoFormulario>(null)
  const [periodoEditandoId, setPeriodoEditandoId] = useState<number | null>(null)
  const [periodoNombreForm, setPeriodoNombreForm] = useState('')
  const [periodoModal, setPeriodoModal] = useState<ModalTipo>(null)
  const [periodoGuardando, setPeriodoGuardando] = useState(false)
  const [eliminarPeriodoId, setEliminarPeriodoId] = useState<number | null>(null)

  const [progSubTab, setProgSubTab] = useState<TipoPrograma>('pregrado')
  const [progItems, setProgItems] = useState<catalogosApi.ProgramaItem[]>([])
  const [cargandoProgramas, setCargandoProgramas] = useState(true)
  const [busquedaPrograma, setBusquedaPrograma] = useState('')
  const [progModoFormulario, setProgModoFormulario] = useState<ModoFormulario>(null)
  const [progEditandoId, setProgEditandoId] = useState<number | null>(null)
  const [progNombreForm, setProgNombreForm] = useState('')
  const [progFacultadForm, setProgFacultadForm] = useState<number | null>(null)
  const [progModal, setProgModal] = useState<ModalTipo>(null)
  const [progGuardando, setProgGuardando] = useState(false)
  const [progEliminarId, setProgEliminarId] = useState<number | null>(null)

  const [facultades, setFacultades] = useState<catalogosApi.FacultadItem[]>([])
  const [tiposPrograma, setTiposPrograma] = useState<catalogosApi.TipoProgramaItem[]>([])

  const [lineaSubTab, setLineaSubTab] = useState<CategoriaLinea>('investigacion')
  const [lineasBD, setLineasBD] = useState<catalogosApi.LineaInvestigacionItem[]>([])
  const [cargandoLineas, setCargandoLineas] = useState(true)
  const [lineasMedulares, setLineasMedulares] = useState<LineaMedularLocal[]>(getLineasMedularesLocal())
  const [busquedaLinea, setBusquedaLinea] = useState('')
  const [lineaModoFormulario, setLineaModoFormulario] = useState<ModoFormulario>(null)
  const [lineaEditandoId, setLineaEditandoId] = useState<number | null>(null)
  const [lineaNombreForm, setLineaNombreForm] = useState('')
  const [lineaModal, setLineaModal] = useState<ModalTipo>(null)
  const [lineaGuardando, setLineaGuardando] = useState(false)
  const [lineaEliminarId, setLineaEliminarId] = useState<number | null>(null)

  const [areas, setAreas] = useState<catalogosApi.AreaConocimientoItem[]>([])
  const [cargandoAreas, setCargandoAreas] = useState(true)
  const [busquedaArea, setBusquedaArea] = useState('')
  const [areaModoFormulario, setAreaModoFormulario] = useState<ModoFormulario>(null)
  const [areaEditandoId, setAreaEditandoId] = useState<number | null>(null)
  const [areaNombreForm, setAreaNombreForm] = useState('')
  const [areaDescripcionForm, setAreaDescripcionForm] = useState('')
  const [areaModal, setAreaModal] = useState<ModalTipo>(null)
  const [areaGuardando, setAreaGuardando] = useState(false)
  const [areaEliminarId, setAreaEliminarId] = useState<number | null>(null)

  const [mtSubTab, setMtSubTab] = useState<CategoriaModalidadTipo>('modalidad')
  const [modalidades, setModalidades] = useState<catalogosApi.ModalidadProyectoItem[]>([])
  const [tiposProyectoMt, setTiposProyectoMt] = useState<catalogosApi.TipoProyectoItem[]>([])
  const [cargandoMt, setCargandoMt] = useState(true)
  const [busquedaMt, setBusquedaMt] = useState('')
  const [mtModoFormulario, setMtModoFormulario] = useState<ModoFormulario>(null)
  const [mtEditandoId, setMtEditandoId] = useState<number | null>(null)
  const [mtNombreForm, setMtNombreForm] = useState('')
  const [mtModal, setMtModal] = useState<ModalTipo>(null)
  const [mtGuardando, setMtGuardando] = useState(false)
  const [mtEliminarId, setMtEliminarId] = useState<number | null>(null)

  const [limites, setLimitesState] = useState<LimiteTextoInfo[]>(getLimites())
  const [limiteAntecedentesValor, setLimiteAntecedentesValor] = useState<number>(getLimiteAntecedentes())
  const [busquedaLimite, setBusquedaLimite] = useState('')
  const [limiteEditando, setLimiteEditando] = useState<{ clave: ClaveLimiteTexto; etiqueta: string } | 'antecedentes' | null>(null)
  const [limiteValorForm, setLimiteValorForm] = useState('')

  const [odsList, setOdsList] = useState<catalogosApi.OdsItem[]>([])
  const [cargandoOds, setCargandoOds] = useState(true)
  const [busquedaOds, setBusquedaOds] = useState('')
  const [odsModoFormulario, setOdsModoFormulario] = useState<ModoFormulario>(null)
  const [odsEditandoId, setOdsEditandoId] = useState<number | null>(null)
  const [odsNombreForm, setOdsNombreForm] = useState('')
  const [odsDescripcionForm, setOdsDescripcionForm] = useState('')
  const [odsModal, setOdsModal] = useState<ModalTipo>(null)
  const [odsGuardando, setOdsGuardando] = useState(false)
  const [odsEliminarId, setOdsEliminarId] = useState<number | null>(null)

  const refrescar = async () => {
    try {
      const datos = await convocatoriasApi.listarConvocatorias()
      setConvocatorias(datos.map(mapearConvocatoria))
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    refrescar()
  }, [])

  const resetForm = () => {
    setNombre('')
    setVigenciaInicio(null)
    setVigenciaFin(null)
    setHoraInicio('08:00')
    setHoraFin('23:59')
  }

  const abrirFormCrear = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const formatearHora = (fecha: Date) =>
    `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`

  const abrirFormEditar = (c: Convocatoria) => {
    setNombre(c.nombre)
    setVigenciaInicio(c.vigenciaInicio)
    setVigenciaFin(c.vigenciaFin)
    setHoraInicio(c.vigenciaInicio ? formatearHora(c.vigenciaInicio) : '08:00')
    setHoraFin(c.vigenciaFin ? formatearHora(c.vigenciaFin) : '23:59')
    setEditandoId(c.id)
    setModoFormulario('editar')
  }

  const combinarFechaYHora = (fecha: Date, hora: string): Date => {
    const [horas, minutos] = hora.split(':').map(Number)
    const combinada = new Date(fecha)
    combinada.setHours(horas || 0, minutos || 0, 0, 0)
    return combinada
  }

  const handleGuardar = async () => {
    if (!nombre.trim() || !vigenciaInicio || !vigenciaFin) return

    setGuardando(true)
    try {
      const datos = {
        nombre: nombre.trim(),
        fecha_inicio: combinarFechaYHora(vigenciaInicio, horaInicio).toISOString(),
        fecha_fin: combinarFechaYHora(vigenciaFin, horaFin).toISOString(),
      }

      if (modoFormulario === 'editar' && editandoId !== null) {
        await convocatoriasApi.actualizarConvocatoria(editandoId, datos)
      } else {
        await convocatoriasApi.crearConvocatoria(datos)
      }

      await refrescar()
      setModal('exito')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la convocatoria.')
    } finally {
      setGuardando(false)
    }
  }

  const handleSeguirRegistrando = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
    setModal(null)
  }

  const handleOk = () => {
    setModal(null)
    setModoFormulario(null)
    setEditandoId(null)
  }

  const handleCancelarClick = () => {
    setModal('cancelar')
  }

  const handleCancelarNo = () => {
    setModal(null)
  }

  const handleCancelarSi = () => {
    setModal(null)
    setModoFormulario(null)
    setEditandoId(null)
    resetForm()
  }

  const handleToggle = async (c: Convocatoria) => {
    try {
      await convocatoriasApi.cambiarEstadoConvocatoria(c.id, c.activa ? 'inactiva' : 'activa')
      await refrescar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.')
    }
  }

  const pedirEliminar = (id: number) => {
    setEliminarId(id)
  }

  const cancelarEliminar = () => {
    setEliminarId(null)
  }

  const confirmarEliminar = async () => {
    if (eliminarId !== null) {
      try {
        await convocatoriasApi.eliminarConvocatoria(eliminarId)
        await refrescar()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la convocatoria.')
      }
    }
    setEliminarId(null)
  }

  const filtradas = convocatorias.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const convocatoriaAEliminar = convocatorias.find((c) => c.id === eliminarId) ?? null

  const refrescarPeriodos = () => {
    setCargandoPeriodos(true)
    catalogosApi
      .listarPeriodos()
      .then(setPeriodos)
      .catch(() => setError('No se pudieron cargar los períodos.'))
      .finally(() => setCargandoPeriodos(false))
  }

  useEffect(() => {
    refrescarPeriodos()
  }, [])

  const abrirPeriodoCrear = () => {
    setPeriodoNombreForm('')
    setPeriodoEditandoId(null)
    setPeriodoModoFormulario('crear')
  }

  const abrirPeriodoEditar = (p: catalogosApi.PeriodoItem) => {
    setPeriodoNombreForm(p.nombre)
    setPeriodoEditandoId(p.id_periodo)
    setPeriodoModoFormulario('editar')
  }

  const cerrarPeriodoForm = () => {
    setPeriodoModoFormulario(null)
    setPeriodoEditandoId(null)
    setPeriodoNombreForm('')
    setPeriodoModal(null)
  }

  const handleRegistrarPeriodo = () => {
    const nombre = periodoNombreForm.trim()
    if (!nombre) return
    setError('')
    setPeriodoGuardando(true)

    const accion =
      periodoModoFormulario === 'editar' && periodoEditandoId !== null
        ? catalogosApi.actualizarPeriodo(periodoEditandoId, nombre)
        : catalogosApi.crearPeriodo(nombre)

    accion
      .then(() => {
        refrescarPeriodos()
        setPeriodoModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el período.'))
      .finally(() => setPeriodoGuardando(false))
  }

  const handlePeriodoSeguirRegistrando = () => {
    setPeriodoNombreForm('')
    setPeriodoEditandoId(null)
    setPeriodoModoFormulario('crear')
    setPeriodoModal(null)
  }

  const handlePeriodoOk = () => {
    cerrarPeriodoForm()
  }

  const handlePeriodoCancelarClick = () => {
    setPeriodoModal('cancelar')
  }

  const handlePeriodoCancelarNo = () => {
    setPeriodoModal(null)
  }

  const handlePeriodoCancelarSi = () => {
    cerrarPeriodoForm()
  }

  const handleTogglePeriodo = (p: catalogosApi.PeriodoItem) => {
    setError('')
    catalogosApi
      .cambiarEstadoPeriodo(p.id_periodo, !p.activo)
      .then(() => refrescarPeriodos())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado del período.'))
  }

  const pedirEliminarPeriodo = (id: number) => {
    setEliminarPeriodoId(id)
  }

  const cancelarEliminarPeriodo = () => {
    setEliminarPeriodoId(null)
  }

  // Borrado real: el backend rechaza con 409 si algún cronograma ya lo referencia.
  const confirmarEliminarPeriodo = () => {
    if (eliminarPeriodoId !== null) {
      setError('')
      catalogosApi
        .eliminarPeriodo(eliminarPeriodoId)
        .then(() => refrescarPeriodos())
        .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el período.'))
    }
    setEliminarPeriodoId(null)
  }

  const periodosFiltrados = periodos.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaPeriodo.toLowerCase())
  )

  const periodoAEliminar = periodos.find((p) => p.id_periodo === eliminarPeriodoId) ?? null

  const refrescarProgramas = () => {
    setCargandoProgramas(true)
    Promise.all([
      catalogosApi.listarFacultades(),
      catalogosApi.listarTiposPrograma(),
      catalogosApi.listarProgramas(),
    ])
      .then(([facultadesRes, tiposRes, programasRes]) => {
        setFacultades(facultadesRes)
        setTiposPrograma(tiposRes)
        setProgItems(programasRes)
        if (progFacultadForm === null && facultadesRes.length > 0) setProgFacultadForm(facultadesRes[0].id_facultad)
      })
      .catch(() => setError('No se pudieron cargar los programas.'))
      .finally(() => setCargandoProgramas(false))
  }

  useEffect(() => {
    refrescarProgramas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const idTipoProgramaDelSubTab = tiposPrograma.find((t) => t.nombre === progSubTab)?.id_tipo_programa ?? null

  const abrirProgCrear = () => {
    setProgNombreForm('')
    setProgEditandoId(null)
    setProgFacultadForm(facultades[0]?.id_facultad ?? null)
    setProgModoFormulario('crear')
  }

  const abrirProgEditar = (p: catalogosApi.ProgramaItem) => {
    setProgNombreForm(p.nombre)
    setProgEditandoId(p.id_programa)
    setProgFacultadForm(p.id_facultad)
    setProgModoFormulario('editar')
  }

  const cerrarProgForm = () => {
    setProgModoFormulario(null)
    setProgEditandoId(null)
    setProgNombreForm('')
    setProgModal(null)
  }

  const handleRegistrarPrograma = () => {
    const nombre = progNombreForm.trim()
    if (!nombre) return
    setError('')
    setProgGuardando(true)

    const accion =
      progModoFormulario === 'editar' && progEditandoId !== null
        ? catalogosApi.actualizarPrograma(progEditandoId, nombre)
        : idTipoProgramaDelSubTab && progFacultadForm
          ? catalogosApi.crearPrograma(nombre, progFacultadForm, idTipoProgramaDelSubTab)
          : Promise.reject(new Error('Selecciona una facultad y verifica que el tipo de programa exista en el catálogo.'))

    accion
      .then(() => {
        refrescarProgramas()
        setProgModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : err.message || 'No se pudo guardar el programa.'))
      .finally(() => setProgGuardando(false))
  }

  const handleProgSeguirRegistrando = () => {
    setProgNombreForm('')
    setProgEditandoId(null)
    setProgModoFormulario('crear')
    setProgModal(null)
  }

  const handleProgOk = () => {
    cerrarProgForm()
  }

  const handleProgCancelarClick = () => {
    setProgModal('cancelar')
  }

  const handleProgCancelarNo = () => {
    setProgModal(null)
  }

  const handleProgCancelarSi = () => {
    cerrarProgForm()
  }

  const handleToggleProg = (p: catalogosApi.ProgramaItem) => {
    setError('')
    catalogosApi
      .cambiarEstadoPrograma(p.id_programa, !p.activo)
      .then(() => refrescarProgramas())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado del programa.'))
  }

  const pedirEliminarPrograma = (id: number) => {
    setProgEliminarId(id)
  }

  const cancelarEliminarPrograma = () => {
    setProgEliminarId(null)
  }

  // Borrado real: el backend rechaza con 409 si algún proyecto o grupo ya lo referencia.
  const confirmarEliminarPrograma = () => {
    if (progEliminarId !== null) {
      setError('')
      catalogosApi
        .eliminarPrograma(progEliminarId)
        .then(() => refrescarProgramas())
        .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el programa.'))
    }
    setProgEliminarId(null)
  }

  const programasFiltrados = progItems.filter(
    (p) => p.tipoPrograma?.nombre === progSubTab && p.nombre.toLowerCase().includes(busquedaPrograma.toLowerCase())
  )

  const programaAEliminar = progItems.find((p) => p.id_programa === progEliminarId) ?? null

  const refrescarLineasBD = () => {
    setCargandoLineas(true)
    catalogosApi
      .listarLineasInvestigacion()
      .then(setLineasBD)
      .catch(() => setError('No se pudieron cargar las líneas de investigación.'))
      .finally(() => setCargandoLineas(false))
  }

  useEffect(() => {
    refrescarLineasBD()
  }, [])

  const refrescarLineasMedulares = () => setLineasMedulares([...getLineasMedularesLocal()])

  // Vista unificada: "investigación" viene de BD, "medular" de localStorage.
  const filasLinea: FilaLinea[] =
    lineaSubTab === 'investigacion'
      ? lineasBD.map((l) => ({ id: l.id_linea, nombre: l.nombre, activa: l.activa }))
      : lineasMedulares
          .filter((l) => l.categoria === 'medular')
          .map((l) => ({ id: l.id, nombre: l.nombre, activa: l.activa }))

  const abrirLineaCrear = () => {
    setLineaNombreForm('')
    setLineaEditandoId(null)
    setLineaModoFormulario('crear')
  }

  const abrirLineaEditar = (l: FilaLinea) => {
    setLineaNombreForm(l.nombre)
    setLineaEditandoId(l.id)
    setLineaModoFormulario('editar')
  }

  const cerrarLineaForm = () => {
    setLineaModoFormulario(null)
    setLineaEditandoId(null)
    setLineaNombreForm('')
    setLineaModal(null)
  }

  const handleRegistrarLinea = () => {
    const nombre = lineaNombreForm.trim()
    if (!nombre) return

    if (lineaSubTab === 'medular') {
      // Sin catálogo propio en backend todavía: sigue en localStorage.
      if (lineaModoFormulario === 'editar' && lineaEditandoId !== null) {
        editarLineaMedularLocal(lineaEditandoId, nombre)
      } else {
        addLineaMedularLocal(nombre, 'medular')
      }
      refrescarLineasMedulares()
      setLineaModal('exito')
      return
    }

    setError('')
    setLineaGuardando(true)
    const accion =
      lineaModoFormulario === 'editar' && lineaEditandoId !== null
        ? catalogosApi.actualizarLineaInvestigacion(lineaEditandoId, nombre)
        : catalogosApi.crearLineaInvestigacion(nombre)

    accion
      .then(() => {
        refrescarLineasBD()
        setLineaModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la línea de investigación.'))
      .finally(() => setLineaGuardando(false))
  }

  const handleLineaSeguirRegistrando = () => {
    setLineaNombreForm('')
    setLineaEditandoId(null)
    setLineaModoFormulario('crear')
    setLineaModal(null)
  }

  const handleLineaOk = () => {
    cerrarLineaForm()
  }

  const handleLineaCancelarClick = () => {
    setLineaModal('cancelar')
  }

  const handleLineaCancelarNo = () => {
    setLineaModal(null)
  }

  const handleLineaCancelarSi = () => {
    cerrarLineaForm()
  }

  const handleToggleLinea = (l: FilaLinea) => {
    if (lineaSubTab === 'medular') {
      toggleLineaMedularLocal(l.id)
      refrescarLineasMedulares()
      return
    }
    setError('')
    catalogosApi
      .cambiarEstadoLineaInvestigacion(l.id, !l.activa)
      .then(() => refrescarLineasBD())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.'))
  }

  const pedirEliminarLinea = (id: number) => {
    setLineaEliminarId(id)
  }

  const cancelarEliminarLinea = () => {
    setLineaEliminarId(null)
  }

  // La línea de investigación real hace borrado real (el backend rechaza con
  // 409 si algún grupo/proyecto ya la referencia). La medular sí se borra
  // directo: solo vive en localStorage.
  const confirmarEliminarLinea = () => {
    if (lineaEliminarId !== null) {
      if (lineaSubTab === 'medular') {
        eliminarLineaMedularLocal(lineaEliminarId)
        refrescarLineasMedulares()
      } else {
        setError('')
        catalogosApi
          .eliminarLineaInvestigacion(lineaEliminarId)
          .then(() => refrescarLineasBD())
          .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la línea.'))
      }
    }
    setLineaEliminarId(null)
  }

  const lineasFiltradas = filasLinea.filter((l) => l.nombre.toLowerCase().includes(busquedaLinea.toLowerCase()))

  const lineaAEliminar = filasLinea.find((l) => l.id === lineaEliminarId) ?? null

  const tLinea = textosLinea[lineaSubTab]

  const refrescarAreas = () => {
    setCargandoAreas(true)
    catalogosApi
      .listarAreasConocimiento()
      .then(setAreas)
      .catch(() => setError('No se pudieron cargar las áreas de conocimiento.'))
      .finally(() => setCargandoAreas(false))
  }

  useEffect(() => {
    refrescarAreas()
  }, [])

  const abrirAreaCrear = () => {
    setAreaNombreForm('')
    setAreaDescripcionForm('')
    setAreaEditandoId(null)
    setAreaModoFormulario('crear')
  }

  const abrirAreaEditar = (a: catalogosApi.AreaConocimientoItem) => {
    setAreaNombreForm(a.nombre)
    setAreaDescripcionForm(a.descripcion ?? '')
    setAreaEditandoId(a.id_area_conocimiento)
    setAreaModoFormulario('editar')
  }

  const cerrarAreaForm = () => {
    setAreaModoFormulario(null)
    setAreaEditandoId(null)
    setAreaNombreForm('')
    setAreaDescripcionForm('')
    setAreaModal(null)
  }

  const handleRegistrarArea = async () => {
    const nombre = areaNombreForm.trim()
    if (!nombre) return
    const descripcion = areaDescripcionForm.trim()

    setError('')
    setAreaGuardando(true)
    try {
      if (areaModoFormulario === 'editar' && areaEditandoId !== null) {
        await catalogosApi.actualizarAreaConocimiento(areaEditandoId, nombre, descripcion || undefined)
      } else {
        await catalogosApi.crearAreaConocimiento(nombre, descripcion || undefined)
      }

      refrescarAreas()
      setAreaModal('exito')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el área de conocimiento.')
    } finally {
      setAreaGuardando(false)
    }
  }

  const handleAreaSeguirRegistrando = () => {
    setAreaNombreForm('')
    setAreaDescripcionForm('')
    setAreaEditandoId(null)
    setAreaModoFormulario('crear')
    setAreaModal(null)
  }

  const handleAreaOk = () => {
    cerrarAreaForm()
  }

  const handleAreaCancelarClick = () => {
    setAreaModal('cancelar')
  }

  const handleAreaCancelarNo = () => {
    setAreaModal(null)
  }

  const handleAreaCancelarSi = () => {
    cerrarAreaForm()
  }

  const handleToggleArea = (a: catalogosApi.AreaConocimientoItem) => {
    setError('')
    catalogosApi
      .cambiarEstadoAreaConocimiento(a.id_area_conocimiento, !a.activo)
      .then(() => refrescarAreas())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado del área.'))
  }

  const pedirEliminarArea = (id: number) => {
    setAreaEliminarId(id)
  }

  const cancelarEliminarArea = () => {
    setAreaEliminarId(null)
  }

  // Borrado real: el backend rechaza con 409 si algún proyecto ya la referencia.
  const confirmarEliminarArea = () => {
    if (areaEliminarId !== null) {
      setError('')
      catalogosApi
        .eliminarAreaConocimiento(areaEliminarId)
        .then(() => refrescarAreas())
        .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el área.'))
    }
    setAreaEliminarId(null)
  }

  const areasFiltradas = areas.filter((a) => a.nombre.toLowerCase().includes(busquedaArea.toLowerCase()))

  const areaAEliminar = areas.find((a) => a.id_area_conocimiento === areaEliminarId) ?? null

  const tMt = textosMt[mtSubTab]

  const refrescarMt = () => {
    setCargandoMt(true)
    Promise.all([catalogosApi.listarModalidadesProyecto(), catalogosApi.listarTiposProyecto()])
      .then(([mods, tps]) => {
        setModalidades(mods)
        setTiposProyectoMt(tps)
      })
      .catch(() => setError('No se pudieron cargar modalidades/tipos de proyecto.'))
      .finally(() => setCargandoMt(false))
  }

  useEffect(() => {
    refrescarMt()
  }, [])

  const mtFilas = mtSubTab === 'modalidad'
    ? modalidades.map((m) => ({ id: m.id_modalidad, nombre: m.nombre, activo: m.activo }))
    : tiposProyectoMt.map((t) => ({ id: t.id_tipo_proyecto, nombre: t.nombre, activo: t.activo }))

  const abrirMtCrear = () => {
    setMtNombreForm('')
    setMtEditandoId(null)
    setMtModoFormulario('crear')
  }

  const abrirMtEditar = (item: { id: number; nombre: string }) => {
    setMtNombreForm(item.nombre)
    setMtEditandoId(item.id)
    setMtModoFormulario('editar')
  }

  const cerrarMtForm = () => {
    setMtModoFormulario(null)
    setMtEditandoId(null)
    setMtNombreForm('')
    setMtModal(null)
  }

  const handleRegistrarMt = () => {
    const nombre = mtNombreForm.trim()
    if (!nombre) return
    setError('')
    setMtGuardando(true)

    const esEditar = mtModoFormulario === 'editar' && mtEditandoId !== null
    const accion =
      mtSubTab === 'modalidad'
        ? esEditar
          ? catalogosApi.actualizarModalidadProyecto(mtEditandoId!, nombre)
          : catalogosApi.crearModalidadProyecto(nombre)
        : esEditar
          ? catalogosApi.actualizarTipoProyecto(mtEditandoId!, nombre)
          : catalogosApi.crearTipoProyecto(nombre)

    accion
      .then(() => {
        refrescarMt()
        setMtModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar.'))
      .finally(() => setMtGuardando(false))
  }

  const handleMtSeguirRegistrando = () => {
    setMtNombreForm('')
    setMtEditandoId(null)
    setMtModoFormulario('crear')
    setMtModal(null)
  }

  const handleMtOk = () => {
    cerrarMtForm()
  }

  const handleMtCancelarClick = () => {
    setMtModal('cancelar')
  }

  const handleMtCancelarNo = () => {
    setMtModal(null)
  }

  const handleMtCancelarSi = () => {
    cerrarMtForm()
  }

  const handleToggleMt = (item: { id: number; activo: boolean }) => {
    setError('')
    const accion =
      mtSubTab === 'modalidad'
        ? catalogosApi.cambiarEstadoModalidadProyecto(item.id, !item.activo)
        : catalogosApi.cambiarEstadoTipoProyecto(item.id, !item.activo)

    accion
      .then(() => refrescarMt())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.'))
  }

  const pedirEliminarMt = (id: number) => {
    setMtEliminarId(id)
  }

  const cancelarEliminarMt = () => {
    setMtEliminarId(null)
  }

  // Borrado real: el backend rechaza con 409 si algún proyecto ya la/lo referencia.
  const confirmarEliminarMt = () => {
    if (mtEliminarId !== null) {
      setError('')
      const accion =
        mtSubTab === 'modalidad'
          ? catalogosApi.eliminarModalidadProyecto(mtEliminarId)
          : catalogosApi.eliminarTipoProyecto(mtEliminarId)

      accion
        .then(() => refrescarMt())
        .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.'))
    }
    setMtEliminarId(null)
  }

  const mtItemsFiltrados = mtFilas.filter((i) => i.nombre.toLowerCase().includes(busquedaMt.toLowerCase()))

  const mtItemAEliminar = mtFilas.find((i) => i.id === mtEliminarId) ?? null

  const abrirEditarLimite = (l: LimiteTextoInfo) => {
    setLimiteEditando({ clave: l.clave, etiqueta: l.etiqueta })
    setLimiteValorForm(String(l.maxCaracteres))
  }

  const abrirEditarLimiteAntecedentes = () => {
    setLimiteEditando('antecedentes')
    setLimiteValorForm(String(limiteAntecedentesValor))
  }

  const cerrarLimiteForm = () => {
    setLimiteEditando(null)
    setLimiteValorForm('')
  }

  const handleGuardarLimite = () => {
    const valor = Number(limiteValorForm)
    if (!Number.isFinite(valor) || valor <= 0) return

    if (limiteEditando === 'antecedentes') {
      setLimiteAntecedentes(valor)
      setLimiteAntecedentesValor(valor)
    } else if (limiteEditando) {
      setLimite(limiteEditando.clave, valor)
      setLimitesState([...getLimites()])
    }
    cerrarLimiteForm()
  }

  const limitesFiltrados = limites.filter((l) => l.etiqueta.toLowerCase().includes(busquedaLimite.toLowerCase()))

  const tituloLimiteAntecedentes = 'Cantidad máxima de antecedentes'
  const mostrarLimiteAntecedentes = tituloLimiteAntecedentes.toLowerCase().includes(busquedaLimite.toLowerCase())

  const refrescarOds = () => {
    setCargandoOds(true)
    catalogosApi
      .listarOds()
      .then(setOdsList)
      .catch(() => setError('No se pudieron cargar los ODS.'))
      .finally(() => setCargandoOds(false))
  }

  useEffect(() => {
    refrescarOds()
  }, [])

  const abrirOdsCrear = () => {
    setError('')
    setOdsNombreForm('')
    setOdsDescripcionForm('')
    setOdsEditandoId(null)
    setOdsModoFormulario('crear')
  }

  const abrirOdsEditar = (o: catalogosApi.OdsItem) => {
    setError('')
    setOdsNombreForm(o.nombre)
    setOdsDescripcionForm(o.descripcion ?? '')
    setOdsEditandoId(o.id_ods)
    setOdsModoFormulario('editar')
  }

  const cerrarOdsForm = () => {
    setError('')
    setOdsModoFormulario(null)
    setOdsEditandoId(null)
    setOdsNombreForm('')
    setOdsDescripcionForm('')
    setOdsModal(null)
  }

  const handleRegistrarOds = () => {
    const nombre = odsNombreForm.trim()
    if (!nombre) return
    setError('')
    setOdsGuardando(true)

    const accion =
      odsModoFormulario === 'editar' && odsEditandoId !== null
        ? catalogosApi.actualizarOds(odsEditandoId, nombre)
        : catalogosApi.crearOds(nombre, odsDescripcionForm.trim() || undefined)

    accion
      .then(() => {
        refrescarOds()
        setOdsModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el ODS.'))
      .finally(() => setOdsGuardando(false))
  }

  const handleOdsSeguirRegistrando = () => {
    setOdsNombreForm('')
    setOdsDescripcionForm('')
    setOdsEditandoId(null)
    setOdsModoFormulario('crear')
    setOdsModal(null)
  }

  const handleOdsOk = () => {
    cerrarOdsForm()
  }

  const handleOdsCancelarClick = () => {
    setOdsModal('cancelar')
  }

  const handleOdsCancelarNo = () => {
    setOdsModal(null)
  }

  const handleOdsCancelarSi = () => {
    cerrarOdsForm()
  }

  const handleToggleOds = (o: catalogosApi.OdsItem) => {
    setError('')
    catalogosApi
      .cambiarEstadoOds(o.id_ods, !o.activo)
      .then(() => refrescarOds())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.'))
  }

  const pedirEliminarOds = (id: number) => {
    setOdsEliminarId(id)
  }

  const cancelarEliminarOds = () => {
    setOdsEliminarId(null)
  }

  // Borrado real: el backend rechaza con 409 si algún proyecto ya lo referencia.
  const confirmarEliminarOds = () => {
    if (odsEliminarId !== null) {
      setError('')
      catalogosApi
        .eliminarOds(odsEliminarId)
        .then(() => refrescarOds())
        .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el ODS.'))
    }
    setOdsEliminarId(null)
  }

  const odsFiltrados = odsList.filter((o) =>
    o.nombre.toLowerCase().includes(busquedaOds.toLowerCase())
  )
  const odsAEliminar = odsList.find((o) => o.id_ods === odsEliminarId) ?? null

  return (
    <div className="conv-page">
      {!modoFormulario ? (
        <>
          <div className="conv-tabs">
            <button
              type="button"
              className={`conv-tab ${tab === 'convocatorias' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('convocatorias')}
            >
              Convocatorias
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'periodos' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('periodos')}
            >
              Periódos
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'programas' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('programas')}
            >
              Programas académicos
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'lineas' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('lineas')}
            >
              Líneas de investigación
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'ods' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('ods')}
            >
              ODS
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'areas' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('areas')}
            >
              Áreas de conocimiento
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'modalidad' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('modalidad')}
            >
              Modalidad y tipo de proyecto
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'limites' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('limites')}
            >
              Límites de texto
            </button>
            <button
              type="button"
              className={`conv-tab ${tab === 'resultados' ? 'conv-tab-active' : ''}`}
              onClick={() => setTab('resultados')}
            >
              Resultados esperados
            </button>
          </div>

          {tab === 'convocatorias' && (
            <div className="conv-list-wrapper">
              <div className="conv-toolbar">
                <button type="button" className="conv-add-btn" onClick={abrirFormCrear}>
                  <FilePlus size={16} />
                  Añadir convocatoria
                </button>

                <div className="conv-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar convocatoria"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </div>

              <div className="conv-list">
                {error && <p className="conv-empty">{error}</p>}
                {cargando && <p className="conv-empty">Cargando convocatorias...</p>}

                {!cargando && filtradas.map((c) => (
                  <div className="conv-card" key={c.id}>
                    <span className="conv-card-nombre">{c.nombre}</span>

                    <div className="conv-card-proyectos">
                      <span className="conv-card-proyectos-label">Proyectos</span>
                      <span className="conv-card-proyectos-badge">{c.proyectos}</span>
                    </div>

                    <button
                      type="button"
                      className="conv-edit-btn"
                      aria-label="Editar convocatoria"
                      onClick={() => abrirFormEditar(c)}
                    >
                      <SquarePen size={16} />
                    </button>

                    <button
                      type="button"
                      className="conv-delete-btn"
                      aria-label="Eliminar convocatoria"
                      onClick={() => pedirEliminar(c.id)}
                    >
                      <Trash2 size={16} />
                    </button>

                    <label className="conv-switch">
                      <input
                        type="checkbox"
                        checked={c.activa}
                        onChange={() => handleToggle(c)}
                      />
                      <span className="conv-switch-slider" />
                    </label>
                  </div>
                ))}

                {!cargando && !error && filtradas.length === 0 && (
                  <p className="conv-empty">No se encontraron convocatorias.</p>
                )}
              </div>

              {eliminarId !== null && (
                <ConfirmModal
                  mensaje={`¿Seguro que desea eliminar "${convocatoriaAEliminar?.nombre ?? 'esta convocatoria'}"?`}
                  botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
                  botonPrimario={{ label: 'Sí', onClick: confirmarEliminar, variante: 'rojo' }}
                  onClose={cancelarEliminar}
                />
              )}
            </div>
          )}

          {tab === 'periodos' && (
            <div className="periodo-page-wrapper">
              <div className="conv-toolbar">
                <button type="button" className="conv-add-btn" onClick={abrirPeriodoCrear}>
                  <FilePlus size={16} />
                  Añadir período
                </button>

                <div className="conv-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar período"
                    value={busquedaPeriodo}
                    onChange={(e) => setBusquedaPeriodo(e.target.value)}
                  />
                </div>
              </div>

              {cargandoPeriodos ? (
                <p className="conv-empty">Cargando períodos...</p>
              ) : (
              <div className="periodo-grid">
                {periodosFiltrados.map((p) => (
                  <div className="periodo-card" key={p.id_periodo}>
                    <span className="periodo-nombre">{p.nombre}</span>

                    <div className="periodo-actions">
                      <button
                        type="button"
                        className="conv-edit-btn"
                        aria-label="Editar período"
                        onClick={() => abrirPeriodoEditar(p)}
                      >
                        <SquarePen size={16} />
                      </button>

                      <button
                        type="button"
                        className="conv-delete-btn"
                        aria-label="Eliminar período"
                        onClick={() => pedirEliminarPeriodo(p.id_periodo)}
                      >
                        <Trash2 size={16} />
                      </button>

                      <label className="conv-switch">
                        <input
                          type="checkbox"
                          checked={p.activo}
                          onChange={() => handleTogglePeriodo(p)}
                        />
                        <span className="conv-switch-slider" />
                      </label>
                    </div>
                  </div>
                ))}

                {periodosFiltrados.length === 0 && (
                  <p className="conv-empty">No se encontraron períodos.</p>
                )}
              </div>
              )}

              {eliminarPeriodoId !== null && (
                <ConfirmModal
                  mensaje={`¿Seguro que desea eliminar el período "${periodoAEliminar?.nombre ?? ''}"?`}
                  botonSecundario={{ label: 'No', onClick: cancelarEliminarPeriodo, variante: 'azul' }}
                  botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminarPeriodo, variante: 'rojo' }}
                  onClose={cancelarEliminarPeriodo}
                />
              )}

              {periodoModoFormulario && (
                <div className="periodo-modal-overlay">
                  <div className="periodo-modal-wrapper">
                    <div className="periodo-modal-box">
                      <button
                        type="button"
                        className="periodo-modal-close"
                        onClick={cerrarPeriodoForm}
                        aria-label="Cerrar"
                      >
                        <XIcon size={16} />
                      </button>

                      <h2 className="periodo-modal-title">
                        {periodoModoFormulario === 'editar'
                          ? 'Editar período'
                          : 'Registrar período de duración'}
                      </h2>

                      <div className="periodo-modal-field">
                        <label>Nombre del período:</label>
                        <input
                          type="text"
                          value={periodoNombreForm}
                          onChange={(e) => setPeriodoNombreForm(e.target.value)}
                        />
                      </div>

                      <div className="periodo-modal-actions">
                        <button
                          type="button"
                          className="periodo-modal-registrar"
                          onClick={handleRegistrarPeriodo}
                          disabled={periodoGuardando}
                        >
                          {periodoGuardando ? 'Guardando...' : periodoModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                        </button>
                        <button
                          type="button"
                          className="periodo-modal-cancelar"
                          onClick={handlePeriodoCancelarClick}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {periodoModal === 'exito' && (
                      <ConfirmModal
                        mensaje={
                          periodoModoFormulario === 'editar'
                            ? 'Se han guardado los cambios exitosamente.'
                            : 'Se ha registrado el período exitosamente.'
                        }
                        botonSecundario={
                          periodoModoFormulario === 'crear'
                            ? {
                                label: 'Seguir registrando',
                                onClick: handlePeriodoSeguirRegistrando,
                                variante: 'azul',
                              }
                            : undefined
                        }
                        botonPrimario={{ label: 'Ok', onClick: handlePeriodoOk, variante: 'rojo' }}
                        onClose={handlePeriodoOk}
                      />
                    )}

                    {periodoModal === 'cancelar' && (
                      <ConfirmModal
                        mensaje="¿Seguro quiere cancelar el registro?"
                        botonSecundario={{ label: 'No', onClick: handlePeriodoCancelarNo, variante: 'azul' }}
                        botonPrimario={{ label: 'Sí', onClick: handlePeriodoCancelarSi, variante: 'rojo' }}
                        onClose={handlePeriodoCancelarNo}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'programas' && (
            <div className="prog-page">
              <div className="conv-subtab-grid">
                <div className="conv-subtab-cell" style={{ gridColumn: 3 }}>
                  <div className="prog-tabs">
                    <button
                      type="button"
                      className={`prog-tab ${progSubTab === 'pregrado' ? 'prog-tab-active' : ''}`}
                      onClick={() => setProgSubTab('pregrado')}
                    >
                      Pregrado
                    </button>
                    <button
                      type="button"
                      className={`prog-tab ${progSubTab === 'posgrado' ? 'prog-tab-active' : ''}`}
                      onClick={() => setProgSubTab('posgrado')}
                    >
                      Posgrado
                    </button>
                  </div>
                </div>
              </div>

              <div className="prog-toolbar">
                <button type="button" className="prog-add-btn" onClick={abrirProgCrear}>
                  <FilePlus size={16} />
                  Añadir un programa
                </button>

                <div className="prog-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar programa"
                    value={busquedaPrograma}
                    onChange={(e) => setBusquedaPrograma(e.target.value)}
                  />
                </div>
              </div>

              <div className="prog-list-wrapper">
                {cargandoProgramas ? (
                  <p className="prog-empty">Cargando programas...</p>
                ) : (
                <div className="prog-grid">
                  {programasFiltrados.map((p) => (
                    <div className="prog-card" key={p.id_programa}>
                      <span className="prog-nombre">{p.nombre}</span>

                      <div className="prog-actions">
                        <button
                          type="button"
                          className="prog-edit-btn"
                          aria-label="Editar programa"
                          onClick={() => abrirProgEditar(p)}
                        >
                          <SquarePen size={16} />
                        </button>

                        <button
                          type="button"
                          className="prog-delete-btn"
                          aria-label="Eliminar programa"
                          onClick={() => pedirEliminarPrograma(p.id_programa)}
                        >
                          <Trash2 size={16} />
                        </button>

                        <label className="prog-switch">
                          <input
                            type="checkbox"
                            checked={p.activo}
                            onChange={() => handleToggleProg(p)}
                          />
                          <span className="prog-switch-slider" />
                        </label>
                      </div>
                    </div>
                  ))}

                  {programasFiltrados.length === 0 && (
                    <p className="prog-empty">No se encontraron programas.</p>
                  )}
                </div>
                )}

                {progEliminarId !== null && (
                  <ConfirmModal
                    mensaje={`¿Seguro que desea eliminar "${programaAEliminar?.nombre ?? 'este programa'}"?`}
                    botonSecundario={{ label: 'No', onClick: cancelarEliminarPrograma, variante: 'azul' }}
                    botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminarPrograma, variante: 'rojo' }}
                    onClose={cancelarEliminarPrograma}
                  />
                )}
              </div>

              {progModoFormulario && (
                <div className="prog-modal-overlay">
                  <div className="prog-modal-wrapper">
                    <div className="prog-modal-box">
                      <button type="button" className="prog-modal-close" onClick={cerrarProgForm} aria-label="Cerrar">
                        <XIcon size={16} />
                      </button>

                      <h2 className="prog-modal-title">
                        {progModoFormulario === 'editar' ? 'Editar programa' : 'Registrar programa'}
                      </h2>

                      <div className="prog-modal-field">
                        <label>Nombre del programa:</label>
                        <input
                          type="text"
                          value={progNombreForm}
                          onChange={(e) => setProgNombreForm(e.target.value)}
                        />
                      </div>

                      {progModoFormulario === 'crear' && (
                        <div className="prog-modal-field">
                          <label>Facultad:</label>
                          <select
                            value={progFacultadForm ?? ''}
                            onChange={(e) => setProgFacultadForm(Number(e.target.value))}
                          >
                            {facultades.map((f) => (
                              <option key={f.id_facultad} value={f.id_facultad}>
                                {f.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="prog-modal-actions">
                        <button
                          type="button"
                          className="prog-modal-registrar"
                          onClick={handleRegistrarPrograma}
                          disabled={progGuardando}
                        >
                          {progGuardando ? 'Guardando...' : progModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                        </button>
                        <button type="button" className="prog-modal-cancelar" onClick={handleProgCancelarClick}>
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {progModal === 'exito' && (
                      <ConfirmModal
                        mensaje={
                          progModoFormulario === 'editar'
                            ? 'Se han guardado los cambios exitosamente.'
                            : 'Registro de programa exitoso.'
                        }
                        botonSecundario={
                          progModoFormulario === 'crear'
                            ? { label: 'Seguir registrando', onClick: handleProgSeguirRegistrando, variante: 'azul' }
                            : undefined
                        }
                        botonPrimario={{ label: 'Ok', onClick: handleProgOk, variante: 'rojo' }}
                        onClose={handleProgOk}
                      />
                    )}

                    {progModal === 'cancelar' && (
                      <ConfirmModal
                        mensaje="Seguro quiere cancelar el registro?"
                        botonSecundario={{ label: 'No', onClick: handleProgCancelarNo, variante: 'azul' }}
                        botonPrimario={{ label: 'Sí', onClick: handleProgCancelarSi, variante: 'rojo' }}
                        onClose={handleProgCancelarNo}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'lineas' && (
            <div className="li-page">
              <div className="conv-subtab-grid">
                <div className="conv-subtab-cell" style={{ gridColumn: 4 }}>
                  <div className="li-tabs">
                    <button
                      type="button"
                      className={`li-tab ${lineaSubTab === 'investigacion' ? 'li-tab-active' : ''}`}
                      onClick={() => setLineaSubTab('investigacion')}
                    >
                      Línea de investigación
                    </button>
                    <button
                      type="button"
                      className={`li-tab ${lineaSubTab === 'medular' ? 'li-tab-active' : ''}`}
                      onClick={() => setLineaSubTab('medular')}
                    >
                      Línea medular
                    </button>
                  </div>
                </div>
              </div>

              <div className="li-toolbar">
                <button type="button" className="li-add-btn" onClick={abrirLineaCrear}>
                  <FilePlus size={16} />
                  {tLinea.addBtn}
                </button>

                <div className="li-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder={tLinea.buscarPlaceholder}
                    value={busquedaLinea}
                    onChange={(e) => setBusquedaLinea(e.target.value)}
                  />
                </div>
              </div>

              <div className="li-list-wrapper">
                {lineaSubTab === 'investigacion' && cargandoLineas ? (
                  <p className="li-empty">Cargando líneas de investigación...</p>
                ) : (
                <div className="li-grid">
                  {lineasFiltradas.map((l) => (
                    <div className="li-card" key={l.id}>
                      <span className="li-nombre">{l.nombre}</span>

                      <div className="li-actions">
                        <button
                          type="button"
                          className="li-edit-btn"
                          aria-label="Editar"
                          onClick={() => abrirLineaEditar(l)}
                        >
                          <SquarePen size={16} />
                        </button>

                        <button
                          type="button"
                          className="li-delete-btn"
                          aria-label="Eliminar"
                          onClick={() => pedirEliminarLinea(l.id)}
                        >
                          <Trash2 size={16} />
                        </button>

                        <label className="li-switch">
                          <input
                            type="checkbox"
                            checked={l.activa}
                            onChange={() => handleToggleLinea(l)}
                          />
                          <span className="li-switch-slider" />
                        </label>
                      </div>
                    </div>
                  ))}

                  {lineasFiltradas.length === 0 && (
                    <p className="li-empty">No se encontraron resultados.</p>
                  )}
                </div>
                )}

                {lineaEliminarId !== null && (
                  <ConfirmModal
                    mensaje={`¿Seguro que desea eliminar "${lineaAEliminar?.nombre ?? 'esta línea'}"?`}
                    botonSecundario={{ label: 'No', onClick: cancelarEliminarLinea, variante: 'azul' }}
                    botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminarLinea, variante: 'rojo' }}
                    onClose={cancelarEliminarLinea}
                  />
                )}
              </div>

              {lineaModoFormulario && (
                <div className="li-modal-overlay">
                  <div className="li-modal-wrapper">
                    <div className="li-modal-box">
                      <button type="button" className="li-modal-close" onClick={cerrarLineaForm} aria-label="Cerrar">
                        <XIcon size={16} />
                      </button>

                      <h2 className="li-modal-title">
                        {lineaModoFormulario === 'editar' ? tLinea.modalTituloEditar : tLinea.modalTituloCrear}
                      </h2>

                      <div className="li-modal-field">
                        <label>{tLinea.campoLabel}</label>
                        <input
                          type="text"
                          value={lineaNombreForm}
                          onChange={(e) => setLineaNombreForm(e.target.value)}
                        />
                      </div>

                      <div className="li-modal-actions">
                        <button
                          type="button"
                          className="li-modal-registrar"
                          onClick={handleRegistrarLinea}
                          disabled={lineaGuardando}
                        >
                          {lineaGuardando ? 'Guardando...' : lineaModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                        </button>
                        <button type="button" className="li-modal-cancelar" onClick={handleLineaCancelarClick}>
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {lineaModal === 'exito' && (
                      <ConfirmModal
                        mensaje={lineaModoFormulario === 'editar' ? 'Se han guardado los cambios exitosamente.' : tLinea.exitoMensaje}
                        botonSecundario={
                          lineaModoFormulario === 'crear'
                            ? { label: 'Seguir registrando', onClick: handleLineaSeguirRegistrando, variante: 'azul' }
                            : undefined
                        }
                        botonPrimario={{ label: 'Ok', onClick: handleLineaOk, variante: 'rojo' }}
                        onClose={handleLineaOk}
                      />
                    )}

                    {lineaModal === 'cancelar' && (
                      <ConfirmModal
                        mensaje="Seguro quiere cancelar el registro?"
                        botonSecundario={{ label: 'No', onClick: handleLineaCancelarNo, variante: 'azul' }}
                        botonPrimario={{ label: 'Sí', onClick: handleLineaCancelarSi, variante: 'rojo' }}
                        onClose={handleLineaCancelarNo}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'areas' && (
            <div className="area-page">
              <div className="area-toolbar">
                <button type="button" className="area-add-btn" onClick={abrirAreaCrear}>
                  <BookPlus size={16} />
                  Añadir área de conocimiento
                </button>

                <div className="area-search">
                  <input
                    type="text"
                    placeholder="Buscar por área"
                    value={busquedaArea}
                    onChange={(e) => setBusquedaArea(e.target.value)}
                  />
                  <Search size={16} />
                </div>
              </div>

              <div className="area-table-wrapper">
                <div className="area-table">
                  <div className="area-table-header">
                    <span>Área</span>
                    <span>Descripción</span>
                    <span />
                  </div>

                  {areasFiltradas.map((a) => (
                    <div className="area-row" key={a.id_area_conocimiento}>
                      <span className="area-nombre">{a.nombre}</span>
                      <span className="area-descripcion">{a.descripcion}</span>

                      <div className="area-acciones">
                        <button
                          type="button"
                          className="area-edit-btn"
                          aria-label="Editar área de conocimiento"
                          onClick={() => abrirAreaEditar(a)}
                        >
                          <SquarePen size={16} />
                        </button>

                        <button
                          type="button"
                          className="area-delete-btn"
                          aria-label="Eliminar área de conocimiento"
                          onClick={() => pedirEliminarArea(a.id_area_conocimiento)}
                        >
                          <Trash2 size={16} />
                        </button>

                        <label className="area-switch">
                          <input
                            type="checkbox"
                            checked={a.activo}
                            onChange={() => handleToggleArea(a)}
                          />
                          <span className="area-switch-slider" />
                        </label>
                      </div>
                    </div>
                  ))}

                  {!cargandoAreas && areasFiltradas.length === 0 && (
                    <p className="area-empty">No se encontraron áreas de conocimiento.</p>
                  )}
                </div>

                {areaEliminarId !== null && (
                  <ConfirmModal
                    mensaje={`¿Seguro que desea eliminar "${areaAEliminar?.nombre ?? 'esta área'}"?`}
                    botonSecundario={{ label: 'No', onClick: cancelarEliminarArea, variante: 'azul' }}
                    botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminarArea, variante: 'rojo' }}
                    onClose={cancelarEliminarArea}
                  />
                )}
              </div>

              {areaModoFormulario && (
                <div className="area-modal-overlay">
                  <div className="area-modal-wrapper">
                    <div className="area-modal-box">
                      <button type="button" className="area-modal-close" onClick={cerrarAreaForm} aria-label="Cerrar">
                        <XIcon size={16} />
                      </button>

                      <h2 className="area-modal-title">
                        {areaModoFormulario === 'editar' ? 'Editar área de conocimiento' : 'Registro de área de conocimiento'}
                      </h2>

                      <div className="area-modal-field">
                        <label>Nombre de área:</label>
                        <input
                          type="text"
                          value={areaNombreForm}
                          onChange={(e) => setAreaNombreForm(e.target.value)}
                        />
                      </div>

                      <div className="area-modal-field area-modal-field-textarea">
                        <label>Descripción:</label>
                        <textarea
                          value={areaDescripcionForm}
                          onChange={(e) => setAreaDescripcionForm(e.target.value)}
                          rows={4}
                        />
                      </div>

                      <div className="area-modal-actions">
                        <button
                          type="button"
                          className="area-modal-registrar"
                          onClick={handleRegistrarArea}
                          disabled={areaGuardando}
                        >
                          {areaGuardando ? 'Guardando...' : areaModoFormulario === 'editar' ? 'Guardar cambios' : 'Añadir área'}
                        </button>
                        <button type="button" className="area-modal-cancelar" onClick={handleAreaCancelarClick}>
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {areaModal === 'exito' && (
                      <ConfirmModal
                        mensaje={
                          areaModoFormulario === 'editar'
                            ? 'Se han guardado los cambios exitosamente.'
                            : 'Registro de área exitoso.'
                        }
                        botonSecundario={
                          areaModoFormulario === 'crear'
                            ? { label: 'Seguir registrando', onClick: handleAreaSeguirRegistrando, variante: 'azul' }
                            : undefined
                        }
                        botonPrimario={{ label: 'Ok', onClick: handleAreaOk, variante: 'rojo' }}
                        onClose={handleAreaOk}
                      />
                    )}

                    {areaModal === 'cancelar' && (
                      <ConfirmModal
                        mensaje="¿Seguro quiere cancelar el registro?"
                        botonSecundario={{ label: 'No', onClick: handleAreaCancelarNo, variante: 'azul' }}
                        botonPrimario={{ label: 'Sí', onClick: handleAreaCancelarSi, variante: 'rojo' }}
                        onClose={handleAreaCancelarNo}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'modalidad' && (
            <div className="mt-page">
              <div className="conv-subtab-grid">
                <div className="conv-subtab-cell" style={{ gridColumn: 7 }}>
                  <div className="mt-tabs">
                    <button
                      type="button"
                      className={`mt-tab ${mtSubTab === 'modalidad' ? 'mt-tab-active' : ''}`}
                      onClick={() => setMtSubTab('modalidad')}
                    >
                      Modalidad de proyecto
                    </button>
                    <button
                      type="button"
                      className={`mt-tab ${mtSubTab === 'tipo' ? 'mt-tab-active' : ''}`}
                      onClick={() => setMtSubTab('tipo')}
                    >
                      Tipo de proyecto
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-toolbar">
                <button type="button" className="mt-add-btn" onClick={abrirMtCrear}>
                  <FilePlus size={16} />
                  {tMt.addBtn}
                </button>

                <div className="mt-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder={tMt.buscarPlaceholder}
                    value={busquedaMt}
                    onChange={(e) => setBusquedaMt(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-list-wrapper">
                {cargandoMt ? (
                  <p className="mt-empty">Cargando...</p>
                ) : (
                <div className="mt-grid">
                  {mtItemsFiltrados.map((item) => (
                    <div className="mt-card" key={item.id}>
                      <span className="mt-nombre">{item.nombre}</span>

                      <div className="mt-actions">
                        <button
                          type="button"
                          className="mt-edit-btn"
                          aria-label="Editar"
                          onClick={() => abrirMtEditar(item)}
                        >
                          <SquarePen size={16} />
                        </button>

                        <button
                          type="button"
                          className="mt-delete-btn"
                          aria-label="Eliminar"
                          onClick={() => pedirEliminarMt(item.id)}
                        >
                          <Trash2 size={16} />
                        </button>

                        <label className="mt-switch">
                          <input
                            type="checkbox"
                            checked={item.activo}
                            onChange={() => handleToggleMt(item)}
                          />
                          <span className="mt-switch-slider" />
                        </label>
                      </div>
                    </div>
                  ))}

                  {mtItemsFiltrados.length === 0 && (
                    <p className="mt-empty">No se encontraron resultados.</p>
                  )}
                </div>
                )}

                {mtEliminarId !== null && (
                  <ConfirmModal
                    mensaje={`¿Seguro que desea eliminar "${mtItemAEliminar?.nombre ?? 'este elemento'}"?`}
                    botonSecundario={{ label: 'No', onClick: cancelarEliminarMt, variante: 'azul' }}
                    botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminarMt, variante: 'rojo' }}
                    onClose={cancelarEliminarMt}
                  />
                )}
              </div>

              {mtModoFormulario && (
                <div className="mt-modal-overlay">
                  <div className="mt-modal-wrapper">
                    <div className="mt-modal-box">
                      <button type="button" className="mt-modal-close" onClick={cerrarMtForm} aria-label="Cerrar">
                        <XIcon size={16} />
                      </button>

                      <h2 className="mt-modal-title">
                        {mtModoFormulario === 'editar' ? tMt.modalTituloEditar : tMt.modalTituloCrear}
                      </h2>

                      <div className="mt-modal-field">
                        <label>{tMt.campoLabel}</label>
                        <input
                          type="text"
                          value={mtNombreForm}
                          onChange={(e) => setMtNombreForm(e.target.value)}
                        />
                      </div>

                      <div className="mt-modal-actions">
                        <button
                          type="button"
                          className="mt-modal-registrar"
                          onClick={handleRegistrarMt}
                          disabled={mtGuardando}
                        >
                          {mtGuardando ? 'Guardando...' : mtModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                        </button>
                        <button type="button" className="mt-modal-cancelar" onClick={handleMtCancelarClick}>
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {mtModal === 'exito' && (
                      <ConfirmModal
                        mensaje={mtModoFormulario === 'editar' ? 'Se han guardado los cambios exitosamente.' : tMt.exitoMensaje}
                        botonSecundario={
                          mtModoFormulario === 'crear'
                            ? { label: 'Seguir registrando', onClick: handleMtSeguirRegistrando, variante: 'azul' }
                            : undefined
                        }
                        botonPrimario={{ label: 'Ok', onClick: handleMtOk, variante: 'rojo' }}
                        onClose={handleMtOk}
                      />
                    )}

                    {mtModal === 'cancelar' && (
                      <ConfirmModal
                        mensaje="Seguro quiere cancelar el registro?"
                        botonSecundario={{ label: 'No', onClick: handleMtCancelarNo, variante: 'azul' }}
                        botonPrimario={{ label: 'Sí', onClick: handleMtCancelarSi, variante: 'rojo' }}
                        onClose={handleMtCancelarNo}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'limites' && (
            <div className="lim-page">
              <div className="lim-toolbar">
                <div className="lim-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar campo"
                    value={busquedaLimite}
                    onChange={(e) => setBusquedaLimite(e.target.value)}
                  />
                </div>
              </div>

              <div className="lim-list-wrapper">
                <div className="lim-grid">
                  {limitesFiltrados.map((l) => (
                    <div className="lim-card" key={l.clave}>
                      <span className="lim-nombre">{l.etiqueta}</span>

                      <div className="lim-valor">
                        <span className="lim-valor-badge">{l.maxCaracteres} caracteres</span>
                        <button
                          type="button"
                          className="lim-edit-btn"
                          aria-label={`Editar límite de ${l.etiqueta}`}
                          onClick={() => abrirEditarLimite(l)}
                        >
                          <SquarePen size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {mostrarLimiteAntecedentes && (
                    <div className="lim-card">
                      <span className="lim-nombre">{tituloLimiteAntecedentes}</span>

                      <div className="lim-valor">
                        <span className="lim-valor-badge">{limiteAntecedentesValor} máximo</span>
                        <button
                          type="button"
                          className="lim-edit-btn"
                          aria-label="Editar cantidad máxima de antecedentes"
                          onClick={abrirEditarLimiteAntecedentes}
                        >
                          <SquarePen size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {limitesFiltrados.length === 0 && !mostrarLimiteAntecedentes && (
                    <p className="lim-empty">No se encontraron campos.</p>
                  )}
                </div>
              </div>

              {limiteEditando && (
                <div className="lim-modal-overlay">
                  <div className="lim-modal-wrapper">
                    <div className="lim-modal-box">
                      <button type="button" className="lim-modal-close" onClick={cerrarLimiteForm} aria-label="Cerrar">
                        <XIcon size={16} />
                      </button>

                      <h2 className="lim-modal-title">
                        Editar límite — {limiteEditando === 'antecedentes' ? tituloLimiteAntecedentes : limiteEditando.etiqueta}
                      </h2>

                      <div className="lim-modal-field">
                        <label>
                          {limiteEditando === 'antecedentes'
                            ? 'Cantidad máxima de antecedentes:'
                            : 'Máximo de caracteres:'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={limiteValorForm}
                          onChange={(e) => setLimiteValorForm(e.target.value)}
                        />
                      </div>

                      <div className="lim-modal-actions">
                        <button type="button" className="lim-modal-guardar" onClick={handleGuardarLimite}>
                          Guardar cambios
                        </button>
                        <button type="button" className="lim-modal-cancelar" onClick={cerrarLimiteForm}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'ods' && (
            <div className="ods-page">
              <div className="ods-toolbar">
                <button type="button" className="ods-add-btn" onClick={abrirOdsCrear}>
                  <FilePlus size={16} />
                  Añadir ODS
                </button>

                <div className="ods-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar ODS"
                    value={busquedaOds}
                    onChange={(e) => setBusquedaOds(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="ods-empty">{error}</p>}

              {cargandoOds ? (
                <p className="ods-empty">Cargando ODS...</p>
              ) : (
                <div className="ods-grid">
                  {odsFiltrados.map((o) => (
                    <div className="ods-card" key={o.id_ods}>
                      <div className="ods-card-texto">
                        <span className="ods-nombre">{o.nombre}</span>
                        {o.descripcion && <span className="ods-descripcion">{o.descripcion}</span>}
                      </div>

                      <div className="ods-card-acciones">
                        <button
                          type="button"
                          className="ods-edit-btn"
                          aria-label="Editar ODS"
                          onClick={() => abrirOdsEditar(o)}
                        >
                          <SquarePen size={16} />
                        </button>

                        <button
                          type="button"
                          className="ods-delete-btn"
                          aria-label="Eliminar ODS"
                          onClick={() => pedirEliminarOds(o.id_ods)}
                        >
                          <Trash2 size={16} />
                        </button>

                        <label className="ods-switch">
                          <input
                            type="checkbox"
                            checked={o.activo}
                            onChange={() => handleToggleOds(o)}
                          />
                          <span className="ods-switch-slider" />
                        </label>
                      </div>
                    </div>
                  ))}

                  {odsFiltrados.length === 0 && (
                    <p className="ods-empty">No se encontraron ODS.</p>
                  )}
                </div>
              )}

              {odsEliminarId !== null && (
                <ConfirmModal
                  mensaje={`¿Seguro que desea eliminar "${odsAEliminar?.nombre ?? 'este ODS'}"?`}
                  botonSecundario={{ label: 'No', onClick: cancelarEliminarOds, variante: 'azul' }}
                  botonPrimario={{ label: 'Sí', onClick: confirmarEliminarOds, variante: 'rojo' }}
                  onClose={cancelarEliminarOds}
                />
              )}

              {odsModoFormulario && (
                <div className="ods-modal-overlay">
                  <div className="ods-modal-wrapper">
                    <div className="ods-modal-box">
                      <button type="button" className="ods-modal-close" onClick={cerrarOdsForm} aria-label="Cerrar">
                        <XIcon size={16} />
                      </button>

                      <h2 className="ods-modal-title">
                        {odsModoFormulario === 'editar' ? 'Editar ODS' : 'Registrar Objetivo de Desarrollo Sostenible'}
                      </h2>

                      <div className="ods-modal-field">
                        <label>Nombre del ODS:</label>
                        <input
                          type="text"
                          value={odsNombreForm}
                          onChange={(e) => setOdsNombreForm(e.target.value)}
                          placeholder="Ej. Fin de la pobreza"
                        />
                      </div>

                      {odsModoFormulario === 'crear' && (
                        <div className="ods-modal-field ods-modal-field-textarea">
                          <label>Descripción (opcional):</label>
                          <textarea
                            value={odsDescripcionForm}
                            onChange={(e) => setOdsDescripcionForm(e.target.value)}
                            rows={3}
                          />
                        </div>
                      )}

                      {error && <p className="ods-modal-error">{error}</p>}

                      <div className="ods-modal-actions">
                        <button
                          type="button"
                          className="ods-modal-registrar"
                          onClick={handleRegistrarOds}
                          disabled={odsGuardando}
                        >
                          {odsGuardando
                            ? 'Guardando...'
                            : odsModoFormulario === 'editar'
                              ? 'Guardar cambios'
                              : 'Registrar'}
                        </button>
                        <button type="button" className="ods-modal-cancelar" onClick={handleOdsCancelarClick}>
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {odsModal === 'exito' && (
                      <ConfirmModal
                        mensaje={
                          odsModoFormulario === 'editar'
                            ? 'Se han guardado los cambios exitosamente.'
                            : 'Se ha registrado el ODS exitosamente.'
                        }
                        botonSecundario={
                          odsModoFormulario === 'crear'
                            ? { label: 'Seguir registrando', onClick: handleOdsSeguirRegistrando, variante: 'azul' }
                            : undefined
                        }
                        botonPrimario={{ label: 'Ok', onClick: handleOdsOk, variante: 'rojo' }}
                        onClose={handleOdsOk}
                      />
                    )}

                    {odsModal === 'cancelar' && (
                      <ConfirmModal
                        mensaje="¿Seguro quiere cancelar el registro?"
                        botonSecundario={{ label: 'No', onClick: handleOdsCancelarNo, variante: 'azul' }}
                        botonPrimario={{ label: 'Sí', onClick: handleOdsCancelarSi, variante: 'rojo' }}
                        onClose={handleOdsCancelarNo}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'resultados' && <ResultadosEsperadosTab />}
        </>
      ) : (
        <div className="conv-registro-wrapper">
          <div className="conv-registro-card">
            <h2 className="conv-registro-title">
              {modoFormulario === 'editar' ? 'Editar convocatoria' : 'Registro de convocatorias'}
            </h2>

            <div className="conv-registro-field">
              <label>Nombre de la convocatoria:</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="conv-registro-vigencia-label">
              <CalendarIcon size={16} />
              <span>Seleccione la vigencia de la convocatoria:</span>
            </div>

            <DateRangeCalendar
              inicio={vigenciaInicio}
              fin={vigenciaFin}
              onChange={(inicio, fin) => {
                setVigenciaInicio(inicio)
                setVigenciaFin(fin)
              }}
            />

            <p className="conv-registro-rango">{formatearRango(vigenciaInicio, vigenciaFin)}</p>

            <div className="conv-registro-horas">
              <div className="conv-registro-field conv-registro-field-hora">
                <label>Hora de inicio:</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="conv-registro-field conv-registro-field-hora">
                <label>Hora de cierre:</label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            </div>

            <p className="conv-registro-hora-nota">
              La convocatoria se cerrará automáticamente a esta hora en la fecha de cierre elegida.
            </p>

            <div className="conv-registro-actions">
              <button type="button" className="conv-registro-guardar" onClick={handleGuardar} disabled={guardando}>
                <Save size={16} />
                {guardando ? 'Guardando...' : modoFormulario === 'editar' ? 'Guardar cambios' : 'Añadir convocatoria'}
              </button>
              <button type="button" className="conv-registro-cancelar" onClick={handleCancelarClick}>
                <XIcon size={16} />
                Cancelar
              </button>
            </div>
          </div>

          {modal === 'exito' && (
            <ConfirmModal
              mensaje={
                modoFormulario === 'editar'
                  ? 'Se han guardado los cambios exitosamente.'
                  : 'Se ha registrado la convocatoria exitosamente.'
              }
              botonSecundario={
                modoFormulario === 'crear'
                  ? { label: 'Seguir registrando', onClick: handleSeguirRegistrando, variante: 'azul' }
                  : undefined
              }
              botonPrimario={{ label: 'Ok', onClick: handleOk, variante: 'rojo' }}
              onClose={handleOk}
            />
          )}

          {modal === 'cancelar' && (
            <ConfirmModal
              mensaje="¿Seguro quiere cancelar el registro?"
              botonSecundario={{ label: 'No', onClick: handleCancelarNo, variante: 'azul' }}
              botonPrimario={{ label: 'Sí', onClick: handleCancelarSi, variante: 'rojo' }}
              onClose={handleCancelarNo}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default Convocatorias