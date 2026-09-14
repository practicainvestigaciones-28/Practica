import { useEffect, useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import * as catalogosApi from '../api/catalogos'
import { ApiError } from '../api/client'
import './ModalidadTipoProyecto.css'

type CategoriaModalidadTipo = 'modalidad' | 'tipo'
type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

interface FilaItem {
  id: number
  nombre: string
  activo: boolean
}

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
  const [modalidades, setModalidades] = useState<catalogosApi.ModalidadProyectoItem[]>([])
  const [tipos, setTipos] = useState<catalogosApi.TipoProyectoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreForm, setNombreForm] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)
  const [guardando, setGuardando] = useState(false)

  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const t = textos[tab]

  const cargarTodo = () => {
    setCargando(true)
    setError('')
    Promise.all([catalogosApi.listarModalidadesProyecto(), catalogosApi.listarTiposProyecto()])
      .then(([mods, tps]) => {
        setModalidades(mods)
        setTipos(tps)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los datos.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  const filas: FilaItem[] =
    tab === 'modalidad'
      ? modalidades.map((m) => ({ id: m.id_modalidad, nombre: m.nombre, activo: m.activo }))
      : tipos.map((tp) => ({ id: tp.id_tipo_proyecto, nombre: tp.nombre, activo: tp.activo }))

  const abrirCrear = () => {
    setNombreForm('')
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (item: FilaItem) => {
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
    setError('')
    setGuardando(true)

    const esEditar = modoFormulario === 'editar' && editandoId !== null
    const accion =
      tab === 'modalidad'
        ? esEditar
          ? catalogosApi.actualizarModalidadProyecto(editandoId!, nombreForm.trim())
          : catalogosApi.crearModalidadProyecto(nombreForm.trim())
        : esEditar
          ? catalogosApi.actualizarTipoProyecto(editandoId!, nombreForm.trim())
          : catalogosApi.crearTipoProyecto(nombreForm.trim())

    accion
      .then(() => {
        cargarTodo()
        setModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar.'))
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

  const handleToggle = (item: FilaItem) => {
    setError('')
    const accion =
      tab === 'modalidad'
        ? catalogosApi.cambiarEstadoModalidadProyecto(item.id, !item.activo)
        : catalogosApi.cambiarEstadoTipoProyecto(item.id, !item.activo)

    accion
      .then(() => cargarTodo())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.'))
  }

  const pedirEliminar = (id: number) => {
    setEliminarId(id)
  }

  const cancelarEliminar = () => {
    setEliminarId(null)
  }

  // Sin borrado físico: hay proyectos que ya referencian la modalidad/tipo.
  // "Eliminar" desactiva, igual que el switch de la fila.
  const confirmarEliminar = () => {
    if (eliminarId !== null) {
      setError('')
      const accion =
        tab === 'modalidad'
          ? catalogosApi.cambiarEstadoModalidadProyecto(eliminarId, false)
          : catalogosApi.cambiarEstadoTipoProyecto(eliminarId, false)

      accion
        .then(() => cargarTodo())
        .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo desactivar.'))
    }
    setEliminarId(null)
  }

  const itemsFiltrados = filas.filter((i) => i.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const itemAEliminar = filas.find((i) => i.id === eliminarId) ?? null

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

      {error && <p className="mt-empty" style={{ color: '#c0392b' }}>{error}</p>}

      <div className="mt-list-wrapper">
        {cargando ? (
          <p className="mt-empty">Cargando...</p>
        ) : (
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
                      onChange={() => handleToggle(item)}
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
        )}

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
                <button type="button" className="mt-modal-registrar" onClick={handleRegistrar} disabled={guardando}>
                  {guardando ? 'Guardando...' : modoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
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
