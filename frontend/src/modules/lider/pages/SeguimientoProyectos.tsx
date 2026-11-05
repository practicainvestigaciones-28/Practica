import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import * as liderApi from '../api/lider'
import VistaDetalleProyecto from '../../proyectos/components/VistaDetalleProyecto'
import { ApiError } from '../../../shared/api/client'
import { estadoConfig, etapaPrevia, mapearEstado } from '../../../shared/lib/estado'
import './SeguimientoProyectos.css'

type VistaLider = 'pendientes' | 'aprobados'

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO')
}

/**
 * Antes esta pantalla también tenía la tabla "Seguimiento de proyectos"
 * (proyectado/obtenido, para reportar ante la Vicerrectoría) como una
 * pestaña más — se movió a su propia pantalla de Administrador (ver
 * SeguimientoResultadosProyectos.tsx), porque esa consolidación institucional
 * le correspondía al Administrador, no al Líder. Aquí quedan las dos
 * responsabilidades propias del Líder sobre los proyectos de su grupo: dar
 * el visto bueno a los recién registrados, y ver en qué quedaron los que
 * ya aprobó.
 */
function SeguimientoProyectos() {
  // Al entrar a Proyectos se abre "Proyectos por aprobar", que es lo que el líder tiene pendiente.
  const [vista, setVista] = useState<VistaLider>('pendientes')

  const [pendientes, setPendientes] = useState<liderApi.ProyectoPendienteVistoBueno[]>([])
  const [cargandoPendientes, setCargandoPendientes] = useState(true)
  const [errorPendientes, setErrorPendientes] = useState('')
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [rechazoAbiertoId, setRechazoAbiertoId] = useState<number | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [detalleAbiertoId, setDetalleAbiertoId] = useState<number | null>(null)

  const [aprobados, setAprobados] = useState<liderApi.ProyectoAprobadoLider[]>([])
  const [cargandoAprobados, setCargandoAprobados] = useState(true)
  const [errorAprobados, setErrorAprobados] = useState('')
  const [aprobadoAbiertoId, setAprobadoAbiertoId] = useState<number | null>(null)

  const cargarPendientes = () => {
    setCargandoPendientes(true)
    setErrorPendientes('')
    liderApi
      .listarPendientesVistoBueno()
      .then(setPendientes)
      .catch((err) => setErrorPendientes(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos pendientes.'))
      .finally(() => setCargandoPendientes(false))
  }

  const cargarAprobados = () => {
    setCargandoAprobados(true)
    setErrorAprobados('')
    liderApi
      .listarAprobadosPorLider()
      .then(setAprobados)
      .catch((err) => setErrorAprobados(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos aprobados.'))
      .finally(() => setCargandoAprobados(false))
  }

  useEffect(() => {
    cargarPendientes()
    cargarAprobados()
  }, [])

  const handleDarVistoBueno = (id_proyecto: number) => {
    setProcesandoId(id_proyecto)
    liderApi
      .darVistoBueno(id_proyecto)
      .then(() => {
        setPendientes((actual) => actual.filter((p) => p.id_proyecto !== id_proyecto))
        cargarAprobados()
      })
      .catch((err) => setErrorPendientes(err instanceof ApiError ? err.message : 'No se pudo registrar el visto bueno.'))
      .finally(() => setProcesandoId(null))
  }

  const abrirRechazo = (id_proyecto: number) => {
    setRechazoAbiertoId(id_proyecto)
    setMotivoRechazo('')
  }

  const confirmarRechazo = () => {
    if (rechazoAbiertoId === null || !motivoRechazo.trim()) return
    const id_proyecto = rechazoAbiertoId
    setProcesandoId(id_proyecto)
    liderApi
      .rechazarProyectoPendiente(id_proyecto, motivoRechazo.trim())
      .then(() => {
        setPendientes((actual) => actual.filter((p) => p.id_proyecto !== id_proyecto))
        setRechazoAbiertoId(null)
      })
      .catch((err) => setErrorPendientes(err instanceof ApiError ? err.message : 'No se pudo rechazar el proyecto.'))
      .finally(() => setProcesandoId(null))
  }

  return (
    <div className="lider-page">
      <div className="lider-header-card">
        <h2>Proyectos</h2>
        <p>Gestiona el visto bueno de los proyectos de tu grupo y revisa en qué quedaron los que ya aprobaste.</p>
      </div>

      <div className="lider-tabs">
        <button type="button" className={`lider-tab ${vista === 'pendientes' ? 'lider-tab-activo' : ''}`} onClick={() => setVista('pendientes')}>
          Proyectos por aprobar{pendientes.length > 0 ? ` (${pendientes.length})` : ''}
        </button>
        <button type="button" className={`lider-tab ${vista === 'aprobados' ? 'lider-tab-activo' : ''}`} onClick={() => setVista('aprobados')}>
          Proyectos aprobados{aprobados.length > 0 ? ` (${aprobados.length})` : ''}
        </button>
      </div>

      {vista === 'aprobados' ? (
        <div className="lider-pendientes">
          <p className="lider-pendientes-intro">
            Proyectos a los que ya les diste el visto bueno, con el estado en que van ahora. Ábrelos para ver el proyecto completo.
          </p>
          {errorAprobados && <p className="lider-error">{errorAprobados}</p>}
          {cargandoAprobados && <p className="lider-vacio">Cargando...</p>}
          {!cargandoAprobados && aprobados.length === 0 && <p className="lider-vacio">Todavía no has dado el visto bueno a ningún proyecto.</p>}
          {aprobados.map((p) => {
            const expandido = aprobadoAbiertoId === p.id_proyecto
            const estado = mapearEstado(p.estado_actual)
            const enFasePrevia = ['pendiente_firmas', 'pendiente_lider', 'pendiente'].includes(p.estado_actual)
            return (
              <div className="lider-pendiente-card" key={p.id_proyecto}>
                <div className="lider-pendiente-fila">
                  <button
                    type="button"
                    className="lider-pendiente-toggle"
                    onClick={() => setAprobadoAbiertoId(expandido ? null : p.id_proyecto)}
                    aria-expanded={expandido}
                  >
                    {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="lider-pendiente-info">
                      <span className="lider-pendiente-titulo">{p.titulo}</span>
                      <span className="lider-pendiente-meta">
                        {p.creador.nombre} {p.creador.apellido} · {p.grupos.map((g) => g.grupo.nombre).join(', ')}
                        {p.convocatoria ? ` · Convocatoria ${p.convocatoria}` : ''} · Visto bueno el {fechaCorta(p.fecha_visto_bueno)}
                      </span>
                    </span>
                  </button>
                  <span className="lider-estado-badge" style={{ background: estadoConfig[estado].color, color: estadoConfig[estado].colorTexto }}>
                    {enFasePrevia ? etapaPrevia(p.estado_actual) : estado}
                  </span>
                </div>
                {expandido && (
                  <div className="lider-pendiente-detalle">
                    <VistaDetalleProyecto id_proyecto={p.id_proyecto} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="lider-pendientes">
          <p className="lider-pendientes-intro">
            Proyectos recién registrados por un investigador de tu grupo. Dale el visto bueno para que siga su curso hacia el Administrador, o recházalo si todavía necesita correcciones.
          </p>
          {errorPendientes && <p className="lider-error">{errorPendientes}</p>}
          {cargandoPendientes && <p className="lider-vacio">Cargando...</p>}
          {!cargandoPendientes && pendientes.length === 0 && (
            <p className="lider-vacio">No hay proyectos pendientes de tu visto bueno.</p>
          )}
          {pendientes.map((p) => {
            const expandido = detalleAbiertoId === p.id_proyecto
            return (
              <div className="lider-pendiente-card" key={p.id_proyecto}>
                <div className="lider-pendiente-fila">
                  <button
                    type="button"
                    className="lider-pendiente-toggle"
                    onClick={() => setDetalleAbiertoId(expandido ? null : p.id_proyecto)}
                    aria-expanded={expandido}
                  >
                    {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="lider-pendiente-info">
                      <span className="lider-pendiente-titulo">{p.titulo}</span>
                      <span className="lider-pendiente-meta">
                        {p.creador.nombre} {p.creador.apellido} · {p.grupos.map((g) => g.grupo.nombre).join(', ')} · {fechaCorta(p.fecha_registro)}
                      </span>
                    </span>
                  </button>
                  <div className="lider-pendiente-acciones">
                    <button
                      type="button"
                      className="lider-btn-rechazar"
                      onClick={() => abrirRechazo(p.id_proyecto)}
                      disabled={procesandoId === p.id_proyecto}
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      className="lider-btn-aprobar"
                      onClick={() => handleDarVistoBueno(p.id_proyecto)}
                      disabled={procesandoId === p.id_proyecto}
                    >
                      {procesandoId === p.id_proyecto ? 'Guardando...' : 'Dar visto bueno'}
                    </button>
                  </div>
                </div>
                {expandido && (
                  <div className="lider-pendiente-detalle">
                    <VistaDetalleProyecto id_proyecto={p.id_proyecto} />
                  </div>
                )}
              </div>
            )
          })}

          {rechazoAbiertoId !== null && (
            <div className="lider-rechazo-overlay">
              <div className="lider-rechazo-box">
                <h3>Rechazar proyecto</h3>
                <p>Explica el motivo: es obligatorio, el investigador lo necesita para saber qué corregir.</p>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Explica por qué se rechaza este proyecto..."
                />
                <div className="lider-rechazo-acciones">
                  <button type="button" className="lider-rechazo-cancelar" onClick={() => setRechazoAbiertoId(null)} disabled={procesandoId !== null}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="lider-rechazo-confirmar"
                    onClick={confirmarRechazo}
                    disabled={procesandoId !== null || !motivoRechazo.trim()}
                    title={!motivoRechazo.trim() ? 'Escribe el motivo del rechazo' : undefined}
                  >
                    {procesandoId !== null ? 'Rechazando...' : 'Rechazar y notificar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SeguimientoProyectos
