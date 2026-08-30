import { useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, Save, X as XIcon } from 'lucide-react'
import DateRangeCalendar, { CalendarIcon, formatearRango } from '../components/DateRangeCalendar'
import ConfirmModal from '../components/ConfirmModal'
import {
  getConvocatorias,
  addConvocatoria,
  editarConvocatoria,
  eliminarConvocatoria,
  toggleConvocatoria,
  type Convocatoria,
} from '../lib/convocatorias'
import {
  getPeriodos,
  addPeriodo,
  editarPeriodo,
  eliminarPeriodo,
  togglePeriodoActivo,
  type Periodo,
} from '../lib/periodos'
import './Convocatorias.css'

type Tab = 'convocatorias' | 'periodos'
type ModalTipo = 'exito' | 'cancelar' | null
type ModoFormulario = 'crear' | 'editar' | null

function Convocatorias() {
  const [tab, setTab] = useState<Tab>('convocatorias')

  // ---------- Estado: Convocatorias ----------

  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>(getConvocatorias())
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [vigenciaInicio, setVigenciaInicio] = useState<Date | null>(null)
  const [vigenciaFin, setVigenciaFin] = useState<Date | null>(null)
  const [modal, setModal] = useState<ModalTipo>(null)

  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const refrescar = () => setConvocatorias([...getConvocatorias()])

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

  const handleGuardar = () => {
    if (!nombre.trim()) return

    if (modoFormulario === 'editar' && editandoId !== null) {
      editarConvocatoria(editandoId, nombre.trim(), vigenciaInicio, vigenciaFin)
    } else {
      addConvocatoria(nombre.trim(), vigenciaInicio, vigenciaFin)
    }

    refrescar()
    setModal('exito')
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

  const handleToggle = (id: number) => {
    toggleConvocatoria(id)
    refrescar()
  }

  const pedirEliminar = (id: number) => {
    setEliminarId(id)
  }

  const cancelarEliminar = () => {
    setEliminarId(null)
  }

  const confirmarEliminar = () => {
    if (eliminarId !== null) {
      eliminarConvocatoria(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  const filtradas = convocatorias.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const convocatoriaAEliminar = convocatorias.find((c) => c.id === eliminarId) ?? null

  // ---------- Estado: Períodos ----------

  const [periodos, setPeriodosState] = useState<Periodo[]>(getPeriodos())
  const [busquedaPeriodo, setBusquedaPeriodo] = useState('')

  const [periodoModoFormulario, setPeriodoModoFormulario] = useState<ModoFormulario>(null)
  const [periodoEditandoId, setPeriodoEditandoId] = useState<number | null>(null)
  const [periodoNombreForm, setPeriodoNombreForm] = useState('')
  const [periodoModal, setPeriodoModal] = useState<ModalTipo>(null)
  const [eliminarPeriodoId, setEliminarPeriodoId] = useState<number | null>(null)

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
          </div>

          {tab === 'convocatorias' ? (
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
                {filtradas.map((c) => (
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
                        onChange={() => handleToggle(c.id)}
                      />
                      <span className="conv-switch-slider" />
                    </label>
                  </div>
                ))}

                {filtradas.length === 0 && (
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
          ) : (
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
                          : 'Registrar periódo de duración de un proyecto'}
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
                        mensaje="Seguro quiere cancelar el registro?"
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
              <button type="button" className="conv-registro-guardar" onClick={handleGuardar}>
                <Save size={16} />
                {modoFormulario === 'editar' ? 'Guardar cambios' : 'Añadir convocatoria'}
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