import { useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  getLineas,
  addLinea,
  editarLinea,
  eliminarLinea,
  toggleLineaActiva,
  type Linea,
  type CategoriaLinea,
} from '../lib/lineasInvestigacion'
import './LineasInvestigacion.css'

type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

const textos: Record<CategoriaLinea, {
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

function LineasInvestigacion() {
  const [tab, setTab] = useState<CategoriaLinea>('investigacion')
  const [lineas, setLineas] = useState<Linea[]>(getLineas())
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreForm, setNombreForm] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)

  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const t = textos[tab]

  const refrescar = () => setLineas([...getLineas()])

  const abrirCrear = () => {
    setNombreForm('')
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (l: Linea) => {
    setNombreForm(l.nombre)
    setEditandoId(l.id)
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
      editarLinea(editandoId, nombreForm.trim())
    } else {
      addLinea(nombreForm.trim(), tab)
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
    toggleLineaActiva(id)
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
      eliminarLinea(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  const lineasFiltradas = lineas.filter(
    (l) => l.categoria === tab && l.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const lineaAEliminar = lineas.find((l) => l.id === eliminarId) ?? null

  return (
    <div className="li-page">
      <div className="li-tabs">
        <button
          type="button"
          className={`li-tab ${tab === 'investigacion' ? 'li-tab-active' : ''}`}
          onClick={() => setTab('investigacion')}
        >
          Línea de investigación
        </button>
        <button
          type="button"
          className={`li-tab ${tab === 'medular' ? 'li-tab-active' : ''}`}
          onClick={() => setTab('medular')}
        >
          Línea medular
        </button>
      </div>

      <div className="li-toolbar">
        <button type="button" className="li-add-btn" onClick={abrirCrear}>
          <FilePlus size={16} />
          {t.addBtn}
        </button>

        <div className="li-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={t.buscarPlaceholder}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
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
                  onClick={() => abrirEditar(l)}
                >
                  <SquarePen size={16} />
                </button>

                <button
                  type="button"
                  className="li-delete-btn"
                  aria-label="Eliminar"
                  onClick={() => pedirEliminar(l.id)}
                >
                  <Trash2 size={16} />
                </button>

                <label className="li-switch">
                  <input
                    type="checkbox"
                    checked={l.activa}
                    onChange={() => handleToggle(l.id)}
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

        {eliminarId !== null && (
          <ConfirmModal
            mensaje={`¿Seguro que desea eliminar "${lineaAEliminar?.nombre ?? 'esta línea'}"?`}
            botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
            botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
            onClose={cancelarEliminar}
          />
        )}
      </div>

      {modoFormulario && (
        <div className="li-modal-overlay">
          <div className="li-modal-wrapper">
            <div className="li-modal-box">
              <button type="button" className="li-modal-close" onClick={cerrarForm} aria-label="Cerrar">
                <X size={16} />
              </button>

              <h2 className="li-modal-title">
                {modoFormulario === 'editar' ? t.modalTituloEditar : t.modalTituloCrear}
              </h2>

              <div className="li-modal-field">
                <label>{t.campoLabel}</label>
                <input
                  type="text"
                  value={nombreForm}
                  onChange={(e) => setNombreForm(e.target.value)}
                />
              </div>

              <div className="li-modal-actions">
                <button type="button" className="li-modal-registrar" onClick={handleRegistrar}>
                  {modoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                </button>
                <button type="button" className="li-modal-cancelar" onClick={handleCancelarClick}>
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

export default LineasInvestigacion