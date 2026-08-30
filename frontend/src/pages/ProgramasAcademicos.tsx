import { useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, Save, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  getProgramas,
  addPrograma,
  editarPrograma,
  eliminarPrograma,
  toggleProgramaActivo,
  type Programa,
  type TipoPrograma,
} from '../lib/programas'
import './ProgramasAcademicos.css'

type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

function ProgramasAcademicos() {
  const [tab, setTab] = useState<TipoPrograma>('pregrado')
  const [programas, setProgramas] = useState<Programa[]>(getProgramas())
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreForm, setNombreForm] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)

  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const refrescar = () => setProgramas([...getProgramas()])

  const abrirCrear = () => {
    setNombreForm('')
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (p: Programa) => {
    setNombreForm(p.nombre)
    setEditandoId(p.id)
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

    if (modoFormulario === 'editar' && editandoId !== null) {
      editarPrograma(editandoId, nombreForm.trim())
    } else {
      addPrograma(nombreForm.trim(), tab)
    }

    refrescar()
    setModal('exito')
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

  const handleToggle = (id: number) => {
    toggleProgramaActivo(id)
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
      eliminarPrograma(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  const programasFiltrados = programas.filter(
    (p) => p.tipo === tab && p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const programaAEliminar = programas.find((p) => p.id === eliminarId) ?? null

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
                  onClick={() => abrirEditar(p)}
                >
                  <SquarePen size={16} />
                </button>

                <button
                  type="button"
                  className="prog-delete-btn"
                  aria-label="Eliminar programa"
                  onClick={() => pedirEliminar(p.id)}
                >
                  <Trash2 size={16} />
                </button>

                <label className="prog-switch">
                  <input
                    type="checkbox"
                    checked={p.activo}
                    onChange={() => handleToggle(p.id)}
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

              <div className="prog-modal-actions">
                <button type="button" className="prog-modal-registrar" onClick={handleRegistrar}>
                  {modoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
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