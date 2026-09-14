import { useEffect, useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import * as catalogosApi from '../api/catalogos'
import { ApiError } from '../api/client'
import {
  getLineas as getLineasMedularesLocal,
  addLinea as addLineaMedularLocal,
  editarLinea as editarLineaMedularLocal,
  eliminarLinea as eliminarLineaMedularLocal,
  toggleLineaActiva as toggleLineaMedularLocal,
  type Linea as LineaMedularLocal,
} from '../lib/lineasInvestigacion'
import './LineasInvestigacion.css'

type CategoriaLinea = 'investigacion' | 'medular'
type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

// Fila unificada para pintar ambas categorías con el mismo grid: la de
// investigación sale de BD real, la medular todavía no tiene catálogo propio
// en el backend (ver nota junto a categoria: 'medular' más abajo) y sigue
// viviendo en localStorage vía lib/lineasInvestigacion.ts.
interface FilaLinea {
  id: number
  nombre: string
  activa: boolean
}

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
  const [lineasBD, setLineasBD] = useState<catalogosApi.LineaInvestigacionItem[]>([])
  const [lineasMedulares, setLineasMedulares] = useState<LineaMedularLocal[]>(getLineasMedularesLocal())
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

  const cargarLineasBD = () => {
    setCargando(true)
    setError('')
    catalogosApi
      .listarLineasInvestigacion()
      .then(setLineasBD)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las líneas de investigación.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarLineasBD()
  }, [])

  const refrescarMedulares = () => setLineasMedulares([...getLineasMedularesLocal()])

  // Vista unificada de la pestaña activa
  const filas: FilaLinea[] =
    tab === 'investigacion'
      ? lineasBD.map((l) => ({ id: l.id_linea, nombre: l.nombre, activa: l.activa }))
      : lineasMedulares
          .filter((l) => l.categoria === 'medular')
          .map((l) => ({ id: l.id, nombre: l.nombre, activa: l.activa }))

  const abrirCrear = () => {
    setNombreForm('')
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (l: FilaLinea) => {
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

    if (tab === 'medular') {
      // Sin catálogo propio en backend todavía: sigue en localStorage.
      if (modoFormulario === 'editar' && editandoId !== null) {
        editarLineaMedularLocal(editandoId, nombreForm.trim())
      } else {
        addLineaMedularLocal(nombreForm.trim(), 'medular')
      }
      refrescarMedulares()
      setModal('exito')
      return
    }

    setError('')
    setGuardando(true)
    const accion =
      modoFormulario === 'editar' && editandoId !== null
        ? catalogosApi.actualizarLineaInvestigacion(editandoId, nombreForm.trim())
        : catalogosApi.crearLineaInvestigacion(nombreForm.trim())

    accion
      .then(() => {
        cargarLineasBD()
        setModal('exito')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la línea de investigación.'))
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

  const handleToggle = (fila: FilaLinea) => {
    if (tab === 'medular') {
      toggleLineaMedularLocal(fila.id)
      refrescarMedulares()
      return
    }
    setError('')
    catalogosApi
      .cambiarEstadoLineaInvestigacion(fila.id, !fila.activa)
      .then(() => cargarLineasBD())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.'))
  }

  const pedirEliminar = (id: number) => {
    setEliminarId(id)
  }

  const cancelarEliminar = () => {
    setEliminarId(null)
  }

  // Igual que en Programas Académicos: no hay borrado físico para la línea
  // de investigación real (grupos/proyectos ya la referencian), "Eliminar"
  // desactiva. La medular sí se borra: solo vive en localStorage.
  const confirmarEliminar = () => {
    if (eliminarId !== null) {
      if (tab === 'medular') {
        eliminarLineaMedularLocal(eliminarId)
        refrescarMedulares()
      } else {
        setError('')
        catalogosApi
          .cambiarEstadoLineaInvestigacion(eliminarId, false)
          .then(() => cargarLineasBD())
          .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo desactivar la línea.'))
      }
    }
    setEliminarId(null)
  }

  const lineasFiltradas = filas.filter((l) => l.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const lineaAEliminar = filas.find((l) => l.id === eliminarId) ?? null

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

      {error && <p className="li-empty" style={{ color: '#c0392b' }}>{error}</p>}

      <div className="li-list-wrapper">
        {tab === 'investigacion' && cargando ? (
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
                      onChange={() => handleToggle(l)}
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
                <button type="button" className="li-modal-registrar" onClick={handleRegistrar} disabled={guardando}>
                  {guardando ? 'Guardando...' : modoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
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
