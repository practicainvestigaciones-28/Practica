import { useEffect, useState } from 'react'
import { Search, MessageCircle, Clock, CheckSquare } from 'lucide-react'
import * as reclamacionesApi from '../../reclamaciones/api/reclamaciones'
import { ApiError } from '../../../shared/api/client'
import './Reclamaciones.css'

const estadoColorReclamo: Record<reclamacionesApi.EstadoReclamacion, string> = {
  pendiente: '#f2c94c',
  en_revision: '#8f9bb3',
  resuelta: '#27ae60',
}

const etiquetaEstadoReclamo: Record<reclamacionesApi.EstadoReclamacion, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  resuelta: 'Resuelta',
}

function Reclamaciones() {
  const [busquedaReclamo, setBusquedaReclamo] = useState('')
  const [reclamaciones, setReclamaciones] = useState<reclamacionesApi.ReclamacionBackend[]>([])
  const [cargandoReclamaciones, setCargandoReclamaciones] = useState(true)
  const [errorReclamaciones, setErrorReclamaciones] = useState('')
  const [respondiendoId, setRespondiendoId] = useState<number | null>(null)
  const [textoRespuesta, setTextoRespuesta] = useState('')
  const [enviandoAccion, setEnviandoAccion] = useState(false)

  const cargarReclamaciones = () => {
    setCargandoReclamaciones(true)
    setErrorReclamaciones('')
    reclamacionesApi
      .listarReclamaciones()
      .then(setReclamaciones)
      .catch((err) => setErrorReclamaciones(err instanceof ApiError ? err.message : 'No se pudieron cargar las reclamaciones.'))
      .finally(() => setCargandoReclamaciones(false))
  }

  useEffect(() => {
    cargarReclamaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMarcarEnRevision = (id: number) => {
    setEnviandoAccion(true)
    reclamacionesApi
      .marcarEnRevision(id)
      .then(cargarReclamaciones)
      .catch((err) => setErrorReclamaciones(err instanceof ApiError ? err.message : 'No se pudo actualizar la reclamación.'))
      .finally(() => setEnviandoAccion(false))
  }

  const abrirResponder = (id: number) => {
    setRespondiendoId(id)
    setTextoRespuesta('')
  }

  const handleEnviarRespuesta = () => {
    if (respondiendoId === null || !textoRespuesta.trim()) return
    setEnviandoAccion(true)
    reclamacionesApi
      .responderReclamacion(respondiendoId, textoRespuesta.trim())
      .then(() => {
        setRespondiendoId(null)
        setTextoRespuesta('')
        cargarReclamaciones()
      })
      .catch((err) => setErrorReclamaciones(err instanceof ApiError ? err.message : 'No se pudo enviar la respuesta.'))
      .finally(() => setEnviandoAccion(false))
  }

  const totalReclamos = reclamaciones.length
  const reclamosEnRevision = reclamaciones.filter((r) => r.estado === 'en_revision').length
  const reclamosPendientes = reclamaciones.filter((r) => r.estado === 'pendiente').length
  const reclamosResueltos = reclamaciones.filter((r) => r.estado === 'resuelta').length

  const reclamosFiltrados = reclamaciones.filter((r) =>
    [r.etapa_rechazo, `${r.usuarioReclamante.nombre} ${r.usuarioReclamante.apellido}`, r.respuesta ?? '', r.proyecto.titulo].some(
      (campo) => campo.toLowerCase().includes(busquedaReclamo.toLowerCase())
    )
  )

  return (
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
          <span>Acciones</span>
        </div>

        {cargandoReclamaciones && <p className="reclamo-empty">Cargando reclamaciones...</p>}
        {errorReclamaciones && <p className="reclamo-empty">{errorReclamaciones}</p>}

        {!cargandoReclamaciones &&
          reclamosFiltrados.map((r) => (
            <div key={r.id_reclamacion}>
              <div className="reclamo-row">
                <span className="reclamo-cell reclamo-cell-evaluacion">
                  {r.etapa_rechazo}
                  <small className="reclamo-cell-proyecto">{r.proyecto.titulo}</small>
                </span>
                <span className="reclamo-cell">
                  {r.usuarioReclamante.nombre} {r.usuarioReclamante.apellido}
                </span>
                <span className="reclamo-cell">{r.respuesta ?? 'Ninguna'}</span>
                <span className="reclamo-cell">{new Date(r.fecha_reclamacion).toLocaleDateString('es-CO')}</span>
                <span className="reclamo-cell reclamo-cell-estado" style={{ color: estadoColorReclamo[r.estado] }}>
                  {etiquetaEstadoReclamo[r.estado]}
                </span>
                <span className="reclamo-cell reclamo-cell-acciones">
                  {r.estado === 'pendiente' && (
                    <button
                      type="button"
                      className="reclamo-btn-secundario"
                      disabled={enviandoAccion}
                      onClick={() => handleMarcarEnRevision(r.id_reclamacion)}
                    >
                      Marcar en revisión
                    </button>
                  )}
                  {r.estado !== 'resuelta' && (
                    <button
                      type="button"
                      className="reclamo-btn-primario"
                      disabled={enviandoAccion}
                      onClick={() => abrirResponder(r.id_reclamacion)}
                    >
                      Responder
                    </button>
                  )}
                </span>
              </div>

              {respondiendoId === r.id_reclamacion && (
                <div className="reclamo-responder-form">
                  <p className="reclamo-motivo-original">
                    <strong>Motivo del investigador:</strong> {r.motivo_reclamacion}
                  </p>
                  <textarea
                    placeholder="Escribe la respuesta para el investigador..."
                    value={textoRespuesta}
                    onChange={(e) => setTextoRespuesta(e.target.value)}
                  />
                  <div className="reclamo-responder-acciones">
                    <button
                      type="button"
                      className="reclamo-btn-primario"
                      disabled={enviandoAccion || !textoRespuesta.trim()}
                      onClick={handleEnviarRespuesta}
                    >
                      {enviandoAccion ? 'Enviando...' : 'Enviar respuesta'}
                    </button>
                    <button
                      type="button"
                      className="reclamo-btn-secundario"
                      disabled={enviandoAccion}
                      onClick={() => setRespondiendoId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

        {!cargandoReclamaciones && reclamosFiltrados.length === 0 && (
          <p className="reclamo-empty">No se encontraron reclamaciones.</p>
        )}
      </div>
    </div>
  )
}

export default Reclamaciones
