import { useEffect, useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import * as catalogosApi from '../api/catalogos'
import { ApiError } from '../api/client'
import './ProgramasAcademicos.css'

type TipoPrograma = 'pregrado' | 'posgrado'
type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

function ProgramasAcademicos() {
  const [tab, setTab] = useState<TipoPrograma>('pregrado')
  const [programas, setProgramas] = useState<catalogosApi.ProgramaItem[]>([])
  const [facultades, setFacultades] = useState<catalogosApi.FacultadItem[]>([])
  const [tiposPrograma, setTiposPrograma] = useState<catalogosApi.TipoProgramaItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreForm, setNombreForm] = useState('')
  const [facultadForm, setFacultadForm] = useState<number | null>(null)
  const [modal, setModal] = useState<ModalTipo>(null)
  const [guardando, setGuardando] = useState(false)

  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const cargarTodo = () => {
    setCargando(true)
    setError('')
    Promise.all([
      catalogosApi.listarProgramas(),
      catalogosApi.listarFacultades(),
      catalogosApi.listarTiposPrograma(),
    ])
      .then(([progs, facs, tipos]) => {
        setProgramas(progs)
        setFacultades(facs)
        setTiposPrograma(tipos)
        if (facultadForm === null && facs.length > 0) setFacultadForm(facs[0].id_facultad)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los programas.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const idTipoProgramaDelTab = tiposPrograma.find((t) => t.nombre === tab)?.id_tipo_programa ?? null

  const abrirCrear = () => {
    setNombreForm('')
    setEditandoId(null)
    setFacultadForm(facultades[0]?.id_facultad ?? null)
    setModoFormulario('crear')
  }

  const abrirEditar = (p: catalogosApi.ProgramaItem) => {
    setNombreForm(p.nombre)
    setEditandoId(p.id_programa)
    setFacultadForm(p.id_facultad)
    setModoFormulario('editar')
  }

  const cerrarForm = () => {
    setModoFormulario(null)
    setEditandoId(null)
    setNombreForm('')
    setModal(null)
  }

  const handleRegistrar = () => {
    if (!nombreForm.trim()) return
    setError('')
    setGuardando(true)

    const accion =
      modoFormulario === 'editar' && editandoId !== null
        ? catalogosApi.actualizarPrograma(editandoId, nombreForm.trim())
        : idTipoProgramaDelTab && facultadForm
          ? catalogosApi.crearPrograma(nombreForm.trim(), facultadForm, idTipoProgramaDelTab)
          : Promise.reject(new Error('Selecciona una facultad y verifica que el tipo de programa exista en el catálogo.'))

    accion
      .then(() => {
        cargarTodo()
        setModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : err.message || 'No se pudo guardar el programa.'))
      .finally(() => setGuardando(false))
  }

  const handleSeguirRegistrando = () => {
    setNombreForm('')
    setEditandoId(null)
    setModoFormulario('crear')
    setModal(null)
  }

  const handleOk = () => {
    cerrarForm()
  }

  const handleCancelarClick = () => {
    setModal('cancelar')
  }

  const handleCancelarNo = () => {
    setModal(null)
  }

  const handleCancelarSi = () => {
    cerrarForm()
  }

  const handleToggle = (p: catalogosApi.ProgramaItem) => {
    setError('')
    catalogosApi
      .cambiarEstadoPrograma(p.id_programa, !p.activo)
      .then(() => cargarTodo())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado del programa.'))
  }

  const pedirEliminar = (id: number) => {
    setEliminarId(id)
  }

  const cancelarEliminar = () => {
    setEliminarId(null)
  }

  // No hay borrado físico: proyectos y grupos ya pueden referenciar el
  // programa. "Eliminar" aquí desactiva, igual que el switch de la fila.
  const confirmarEliminar = () => {
    if (eliminarId !== null) {
      setError('')
      catalogosApi
        .cambiarEstadoPrograma(eliminarId, false)
        .then(() => cargarTodo())
        .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo desactivar el programa.'))
    }
    setEliminarId(null)
  }

  const programasFiltrados = programas.filter(
    (p) =>
      p.tipoPrograma?.nombre === tab && p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const programaAEliminar = programas.find((p) => p.id_programa === eliminarId) ?? null

  return (
    <div className="prog-page">
      <div className="prog-tabs">
        <button
          type="button"
          className={`prog-tab ${tab === 'pregrado' ? 'prog-tab-active' : ''}`}
          onClick={() => setTab('pregrado')}
        >
          Pregrado
        </button>
        <button
          type="button"
          className={`prog-tab ${tab === 'posgrado' ? 'prog-tab-active' : ''}`}
          onClick={() => setTab('posgrado')}
        >
          Posgrado
        </button>
      </div>

      <div className="prog-toolbar">
        <button type="button" className="prog-add-btn" onClick={abrirCrear}>
          <FilePlus size={16} />
          Añadir un programa
        </button>

        <div className="prog-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar programa"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="prog-empty" style={{ color: '#c0392b' }}>{error}</p>}

      <div className="prog-list-wrapper">
        {cargando ? (
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
                    onClick={() => abrirEditar(p)}
                  >
                    <SquarePen size={16} />
                  </button>

                  <button
                    type="button"
                    className="prog-delete-btn"
                    aria-label="Eliminar programa"
                    onClick={() => pedirEliminar(p.id_programa)}
                  >
                    <Trash2 size={16} />
                  </button>

                  <label className="prog-switch">
                    <input
                      type="checkbox"
                      checked={p.activo}
                      onChange={() => handleToggle(p)}
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

        {eliminarId !== null && (
          <ConfirmModal
            mensaje={`¿Seguro que desea eliminar "${programaAEliminar?.nombre ?? 'este programa'}"?`}
            botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
            botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
            onClose={cancelarEliminar}
          />
        )}
      </div>

      {modoFormulario && (
        <div className="prog-modal-overlay">
          <div className="prog-modal-wrapper">
            <div className="prog-modal-box">
              <button type="button" className="prog-modal-close" onClick={cerrarForm} aria-label="Cerrar">
                <X size={16} />
              </button>

              <h2 className="prog-modal-title">
                {modoFormulario === 'editar' ? 'Editar programa' : 'Registrar programa'}
              </h2>

              <div className="prog-modal-field">
                <label>Nombre del programa:</label>
                <input
                  type="text"
                  value={nombreForm}
                  onChange={(e) => setNombreForm(e.target.value)}
                />
              </div>

              {modoFormulario === 'crear' && (
                <div className="prog-modal-field">
                  <label>Facultad:</label>
                  <select
                    value={facultadForm ?? ''}
                    onChange={(e) => setFacultadForm(Number(e.target.value))}
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
                <button type="button" className="prog-modal-registrar" onClick={handleRegistrar} disabled={guardando}>
                  {guardando ? 'Guardando...' : modoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                </button>
                <button type="button" className="prog-modal-cancelar" onClick={handleCancelarClick}>
                  Cancelar
                </button>
              </div>
            </div>

            {modal === 'exito' && (
              <ConfirmModal
                mensaje={
                  modoFormulario === 'editar'
                    ? 'Se han guardado los cambios exitosamente.'
                    : 'Registro de programa exitoso.'
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
                mensaje="Seguro quiere cancelar el registro?"
                botonSecundario={{ label: 'No', onClick: handleCancelarNo, variante: 'azul' }}
                botonPrimario={{ label: 'Sí', onClick: handleCancelarSi, variante: 'rojo' }}
                onClose={handleCancelarNo}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProgramasAcademicos
