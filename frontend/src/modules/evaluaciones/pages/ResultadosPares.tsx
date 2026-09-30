import { useEffect, useState } from 'react'
import { ArrowLeft, Send, User } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { ApiError } from '../../../shared/api/client'
import * as evaluacionesApi from '../api/evaluaciones'
import './ResultadosPares.css'

// IDs de etapa según el seed (backend/prisma/seed.ts, orden de creación):
// 1=General/Inicial, 2=Comite_Investigacion, 3=Etica, 4=Pares
const ID_ETAPA_PARES = 4

type Vista = 'lista' | 'detalle'

const etiquetaResultado: Record<string, string> = {
  aprobado: 'Aprobado',
  aprobado_con_correcciones: 'Aprobado con correcciones',
  rechazado: 'Rechazado',
  no_cumple: 'No cumple',
}

const colorResultado: Record<string, string> = {
  aprobado: '#27ae60',
  aprobado_con_correcciones: '#f2994a',
  rechazado: '#eb5757',
  no_cumple: '#eb5757',
}

function ResultadosPares() {
  const [proyectos, setProyectos] = useState<evaluacionesApi.ProyectoConCalificacionPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [vista, setVista] = useState<Vista>('lista')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<evaluacionesApi.CalificacionesParesPendientes | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const refrescar = () => {
    setCargando(true)
    setError('')
    evaluacionesApi
      .listarProyectosConCalificacionPendiente()
      .then(setProyectos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    refrescar()
  }, [])

  const abrirDetalle = (id_proyecto: number) => {
    setProyectoAbiertoId(id_proyecto)
    setVista('detalle')
    setError('')
    setDetalle(null)

    setCargandoDetalle(true)
    evaluacionesApi
      .obtenerCalificacionesParesPendientes(id_proyecto, ID_ETAPA_PARES)
      .then(setDetalle)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las calificaciones.'))
      .finally(() => setCargandoDetalle(false))
  }

  const volverALista = () => {
    setVista('lista')
    setProyectoAbiertoId(null)
  }

  const confirmarEnvio = () => {
    if (proyectoAbiertoId === null) return
    setEnviando(true)
    evaluacionesApi
      .enviarResultadoPares(proyectoAbiertoId, ID_ETAPA_PARES)
      .then(() => {
        setMostrarConfirmacion(false)
        volverALista()
        refrescar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo enviar el resultado.'))
      .finally(() => setEnviando(false))
  }

  if (cargando) {
    return (
      <div className="rpares-page">
        <p className="rpares-empty">Cargando proyectos...</p>
      </div>
    )
  }

  if (vista === 'lista') {
    return (
      <div className="rpares-page">
        <div className="rpares-header-card">
          <h2>Resultados de Pares pendientes de envío</h2>
          <p>Proyectos donde ambos pares evaluadores ya calificaron y falta confirmar el resultado</p>
        </div>

        {error && <p className="rpares-empty">{error}</p>}

        <div className="rpares-tabla">
          <div className="rpares-tabla-header">
            <span>Título</span>
            <span>Investigador</span>
            <span>Fecha de registro</span>
          </div>

          {proyectos.map((p) => (
            <button type="button" className="rpares-tabla-row" key={p.id_proyecto} onClick={() => abrirDetalle(p.id_proyecto)}>
              <span className="rpares-fila-titulo">{p.titulo}</span>
              <span>{p.creador.nombre} {p.creador.apellido}</span>
              <span>{new Date(p.fecha_registro).toLocaleDateString()}</span>
            </button>
          ))}

          {proyectos.length === 0 && <p className="rpares-empty">No hay resultados de Pares pendientes de envío.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="rpares-page">
      <button type="button" className="rpares-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver
      </button>

      {error && <p className="rpares-empty">{error}</p>}

      {cargandoDetalle && <p className="rpares-empty">Cargando calificaciones...</p>}

      {!cargandoDetalle && detalle && (
        <div className="rpares-detalle-card">
          <h2>{detalle.proyecto.titulo}</h2>

          <div className="rpares-calificaciones">
            {detalle.calificaciones.map((c, i) => (
              <div className="rpares-calificacion-item" key={i}>
                <div className="rpares-calificacion-evaluador">
                  <User size={14} />
                  {c.evaluador.nombre} {c.evaluador.apellido}
                </div>
                <div className="rpares-calificacion-puntaje">{c.puntaje ?? '—'} pts</div>
                <p className="rpares-calificacion-comentarios">{c.comentarios || 'Sin observaciones.'}</p>
              </div>
            ))}
          </div>

          <div className="rpares-promedio">
            <span>Promedio</span>
            <strong>{detalle.promedio ?? '—'} pts</strong>
            {detalle.resultado_sugerido && (
              <span
                className="rpares-resultado-badge"
                style={{ background: colorResultado[detalle.resultado_sugerido] ?? '#888' }}
              >
                {etiquetaResultado[detalle.resultado_sugerido] ?? detalle.resultado_sugerido}
              </span>
            )}
          </div>

          <button
            type="button"
            className="rpares-btn-enviar"
            onClick={() => setMostrarConfirmacion(true)}
            disabled={enviando}
          >
            <Send size={16} />
            Enviar resultado al investigador
          </button>
        </div>
      )}

      {mostrarConfirmacion && (
        <ConfirmModal
          mensaje="¿Enviar el resultado del promedio al investigador? Esta acción no se puede deshacer."
          botonSecundario={{ label: 'Cancelar', onClick: () => setMostrarConfirmacion(false), variante: 'azul' }}
          botonPrimario={{ label: 'Enviar', onClick: confirmarEnvio, variante: 'rojo' }}
          onClose={() => setMostrarConfirmacion(false)}
        />
      )}
    </div>
  )
}

export default ResultadosPares
