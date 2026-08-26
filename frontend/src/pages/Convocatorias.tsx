import { useState } from 'react'
import { FilePlus, Search, SquarePen } from 'lucide-react'
import {
  getConvocatorias,
  addConvocatoria,
  toggleConvocatoria,
  type Convocatoria,
} from '../lib/convocatorias'
import {
  getPeriodos,
  addPeriodo,
  editarPeriodo,
  togglePeriodoActivo,
  type Periodo,
} from '../lib/periodos'
import './Convocatorias.css'

type Tab = 'convocatorias' | 'periodos'
<<<<<<< Updated upstream
=======
type ModalTipo = 'exito' | 'cancelar' | null
type ModoFormulario = 'crear' | 'editar' | null
>>>>>>> Stashed changes

function Convocatorias() {
  const [tab, setTab] = useState<Tab>('convocatorias')

  // ---------- Estado: Convocatorias ----------

  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>(getConvocatorias())
  const [busqueda, setBusqueda] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [mostrandoForm, setMostrandoForm] = useState(false)

  const refrescar = () => setConvocatorias([...getConvocatorias()])

  const handleAgregar = () => {
    if (!nuevoNombre.trim()) return
    addConvocatoria(nuevoNombre.trim())
    setNuevoNombre('')
    setMostrandoForm(false)
    refrescar()
  }

  const handleToggle = (id: number) => {
    toggleConvocatoria(id)
    refrescar()
  }

  const filtradas = convocatorias.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

<<<<<<< Updated upstream
=======
  const convocatoriaAEliminar = convocatorias.find((c) => c.id === eliminarId) ?? null

  // ---------- Estado: Períodos ----------

  const [periodos, setPeriodosState] = useState<Periodo[]>(getPeriodos())
  const [busquedaPeriodo, setBusquedaPeriodo] = useState('')

  const [periodoModoFormulario, setPeriodoModoFormulario] = useState<ModoFormulario>(null)
  const [periodoEditandoId, setPeriodoEditandoId] = useState<number | null>(null)
  const [periodoNombreForm, setPeriodoNombreForm] = useState('')
  const [periodoModal, setPeriodoModal] = useState<ModalTipo>(null)

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

  const periodosFiltrados = periodos.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaPeriodo.toLowerCase())
  )

>>>>>>> Stashed changes
  return (
    <div className="conv-page">
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
        <>
          <div className="conv-toolbar">
            <button
              type="button"
              className="conv-add-btn"
              onClick={() => setMostrandoForm(!mostrandoForm)}
            >
              <FilePlus size={16} />
              Añadir convocatoria
            </button>

<<<<<<< Updated upstream
            <div className="conv-search">
              <Search size={16} />
=======
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
>>>>>>> Stashed changes
              <input
                type="text"
                placeholder="Buscar convocatoria"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          {mostrandoForm && (
            <div className="conv-add-form">
              <input
                type="text"
                placeholder="Nombre de la convocatoria"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                autoFocus
              />
              <button type="button" className="conv-add-confirm" onClick={handleAgregar}>
                Guardar
              </button>
            </div>
          )}

          <div className="conv-list">
            {filtradas.map((c) => (
              <div className="conv-card" key={c.id}>
                <span className="conv-card-nombre">{c.nombre}</span>

                <div className="conv-card-proyectos">
                  <span className="conv-card-proyectos-label">Proyectos</span>
                  <span className="conv-card-proyectos-badge">{c.proyectos}</span>
                </div>

                <button type="button" className="conv-edit-btn" aria-label="Editar convocatoria">
                  <SquarePen size={16} />
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
        </>
      ) : (
        <div className="placeholder-page">
          <h2>Periódos — próximamente</h2>
        </div>
      )}
    </div>
  )
}

export default Convocatorias