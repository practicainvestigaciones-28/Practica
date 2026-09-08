import { useState } from 'react'
import { FilePlus, Search, SquarePen, Trash2, Plus, Eye, Save, X as XIcon, MessageCircle, Clock, CheckSquare } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  getEtapas,
  addEtapa,
  editarEtapa,
  eliminarEtapa,
  toggleEtapaActiva,
  type Etapa,
} from '../lib/etapas'
import { getReclamaciones, type EstadoReclamacion } from '../lib/reclamaciones'
import './FormatosEvaluacion.css'
import './Reclamaciones.css'

type TabPrincipal = 'etapas' | 'reclamaciones'
type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

const estadoColorReclamo: Record<EstadoReclamacion, string> = {
  'Pendiente': '#f2c94c',
  'En revisión': '#8f9bb3',
  'Resuelta': '#27ae60',
}

function FormatosEvaluacion() {
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>('etapas')

  // ---------- Estado: Etapas ----------
  const [etapas, setEtapas] = useState<Etapa[]>(getEtapas())
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreForm, setNombreForm] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)

  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const refrescar = () => setEtapas([...getEtapas()])

  const abrirCrear = () => {
    setNombreForm('')
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (e: Etapa) => {
    setNombreForm(e.nombre)
    setEditandoId(e.id)
    setModoFormulario('editar')
  }

  const cerrarForm = () => {
    setModoFormulario(null)
    setEditandoId(null)
    setNombreForm('')
    setModal(null)
  }

  const handleGuardar = () => {
    if (!nombreForm.trim()) return

    if (modoFormulario === 'editar' && editandoId !== null) {
      editarEtapa(editandoId, nombreForm.trim())
    } else {
      addEtapa(nombreForm.trim())
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
    toggleEtapaActiva(id)
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
      eliminarEtapa(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
  // Estos 3 botones (añadir, editar, ver formatos de una etapa) todavía
  // no abren nada real. Cuando tu compañero tenga los endpoints de
  // formatos por etapa, aquí se conecta la navegación/modal real.
  const handleFormatoAccion = (accion: 'añadir' | 'editar' | 'ver', etapa: Etapa) => {
    console.log(`Formatos de "${etapa.nombre}" — acción: ${accion} (modo prueba, sin backend todavía)`)
  }

  const etapasFiltradas = etapas.filter((e) =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const etapaAEliminar = etapas.find((e) => e.id === eliminarId) ?? null

  // ---------- Estado: Reclamaciones ----------
  const [busquedaReclamo, setBusquedaReclamo] = useState('')
  const reclamaciones = getReclamaciones()

  const totalReclamos = reclamaciones.length
  const reclamosEnRevision = reclamaciones.filter((r) => r.estado === 'En revisión').length
  const reclamosPendientes = reclamaciones.filter((r) => r.estado === 'Pendiente').length
  const reclamosResueltos = reclamaciones.filter((r) => r.estado === 'Resuelta').length

  const reclamosFiltrados = reclamaciones.filter((r) =>
    [r.evaluacion, r.reclamante, r.respuesta].some((campo) =>
      campo.toLowerCase().includes(busquedaReclamo.toLowerCase())
    )
  )

  return (
    <div className="etapa-page">
      <div className="fmt-tabs">
        <button
          type="button"
          className={`fmt-tab ${tabPrincipal === 'etapas' ? 'fmt-tab-active' : ''}`}
          onClick={() => setTabPrincipal('etapas')}
        >
          Formatos de evaluación
        </button>
        <button
          type="button"
          className={`fmt-tab ${tabPrincipal === 'reclamaciones' ? 'fmt-tab-active' : ''}`}
          onClick={() => setTabPrincipal('reclamaciones')}
        >
          Reclamaciones
        </button>
      </div>

      {tabPrincipal === 'etapas' && (
        <>
          <div className="etapa-toolbar">
            <button type="button" className="etapa-add-btn" onClick={abrirCrear}>
              <FilePlus size={16} />
              Añadir etapa
            </button>

            <div className="etapa-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar por etapa o formato"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="etapa-list-wrapper">
            <div className="etapa-list">
              {etapasFiltradas.map((e) => (
                <div className="etapa-card" key={e.id}>
                  <span className="etapa-nombre">{e.nombre}</span>

                  <span className="etapa-divider" />

                  <div className="etapa-formatos">
                    <span className="etapa-formatos-label">Formatos</span>
                    <div className="etapa-formatos-botones">
                      <button
                        type="button"
                        className="etapa-formato-btn etapa-formato-btn-add"
                        aria-label="Añadir formato"
                        onClick={() => handleFormatoAccion('añadir', e)}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        className="etapa-formato-btn"
                        aria-label="Editar formatos"
                        onClick={() => handleFormatoAccion('editar', e)}
                      >
                        <SquarePen size={14} />
                      </button>
                      <button
                        type="button"
                        className="etapa-formato-btn"
                        aria-label="Ver formatos"
                        onClick={() => handleFormatoAccion('ver', e)}
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>

                  <span className="etapa-divider" />

                  <button
                    type="button"
                    className="etapa-edit-btn"
                    aria-label="Editar etapa"
                    onClick={() => abrirEditar(e)}
                  >
                    <SquarePen size={16} />
                  </button>

                  <button
                    type="button"
                    className="etapa-delete-btn"
                    aria-label="Eliminar etapa"
                    onClick={() => pedirEliminar(e.id)}
                  >
                    <Trash2 size={16} />
                  </button>

                  <label className="etapa-switch">
                    <input
                      type="checkbox"
                      checked={e.activa}
                      onChange={() => handleToggle(e.id)}
                    />
                    <span className="etapa-switch-slider" />
                  </label>
                </div>
              ))}

              {etapasFiltradas.length === 0 && (
                <p className="etapa-empty">No se encontraron etapas.</p>
              )}
            </div>

            {eliminarId !== null && (
              <ConfirmModal
                mensaje={`¿Seguro que desea eliminar "${etapaAEliminar?.nombre ?? 'esta etapa'}"?`}
                botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
                botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
                onClose={cancelarEliminar}
              />
            )}
          </div>

          {modoFormulario && (
            <div className="etapa-modal-overlay">
              <div className="etapa-modal-wrapper">
                <div className="etapa-modal-box">
                  <button type="button" className="etapa-modal-close" onClick={cerrarForm} aria-label="Cerrar">
                    <XIcon size={16} />
                  </button>

                  <h2 className="etapa-modal-title">
                    {modoFormulario === 'editar' ? 'Editar etapa' : 'Registrar etapa'}
                  </h2>

                  <div className="etapa-modal-field">
                    <label>Nombre de la etapa:</label>
                    <input
                      type="text"
                      value={nombreForm}
                      onChange={(e) => setNombreForm(e.target.value)}
                    />
                  </div>

                  <div className="etapa-modal-actions">
                    <button type="button" className="etapa-modal-guardar" onClick={handleGuardar}>
                      <Save size={16} />
                      {modoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                    </button>
                    <button type="button" className="etapa-modal-cancelar" onClick={handleCancelarClick}>
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
                        : 'Registro de etapa exitoso.'
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
        </>
      )}

      {tabPrincipal === 'reclamaciones' && (
        <div className="reclamo-page">
          <div className="reclamo-stats-grid">
            <div className="reclamo-stat-card">
              <MessageCircle size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Total de reclamaciones</span>
              <span className="reclamo-stat-badge" style={{ background: '#d9e3f3', color: '#263d70' }}>
                {totalReclamos}
              </span>
            </div>

            <div className="reclamo-stat-card">
              <Search size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Reclamaciones en revisión</span>
              <span className="reclamo-stat-badge" style={{ background: '#e5e7ec', color: '#444' }}>
                {reclamosEnRevision}
              </span>
            </div>

            <div className="reclamo-stat-card">
              <Clock size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Reclamaciones pendientes</span>
              <span className="reclamo-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>
                {reclamosPendientes}
              </span>
            </div>

            <div className="reclamo-stat-card">
              <CheckSquare size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Reclamaciones resueltas</span>
              <span className="reclamo-stat-badge" style={{ background: '#27ae60', color: '#ffffff' }}>
                {reclamosResueltos}
              </span>
            </div>
          </div>

          <div className="reclamo-table-card">
            <div className="reclamo-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar documento o reclamación"
                value={busquedaReclamo}
                onChange={(e) => setBusquedaReclamo(e.target.value)}
              />
            </div>

            <div className="reclamo-table-header">
              <span>Evaluación</span>
              <span>Reclamante</span>
              <span>Respuesta</span>
              <span>Fecha</span>
              <span>Estado</span>
            </div>

            {reclamosFiltrados.map((r) => (
              <div className="reclamo-row" key={r.id}>
                <span className="reclamo-cell reclamo-cell-evaluacion">{r.evaluacion}</span>
                <span className="reclamo-cell">{r.reclamante}</span>
                <span className="reclamo-cell">{r.respuesta}</span>
                <span className="reclamo-cell">{r.fecha}</span>
                <span className="reclamo-cell reclamo-cell-estado" style={{ color: estadoColorReclamo[r.estado] }}>
                  {r.estado}
                </span>
              </div>
            ))}

            {reclamosFiltrados.length === 0 && (
              <p className="reclamo-empty">No se encontraron reclamaciones.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FormatosEvaluacion