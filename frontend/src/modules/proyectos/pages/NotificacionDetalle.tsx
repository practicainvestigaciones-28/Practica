import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { NotificacionBackend } from '../../notificaciones/api/notificaciones'
import './NotificacionDetalle.css'

/**
 * Los avisos de rechazo traen el motivo al final del mensaje ("… fue rechazado. Motivo: …"). Se separa para mostrarlo en
 * su propio recuadro; si el mensaje no tiene motivo, se muestra tal cual.
 */
function separarMotivo(mensaje: string): { texto: string; motivo: string | null } {
  const m = /^([\s\S]*?)\s*Motivo:\s*([\s\S]+)$/.exec(mensaje)
  return m && m[1].trim() && m[2].trim() ? { texto: m[1].trim(), motivo: m[2].trim() } : { texto: mensaje, motivo: null }
}

/**
 * El aviso al Administrador de que un comité aprobó un proyecto llega en una sola línea ("Comité de Investigación aprobó el
 * proyecto "…" — ya puedes asignarlo a la siguiente etapa."). Se separa en sus tres partes para mostrarlas en líneas aparte:
 * quién aprobó, el proyecto, y lo que se puede hacer ahora (en un recuadro verde). Sirve también para los avisos ya guardados.
 */
function separarAprobacion(mensaje: string): { etapa: string; proyecto: string; accion: string } | null {
  const m = /^(.+?) aprobó el proyecto "([\s\S]+)"\s*[—-]\s*(ya puedes asignarlo a la siguiente etapa)\.?$/i.exec(mensaje.trim())
  if (!m) return null
  const accion = m[3].charAt(0).toUpperCase() + m[3].slice(1)
  return { etapa: m[1].trim(), proyecto: m[2].trim(), accion: `${accion}.` }
}

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
  const { texto, motivo } = separarMotivo(mensaje)
  const aprobacion = separarAprobacion(mensaje)

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

      {aprobacion ? (
        <>
          <p className="notif-detalle-descripcion">{aprobacion.etapa} aprobó el siguiente proyecto:</p>
          <p className="notif-detalle-proyecto">"{aprobacion.proyecto}"</p>
          <div className="notif-detalle-aviso-ok">
            <p>{aprobacion.accion}</p>
          </div>
        </>
      ) : (
        <p className="notif-detalle-descripcion">{texto}</p>
      )}

      {motivo && (
        <div className="notif-detalle-motivo">
          <h2 className="notif-detalle-motivo-titulo">{/rechazad/i.test(texto) ? 'Motivo del rechazo' : 'Motivo'}</h2>
          <p className="notif-detalle-motivo-texto">{motivo}</p>
        </div>
      )}

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
