import { useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  getModalidadTipoItems,
  addModalidadTipoItem,
  editarModalidadTipoItem,
  eliminarModalidadTipoItem,
  toggleModalidadTipoActivo,
  type ModalidadTipoItem,
  type CategoriaModalidadTipo,
} from '../lib/modalidadTipo'
import './ModalidadTipoProyecto.css'

type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

const textos: Record<CategoriaModalidadTipo, {
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

function ModalidadTipoProyecto() {
  const [tab, setTab] = useState<CategoriaModalidadTipo>('modalidad')
  const [items, setItems] = useState<ModalidadTipoItem[]>(getModalidadTipoItems())
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreForm, setNombreForm] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)

  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const t = textos[tab]

  const refrescar = () => setItems([...getModalidadTipoItems()])

  const abrirCrear = () => {
    setNombreForm('')
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (item: ModalidadTipoItem) => {
    setNombreForm(item.nombre)
    setEditandoId(item.id)
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
      editarModalidadTipoItem(editandoId, nombreForm.trim())
    } else {
      addModalidadTipoItem(nombreForm.trim(), tab)
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
    toggleModalidadTipoActivo(id)
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
      eliminarModalidadTipoItem(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  const itemsFiltrados = items.filter(
    (i) => i.categoria === tab && i.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const itemAEliminar = items.find((i) => i.id === eliminarId) ?? null

  return (
    <div className="mt-page">
      <div className="mt-tabs">
        <button
          type="button"
          className={`mt-tab ${tab === 'modalidad' ? 'mt-tab-active' : ''}`}
          onClick={() => setTab('modalidad')}
        >
          Modalidad de proyecto
        </button>
        <button
          type="button"
          className={`mt-tab ${tab === 'tipo' ? 'mt-tab-active' : ''}`}
          onClick={() => setTab('tipo')}
        >
          Tipo de proyecto
        </button>
      </div>

      <div className="mt-toolbar">
        <button type="button" className="mt-add-btn" onClick={abrirCrear}>
          <FilePlus size={16} />
          {t.addBtn}
        </button>

        <div className="mt-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={t.buscarPlaceholder}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-list-wrapper">
        <div className="mt-grid">
          {itemsFiltrados.map((item) => (
            <div className="mt-card" key={item.id}>
              <span className="mt-nombre">{item.nombre}</span>

              <div className="mt-actions">
                <button
                  type="button"
                  className="mt-edit-btn"
                  aria-label="Editar"
                  onClick={() => abrirEditar(item)}
                >
                  <SquarePen size={16} />
                </button>

                <button
                  type="button"
                  className="mt-delete-btn"
                  aria-label="Eliminar"
                  onClick={() => pedirEliminar(item.id)}
                >
                  <Trash2 size={16} />
                </button>

                <label className="mt-switch">
                  <input
                    type="checkbox"
                    checked={item.activo}
                    onChange={() => handleToggle(item.id)}
                  />
                  <span className="mt-switch-slider" />
                </label>
              </div>
            </div>
          ))}

          {itemsFiltrados.length === 0 && (
            <p className="mt-empty">No se encontraron resultados.</p>
          )}
        </div>

        {eliminarId !== null && (
          <ConfirmModal
            mensaje={`¿Seguro que desea eliminar "${itemAEliminar?.nombre ?? 'este elemento'}"?`}
            botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
            botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
            onClose={cancelarEliminar}
          />
        )}
      </div>

      {modoFormulario && (
        <div className="mt-modal-overlay">
          <div className="mt-modal-wrapper">
            <div className="mt-modal-box">
              <button type="button" className="mt-modal-close" onClick={cerrarForm} aria-label="Cerrar">
                <X size={16} />
              </button>

              <h2 className="mt-modal-title">
                {modoFormulario === 'editar' ? t.modalTituloEditar : t.modalTituloCrear}
              </h2>

              <div className="mt-modal-field">
                <label>{t.campoLabel}</label>
                <input
                  type="text"
                  value={nombreForm}
                  onChange={(e) => setNombreForm(e.target.value)}
                />
              </div>

              <div className="mt-modal-actions">
                <button type="button" className="mt-modal-registrar" onClick={handleRegistrar}>
                  {modoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                </button>
                <button type="button" className="mt-modal-cancelar" onClick={handleCancelarClick}>
                  Cancelar
                </button>
              </div>
            </div>

            {modal === 'exito' && (
              <ConfirmModal
                mensaje={modoFormulario === 'editar' ? 'Se han guardado los cambios exitosamente.' : t.exitoMensaje}
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

export default ModalidadTipoProyecto