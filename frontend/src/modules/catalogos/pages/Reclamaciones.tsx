import { useState } from 'react'
import { MessageCircle, Search, Clock, CheckSquare } from 'lucide-react'
import { getReclamaciones, type EstadoReclamacion } from '../lib/reclamaciones'
import './Reclamaciones.css'

const estadoColor: Record<EstadoReclamacion, string> = {
  'Pendiente': '#f2c94c',
  'En revisión': '#8f9bb3',
  'Resuelta': '#27ae60',
}

function Reclamaciones() {
  const [busqueda, setBusqueda] = useState('')
  const reclamaciones = getReclamaciones()

  const total = reclamaciones.length
  const enRevision = reclamaciones.filter((r) => r.estado === 'En revisión').length
  const pendientes = reclamaciones.filter((r) => r.estado === 'Pendiente').length
  const resueltas = reclamaciones.filter((r) => r.estado === 'Resuelta').length

  const filtradas = reclamaciones.filter((r) =>
    [r.evaluacion, r.reclamante, r.respuesta].some((campo) =>
      campo.toLowerCase().includes(busqueda.toLowerCase())
    )
  )

  return (
    <div className="reclamo-page">
      <div className="reclamo-stats-grid">
        <div className="reclamo-stat-card">
          <MessageCircle size={18} className="reclamo-stat-icon" />
          <span className="reclamo-stat-label">Total de reclamaciones</span>
          <span className="reclamo-stat-badge" style={{ background: '#d9e3f3', color: '#263d70' }}>
            {total}
          </span>
        </div>

        <div className="reclamo-stat-card">
          <Search size={18} className="reclamo-stat-icon" />
          <span className="reclamo-stat-label">Reclamaciones en revisión</span>
          <span className="reclamo-stat-badge" style={{ background: '#e5e7ec', color: '#444' }}>
            {enRevision}
          </span>
        </div>

        <div className="reclamo-stat-card">
          <Clock size={18} className="reclamo-stat-icon" />
          <span className="reclamo-stat-label">Reclamaciones pendientes</span>
          <span className="reclamo-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>
            {pendientes}
          </span>
        </div>

        <div className="reclamo-stat-card">
          <CheckSquare size={18} className="reclamo-stat-icon" />
          <span className="reclamo-stat-label">Reclamaciones resueltas</span>
          <span className="reclamo-stat-badge" style={{ background: '#27ae60', color: '#ffffff' }}>
            {resueltas}
          </span>
        </div>
      </div>

      <div className="reclamo-table-card">
        <div className="reclamo-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar documento o reclamación"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="reclamo-table-header">
          <span>Evaluación</span>
          <span>Reclamante</span>
          <span>Respuesta</span>
          <span>Fecha</span>
          <span>Estado</span>
        </div>

        {filtradas.map((r) => (
          <div className="reclamo-row" key={r.id}>
            <span className="reclamo-cell reclamo-cell-evaluacion">{r.evaluacion}</span>
            <span className="reclamo-cell">{r.reclamante}</span>
            <span className="reclamo-cell">{r.respuesta}</span>
            <span className="reclamo-cell">{r.fecha}</span>
            <span className="reclamo-cell reclamo-cell-estado" style={{ color: estadoColor[r.estado] }}>
              {r.estado}
            </span>
          </div>
        ))}

        {filtradas.length === 0 && (
          <p className="reclamo-empty">No se encontraron reclamaciones.</p>
        )}
      </div>
    </div>
  )
}

export default Reclamaciones