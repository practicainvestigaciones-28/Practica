import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { NotificacionBackend } from '../../notificaciones/api/notificaciones'
import './NotificacionDetalle.css'

function NotificacionDetalle() {
  const navigate = useNavigate()
  const location = useLocation()
  const notificacion = location.state as NotificacionBackend | undefined

  if (!notificacion) {
    return (
      <div className="notif-detalle-card">
        <button type="button" className="notif-detalle-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <p className="notif-detalle-vacio">
          No hay información de esta notificación disponible. Vuelve a abrirla desde la campana de notificaciones.
        </p>
      </div>
    )
  }

  const { titulo, fecha_notificacion, mensaje, enlace } = notificacion

  return (
    <div className="notif-detalle-card">
      <div className="notif-detalle-header">
        <button type="button" className="notif-detalle-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <span className="notif-detalle-fecha">{new Date(fecha_notificacion).toLocaleDateString('es-CO')}</span>
      </div>

      <h1 className="notif-detalle-titulo">{titulo}</h1>

      <p className="notif-detalle-descripcion">{mensaje}</p>

      {enlace && (
        <button type="button" className="notif-detalle-ir-btn" onClick={() => navigate(enlace)}>
          <ArrowRight size={16} />
          Ir al proyecto
        </button>
      )}
    </div>
  )
}

export default NotificacionDetalle
