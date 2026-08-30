import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Notificacion } from '../lib/notificaciones'
import './NotificacionDetalle.css'

function NotificacionDetalle() {
  const navigate = useNavigate()
  const location = useLocation()
  const notificacion = location.state as Notificacion | undefined

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

  const { titulo, fecha, descripcion, proyecto } = notificacion

  return (
    <div className="notif-detalle-card">
      <div className="notif-detalle-header">
        <button type="button" className="notif-detalle-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <span className="notif-detalle-fecha">{fecha}</span>
      </div>

      <h1 className="notif-detalle-titulo">{titulo}</h1>

      {proyecto ? (
        <>
          <div className="notif-detalle-info">
            <span>Proyecto {proyecto.titulo}</span>
            <span className="notif-detalle-fecha-envio">Fecha de envío: {proyecto.fechaEnvio}</span>
          </div>

          <p className="notif-detalle-estado">Estado: {proyecto.estado}</p>

          <p className="notif-detalle-observacion-label">Observación:</p>
          <div className="notif-detalle-observacion-box">
            {proyecto.observacion}
          </div>

          <button
            type="button"
            className="notif-detalle-ir-btn"
            onClick={() => navigate('/proyectos/observaciones', { state: { titulo: proyecto.titulo } })}
          >
            <ArrowRight size={16} />
            Ir al proyecto
          </button>
        </>
      ) : (
        <p className="notif-detalle-descripcion">{descripcion}</p>
      )}
    </div>
  )
}

export default NotificacionDetalle