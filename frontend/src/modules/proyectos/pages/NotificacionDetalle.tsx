import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { NotificacionBackend } from '../../notificaciones/api/notificaciones'
import { formatearNotificacion } from '../lib/formatoNotificacion'
import * as proyectosApi from '../api/proyectos'
import './NotificacionDetalle.css'

/**
 * Los avisos de rechazo traen el motivo al final del mensaje ("… fue rechazado. Motivo: …"). Se separa para mostrarlo en
 * su propio recuadro; si el mensaje no tiene motivo, se muestra tal cual.
 */
function separarMotivo(mensaje: string): { texto: string; motivo: string | null } {
  const m = /^([\s\S]*?)\s*Motivo:\s*([\s\S]+)$/.exec(mensaje)
  return m && m[1].trim() && m[2].trim() ? { texto: m[1].trim(), motivo: m[2].trim() } : { texto: mensaje, motivo: null }
}

function NotificacionDetalle() {
  const navigate = useNavigate()
  const location = useLocation()
  const notificacion = location.state as NotificacionBackend | undefined

  // Algunos avisos (el de "Proyecto listo para asignar") no dicen quién es el investigador ni la convocatoria: se piden al servidor.
  const idProyecto = notificacion?.id_proyecto ?? null
  const pideDatosDelProyecto = notificacion ? Boolean(formatearNotificacion(notificacion.mensaje)?.datosDelProyecto) : false
  const [datosProyecto, setDatosProyecto] = useState<[string, string][]>([])
  useEffect(() => {
    if (!pideDatosDelProyecto || !idProyecto) return
    let vigente = true
    proyectosApi
      .obtenerProyecto(idProyecto)
      .then((p) => {
        if (vigente) setDatosProyecto([['Investigador(a)', `${p.creador.nombre} ${p.creador.apellido}`.trim()], ['Convocatoria', p.convocatoria?.nombre ?? '—']])
      })
      .catch(() => undefined) // sin esos datos el aviso se ve igual, solo sin esas dos líneas
    return () => {
      vigente = false
    }
  }, [pideDatosDelProyecto, idProyecto])

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
  // Con motivo (rechazos) se formatea solo la parte anterior: el motivo va en su propio recuadro rojo, más abajo.
  const formato = formatearNotificacion(motivo ? texto : mensaje)

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

      {formato ? (
        <>
          <p className="notif-detalle-descripcion">{formato.intro}</p>
          {formato.proyecto && <p className="notif-detalle-proyecto">"{formato.proyecto}"</p>}
          {[...formato.detalles, ...datosProyecto].length > 0 && (
            <ul className="notif-detalle-datos">
              {[...formato.detalles, ...datosProyecto].map(([etiqueta, valor]) => (
                <li key={etiqueta}>
                  <strong>{etiqueta}:</strong> {valor}
                </li>
              ))}
            </ul>
          )}
          {formato.cuadros.map((c, i) => (
            <div className={`notif-detalle-aviso notif-detalle-aviso-${c.tono}`} key={i}>
              {c.titulo && <h2 className="notif-detalle-aviso-titulo">{c.titulo}</h2>}
              <p>{c.texto}</p>
            </div>
          ))}
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
