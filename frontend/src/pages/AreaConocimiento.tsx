import { useState } from 'react'
import { BookPlus, Search, SquarePen, Trash2, Save, X as XIcon } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  getAreas,
  addArea,
  editarArea,
  eliminarArea,
  toggleAreaActiva,
  type AreaConocimiento,
} from '../lib/areasConocimiento'
import './AreaConocimiento.css'

type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

function AreaConocimientoPage() {
  const [areas, setAreas] = useState<AreaConocimiento[]>(getAreas())
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)
  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const refrescar = () => setAreas([...getAreas()])

  const resetForm = () => {
    setNombre('')
    setDescripcion('')
  }

  const abrirCrear = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (a: AreaConocimiento) => {
    setNombre(a.nombre)
    setDescripcion(a.descripcion)
    setEditandoId(a.id)
    setModoFormulario('editar')
  }

  const handleGuardar = () => {
    if (!nombre.trim()) return

    if (modoFormulario === 'editar' && editandoId !== null) {
      editarArea(editandoId, nombre.trim(), descripcion.trim())
    } else {
      addArea(nombre.trim(), descripcion.trim())
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
    toggleAreaActiva(id)
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
      eliminarArea(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  const areasFiltradas = areas.filter((a) =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const areaAEliminar = areas.find((a) => a.id === eliminarId) ?? null

  return (
    <div className="area-page">
      {!modoFormulario ? (
        <>
          <div className="area-toolbar">
            <button type="button" className="area-add-btn" onClick={abrirCrear}>
              <BookPlus size={16} />
              Añadir área de conocimiento
            </button>

            <div className="area-search">
              <input
                type="text"
                placeholder="Buscar por área"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
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
                <div className="area-row" key={a.id}>
                  <span className="area-nombre">{a.nombre}</span>
                  <span className="area-descripcion">{a.descripcion}</span>

                  <div className="area-acciones">
                    <button
                      type="button"
                      className="area-edit-btn"
                      aria-label="Editar área de conocimiento"
                      onClick={() => abrirEditar(a)}
                    >
                      <SquarePen size={16} />
                    </button>

                    <button
                      type="button"
                      className="area-delete-btn"
                      aria-label="Eliminar área de conocimiento"
                      onClick={() => pedirEliminar(a.id)}
                    >
                      <Trash2 size={16} />
                    </button>

                    <label className="area-switch">
                      <input
                        type="checkbox"
                        checked={a.activa}
                        onChange={() => handleToggle(a.id)}
                      />
                      <span className="area-switch-slider" />
                    </label>
                  </div>
                </div>
              ))}

              {areasFiltradas.length === 0 && (
                <p className="area-empty">No se encontraron áreas de conocimiento.</p>
              )}
            </div>

            {eliminarId !== null && (
              <ConfirmModal
                mensaje={`¿Seguro que desea eliminar "${areaAEliminar?.nombre ?? 'esta área'}"?`}
                botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
                botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
                onClose={cancelarEliminar}
              />
            )}
          </div>
        </>
      ) : (
        <div className="area-registro-wrapper">
          <div className="area-registro-card">
            <h2 className="area-registro-title">
              {modoFormulario === 'editar' ? 'Editar área de conocimiento' : 'Registro de área de conocimiento'}
            </h2>

            <div className="area-registro-field">
              <label>Nombre de área:</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="area-registro-field area-registro-field-textarea">
              <label>Descripción:</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
              />
            </div>

            <div className="area-registro-actions">
              <button type="button" className="area-registro-guardar" onClick={handleGuardar}>
                <Save size={16} />
                {modoFormulario === 'editar' ? 'Guardar cambios' : 'Añadir área'}
              </button>
              <button type="button" className="area-registro-cancelar" onClick={handleCancelarClick}>
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
                  : 'Registro de área exitoso.'
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
      )}
    </div>
  )
}

export default AreaConocimientoPage