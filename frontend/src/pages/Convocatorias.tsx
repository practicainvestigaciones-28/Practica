import { useState, useEffect } from 'react'
import { FilePlus, Search, SquarePen, Trash2, Save, X as XIcon } from 'lucide-react'
import DateRangeCalendar, { CalendarIcon, formatearRango } from '../components/DateRangeCalendar'
import ConfirmModal from '../components/ConfirmModal'
import * as convocatoriasApi from '../api/convocatorias'
import type { ConvocatoriaBackend } from '../api/convocatorias'
import { ApiError } from '../api/client'
import {
  getPeriodos,
  addPeriodo,
  editarPeriodo,
  eliminarPeriodo,
  togglePeriodoActivo,
  type Periodo,
} from '../lib/periodos'
import {
  getProgramas,
  addPrograma,
  editarPrograma,
  eliminarPrograma,
  toggleProgramaActivo,
  type Programa,
  type TipoPrograma,
} from '../lib/programas'
import {
  getLineas,
  addLinea,
  editarLinea,
  eliminarLinea,
  toggleLineaActiva,
  type Linea,
  type CategoriaLinea,
} from '../lib/lineasInvestigacion'
import './Convocatorias.css'
import './ProgramasAcademicos.css'
import './LineasInvestigacion.css'

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

type Tab = 'convocatorias' | 'periodos' | 'programas' | 'lineas'
type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

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
  const [modal, setModal] = useState<ModalTipo>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminarId, setEliminarId] = useState<number | null>(null)

  // ---------- Estado: Períodos ----------
  const [periodos, setPeriodosState] = useState<Periodo[]>(getPeriodos())
  const [busquedaPeriodo, setBusquedaPeriodo] = useState('')
  const [periodoModoFormulario, setPeriodoModoFormulario] = useState<ModoFormulario>(null)
  const [periodoEditandoId, setPeriodoEditandoId] = useState<number | null>(null)
  const [periodoNombreForm, setPeriodoNombreForm] = useState('')
  const [periodoModal, setPeriodoModal] = useState<ModalTipo>(null)
  const [eliminarPeriodoId, setEliminarPeriodoId] = useState<number | null>(null)

  // ---------- Estado: Programas académicos ----------
  const [progSubTab, setProgSubTab] = useState<TipoPrograma>('pregrado')
  const [progItems, setProgItems] = useState<Programa[]>(getProgramas())
  const [busquedaPrograma, setBusquedaPrograma] = useState('')
  const [progModoFormulario, setProgModoFormulario] = useState<ModoFormulario>(null)
  const [progEditandoId, setProgEditandoId] = useState<number | null>(null)
  const [progNombreForm, setProgNombreForm] = useState('')
  const [progModal, setProgModal] = useState<ModalTipo>(null)
  const [progEliminarId, setProgEliminarId] = useState<number | null>(null)

  // ---------- Estado: Líneas de investigación ----------
  const [lineaSubTab, setLineaSubTab] = useState<CategoriaLinea>('investigacion')
  const [lineaItems, setLineaItems] = useState<Linea[]>(getLineas())
  const [busquedaLinea, setBusquedaLinea] = useState('')
  const [lineaModoFormulario, setLineaModoFormulario] = useState<ModoFormulario>(null)
  const [lineaEditandoId, setLineaEditandoId] = useState<number | null>(null)
  const [lineaNombreForm, setLineaNombreForm] = useState('')
  const [lineaModal, setLineaModal] = useState<ModalTipo>(null)
  const [lineaEliminarId, setLineaEliminarId] = useState<number | null>(null)

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
  }

  const abrirFormCrear = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirFormEditar = (c: Convocatoria) => {
    setNombre(c.nombre)
    setVigenciaInicio(c.vigenciaInicio)
    setVigenciaFin(c.vigenciaFin)
    setEditandoId(c.id)
    setModoFormulario('editar')
  }

  const handleGuardar = async () => {
    if (!nombre.trim() || !vigenciaInicio || !vigenciaFin) return

    setGuardando(true)
    try {
      const datos = {
        nombre: nombre.trim(),
        fecha_inicio: vigenciaInicio.toISOString(),
        fecha_fin: vigenciaFin.toISOString(),
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

  // ---------- Métodos: Períodos ----------
  const refrescarPeriodos = () => setPeriodosState([...getPeriodos()])

  const abrirPeriodoCrear = () => {
    setPeriodoNombreForm('')
    setPeriodoEditandoId(null)
    setPeriodoModoFormulario('crear')
  }

  const abrirPeriodoEditar = (p: Periodo) => {
    setPeriodoNombreForm(p.nombre)
    setPeriodoEditandoId(p.id)
    setPeriodoModoFormulario('editar')
  }

  const cerrarPeriodoForm = () => {
    setPeriodoModoFormulario(null)
    setPeriodoEditandoId(null)
    setPeriodoNombreForm('')
    setPeriodoModal(null)
  }

  const handleRegistrarPeriodo = () => {
    if (!periodoNombreForm.trim()) return

    if (periodoModoFormulario === 'editar' && periodoEditandoId !== null) {
      editarPeriodo(periodoEditandoId, periodoNombreForm.trim())
    } else {
      addPeriodo(periodoNombreForm.trim())
    }

    refrescarPeriodos()
    setPeriodoModal('exito')
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

  const handleTogglePeriodo = (id: number) => {
    togglePeriodoActivo(id)
    refrescarPeriodos()
  }

  const pedirEliminarPeriodo = (id: number) => {
    setEliminarPeriodoId(id)
  }

  const cancelarEliminarPeriodo = () => {
    setEliminarPeriodoId(null)
  }

  const confirmarEliminarPeriodo = () => {
    if (eliminarPeriodoId !== null) {
      eliminarPeriodo(eliminarPeriodoId)
      refrescarPeriodos()
    }
    setEliminarPeriodoId(null)
  }

  const periodosFiltrados = periodos.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaPeriodo.toLowerCase())
  )

  const periodoAEliminar = periodos.find((p) => p.id === eliminarPeriodoId) ?? null

  // ---------- Métodos: Programas académicos ----------
  const refrescarProgramas = () => setProgItems([...getProgramas()])

  const abrirProgCrear = () => {
    setProgNombreForm('')
    setProgEditandoId(null)
    setProgModoFormulario('crear')
  }

  const abrirProgEditar = (p: Programa) => {
    setProgNombreForm(p.nombre)
    setProgEditandoId(p.id)
    setProgModoFormulario('editar')
  }

  const cerrarProgForm = () => {
    setProgModoFormulario(null)
    setProgEditandoId(null)
    setProgNombreForm('')
    setProgModal(null)
  }

  const handleRegistrarPrograma = () => {
    if (!progNombreForm.trim()) return

    if (progModoFormulario === 'editar' && progEditandoId !== null) {
      editarPrograma(progEditandoId, progNombreForm.trim())
    } else {
      addPrograma(progNombreForm.trim(), progSubTab)
    }

    refrescarProgramas()
    setProgModal('exito')
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

  const handleToggleProg = (id: number) => {
    toggleProgramaActivo(id)
    refrescarProgramas()
  }

  const pedirEliminarPrograma = (id: number) => {
    setProgEliminarId(id)
  }

  const cancelarEliminarPrograma = () => {
    setProgEliminarId(null)
  }

  const confirmarEliminarPrograma = () => {
    if (progEliminarId !== null) {
      eliminarPrograma(progEliminarId)
      refrescarProgramas()
    }
    setProgEliminarId(null)
  }

  const programasFiltrados = progItems.filter(
    (p) => p.tipo === progSubTab && p.nombre.toLowerCase().includes(busquedaPrograma.toLowerCase())
  )

  const programaAEliminar = progItems.find((p) => p.id === progEliminarId) ?? null

  // ---------- Métodos: Líneas de investigación ----------
  const refrescarLineas = () => setLineaItems([...getLineas()])

  const abrirLineaCrear = () => {
    setLineaNombreForm('')
    setLineaEditandoId(null)
    setLineaModoFormulario('crear')
  }

  const abrirLineaEditar = (l: Linea) => {
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
    if (!lineaNombreForm.trim()) return

    if (lineaModoFormulario === 'editar' && lineaEditandoId !== null) {
      editarLinea(lineaEditandoId, lineaNombreForm.trim())
    } else {
      addLinea(lineaNombreForm.trim(), lineaSubTab)
    }

    refrescarLineas()
    setLineaModal('exito')
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

  const handleToggleLinea = (id: number) => {
    toggleLineaActiva(id)
    refrescarLineas()
  }

  const pedirEliminarLinea = (id: number) => {
    setLineaEliminarId(id)
  }

  const cancelarEliminarLinea = () => {
    setLineaEliminarId(null)
  }

  const confirmarEliminarLinea = () => {
    if (lineaEliminarId !== null) {
      eliminarLinea(lineaEliminarId)
      refrescarLineas()
    }
    setLineaEliminarId(null)
  }

  const lineasFiltradas = lineaItems.filter(
    (l) => l.categoria === lineaSubTab && l.nombre.toLowerCase().includes(busquedaLinea.toLowerCase())
  )

  const lineaAEliminar = lineaItems.find((l) => l.id === lineaEliminarId) ?? null

  const tLinea = textosLinea[lineaSubTab]

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
                  botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
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

              <div className="periodo-grid">
                {periodosFiltrados.map((p) => (
                  <div className="periodo-card" key={p.id}>
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
                        onClick={() => pedirEliminarPeriodo(p.id)}
                      >
                        <Trash2 size={16} />
                      </button>

                      <label className="conv-switch">
                        <input
                          type="checkbox"
                          checked={p.activo}
                          onChange={() => handleTogglePeriodo(p.id)}
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
                        >
                          {periodoModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
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
                <div className="prog-grid">
                  {programasFiltrados.map((p) => (
                    <div className="prog-card" key={p.id}>
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
                          onClick={() => pedirEliminarPrograma(p.id)}
                        >
                          <Trash2 size={16} />
                        </button>

                        <label className="prog-switch">
                          <input
                            type="checkbox"
                            checked={p.activo}
                            onChange={() => handleToggleProg(p.id)}
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

                      <div className="prog-modal-actions">
                        <button type="button" className="prog-modal-registrar" onClick={handleRegistrarPrograma}>
                          {progModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
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
                            onChange={() => handleToggleLinea(l.id)}
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
                        <button type="button" className="li-modal-registrar" onClick={handleRegistrarLinea}>
                          {lineaModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
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