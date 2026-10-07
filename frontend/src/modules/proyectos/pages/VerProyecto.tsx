import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import * as proyectosApi from '../api/proyectos'
import * as reclamacionesApi from '../../reclamaciones/api/reclamaciones'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import { parsearComentariosPar } from '../../evaluaciones/lib/parEvaluador'
import { parsearChecklistComite } from '../../evaluaciones/lib/checklistComite'
import { estadoConfig, mapearEstado } from '../../../shared/lib/estado'
import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'
import './VerProyecto.css'

const camposContenido: { campo: keyof proyectosApi.ProyectoDetalle; label: string }[] = [
  { campo: 'resumen', label: 'Resumen' },
  { campo: 'planteamiento_problema', label: 'Planteamiento del problema' },
  { campo: 'pregunta_investigacion', label: 'Pregunta de investigación' },
  { campo: 'justificacion', label: 'Justificación' },
  { campo: 'marco_teorico', label: 'Marco teórico' },
  { campo: 'metodologia_preliminar', label: 'Metodología preliminar' },
  { campo: 'componente_etico', label: 'Componente ético' },
  { campo: 'funciones_estudiante_auxiliar', label: 'Funciones del estudiante auxiliar' },
]

const ETIQUETA_ESTADO_RECLAMO: Record<reclamacionesApi.EstadoReclamacion, string> = {
  pendiente: 'Pendiente de revisión',
  en_revision: 'En revisión',
  resuelta: 'Resuelta',
}

function VerProyecto() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [proyecto, setProyecto] = useState<proyectosApi.ProyectoDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [reclamacion, setReclamacion] = useState<reclamacionesApi.ReclamacionBackend | null>(null)
  const [mostrarFormReclamo, setMostrarFormReclamo] = useState(false)
  const [motivoReclamo, setMotivoReclamo] = useState('')
  const [enviandoReclamo, setEnviandoReclamo] = useState(false)
  const [errorReclamo, setErrorReclamo] = useState('')

  const [consolidado, setConsolidado] = useState<evaluacionesApi.EstadoConsolidado | null>(null)

  useEffect(() => {
    if (!id) return
    setCargando(true)
    setError('')
    proyectosApi
      .obtenerProyecto(Number(id))
      .then(setProyecto)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el proyecto.'))
      .finally(() => setCargando(false))

    evaluacionesApi
      .obtenerEstadoConsolidado(Number(id))
      .then(setConsolidado)
      .catch(() => setConsolidado(null))
  }, [id])

  // Solo el dueño del proyecto puede reclamar o editar (esta pantalla también
  // la abren Administrador/comités para revisar otros proyectos).
  const esDueño = !!proyecto && !!usuario && proyecto.creador.id_usuario === usuario.id_usuario

  useEffect(() => {
    if (!proyecto || !esDueño || mapearEstado(proyecto.estado_actual) !== 'Rechazado') {
      setReclamacion(null)
      return
    }
    reclamacionesApi
      .obtenerReclamacionDeProyecto(proyecto.id_proyecto)
      .then(setReclamacion)
      .catch(() => setReclamacion(null))
  }, [proyecto, esDueño])

  const volver = () => navigate(-1)

  const handleEnviarReclamo = () => {
    if (!proyecto || !motivoReclamo.trim()) return
    setEnviandoReclamo(true)
    setErrorReclamo('')
    reclamacionesApi
      .crearReclamacion(proyecto.id_proyecto, motivoReclamo.trim())
      .then((res) => {
        setReclamacion(res.reclamacion)
        setMostrarFormReclamo(false)
        setMotivoReclamo('')
      })
      .catch((err) => setErrorReclamo(err instanceof ApiError ? err.message : 'No se pudo presentar la reclamación.'))
      .finally(() => setEnviandoReclamo(false))
  }

  if (cargando) {
    return (
      <div className="ver-proyecto-page">
        <p className="ver-proyecto-msg">Cargando proyecto...</p>
      </div>
    )
  }

  if (error || !proyecto) {
    return (
      <div className="ver-proyecto-page">
        <div className="ver-proyecto-top">
          <button type="button" className="ver-proyecto-back" onClick={volver}>
            <ArrowLeft size={16} />
            Volver
          </button>
        </div>
        <p className="ver-proyecto-msg">{error || 'No se encontró el proyecto.'}</p>
      </div>
    )
  }

  const estado = mapearEstado(proyecto.estado_actual)
  const esperaCorrecciones = esDueño && (consolidado?.espera_correcciones ?? false)

  return (
    <div className="ver-proyecto-page">
      <div className="ver-proyecto-top">
        <button type="button" className="ver-proyecto-back" onClick={volver}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <h1 className="ver-proyecto-titulo">{proyecto.titulo}</h1>
        <span className="ver-proyecto-badge" style={{ background: estadoConfig[estado].color }}>
          {estado}
        </span>
        {((estado === 'Rechazado' && esDueño) || esperaCorrecciones) && (
          <button
            type="button"
            className="ver-proyecto-editar-btn"
            onClick={() => navigate(`/proyectos/editar/${proyecto.id_proyecto}`)}
          >
            <Pencil size={14} />
            Editar proyecto
          </button>
        )}
      </div>

      <div className="ver-proyecto-card">
        <div className="ver-proyecto-card-header">INFORMACIÓN GENERAL</div>
        <div className="ver-proyecto-grid">
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Investigador(a) principal</span>
            <span className="ver-proyecto-valor">
              {proyecto.creador.nombre} {proyecto.creador.apellido}
            </span>
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Correo</span>
            <span className="ver-proyecto-valor">{proyecto.creador.correo}</span>
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Convocatoria</span>
            <span className="ver-proyecto-valor">{proyecto.convocatoria?.nombre ?? '—'}</span>
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Modalidad</span>
            <span className="ver-proyecto-valor">{proyecto.modalidad?.nombre ?? '—'}</span>
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Tipo de proyecto</span>
            <span className="ver-proyecto-valor">{proyecto.tipoProyecto?.nombre ?? '—'}</span>
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Duración</span>
            <span className="ver-proyecto-valor">
              {proyecto.duracion_periodos ? `${proyecto.duracion_periodos} periodos` : '—'}
            </span>
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Lugar de ejecución</span>
            <span className="ver-proyecto-valor">
              {[proyecto.ciudad, proyecto.departamento].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Fecha de registro</span>
            <span className="ver-proyecto-valor">
              {new Date(proyecto.fecha_registro).toLocaleDateString('es-CO')}
            </span>
          </div>
        </div>
      </div>

      <div className="ver-proyecto-card">
        <div className="ver-proyecto-card-header">CONTENIDO DEL PROYECTO</div>
        <div className="ver-proyecto-secciones">
          {camposContenido.map(({ campo, label }) => (
            <div className="ver-proyecto-seccion" key={campo}>
              <h3>{label}</h3>
              <p>{(proyecto[campo] as string | null) || 'No especificado.'}</p>
            </div>
          ))}
        </div>
      </div>

      {esDueño && consolidado && consolidado.etapas_evaluadas.length > 0 && (
        <div className="ver-proyecto-card">
          <div className="ver-proyecto-card-header">EVALUACIÓN</div>
          <div className="ver-proyecto-evaluaciones">
            {consolidado.etapas_evaluadas.map((ev, i) => {
              const { criterios, observacionesGenerales } = parsearComentariosPar(ev.comentarios)
              const checklist = criterios.length === 0 ? parsearChecklistComite(ev.comentarios) : null
              const estadoEvaluacion = mapearEstado(ev.resultado.nombre)
              return (
                <div className="ver-proyecto-evaluacion-item" key={i}>
                  <div className="ver-proyecto-evaluacion-cabecera">
                    <span className="ver-proyecto-evaluacion-etapa">{ev.etapa.nombre.replace(/_/g, ' ')}</span>
                    <span
                      className="ver-proyecto-evaluacion-badge"
                      style={{ background: estadoConfig[estadoEvaluacion].color, color: estadoConfig[estadoEvaluacion].colorTexto }}
                    >
                      {estadoEvaluacion}
                    </span>
                  </div>

                  {criterios.length > 0 ? (
                    <div className="ver-proyecto-criterios">
                      {criterios.map((cr) => (
                        <div className="ver-proyecto-criterio-fila" key={cr.numero}>
                          <span className="ver-proyecto-criterio-nombre">
                            {cr.numero}. {cr.titulo}
                          </span>
                          <span className="ver-proyecto-criterio-puntaje">
                            {cr.puntaje}/{cr.maximoPuntos}
                          </span>
                          {cr.observacion && <span className="ver-proyecto-criterio-observacion">{cr.observacion}</span>}
                        </div>
                      ))}
                      {observacionesGenerales && (
                        <div className="ver-proyecto-observaciones-generales">
                          <strong>Observaciones generales:</strong> {observacionesGenerales}
                        </div>
                      )}
                    </div>
                  ) : checklist && checklist.items.length > 0 ? (
                    <div className="ver-proyecto-criterios">
                      {checklist.titulo && <p className="ver-proyecto-checklist-titulo">{checklist.titulo}</p>}
                      {checklist.items.map((item, idx) => (
                        <div className="ver-proyecto-criterio-fila" key={idx}>
                          <span className="ver-proyecto-criterio-nombre">{item.texto}</span>
                          <span className={`ver-proyecto-checklist-marca ver-proyecto-checklist-marca-${item.cumple ?? 'sin-marcar'}`}>
                            {item.cumple === 'si' ? 'SI' : item.cumple === 'no' ? 'NO' : 'Sin marcar'}
                          </span>
                          {item.observacion && <span className="ver-proyecto-criterio-observacion">{item.observacion}</span>}
                        </div>
                      ))}
                      {checklist.observacionFinal && (
                        <div className="ver-proyecto-observaciones-generales">
                          <strong>Observación final:</strong> {checklist.observacionFinal}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="ver-proyecto-evaluacion-comentarios">{ev.comentarios || 'Sin observaciones.'}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {estado === 'Rechazado' && esDueño && (
        <div className="ver-proyecto-card">
          <div className="ver-proyecto-card-header">RECLAMACIÓN</div>

          {reclamacion && (
            <div className="ver-proyecto-reclamo-existente">
              <p>
                <strong>Rechazado por:</strong> {reclamacion.etapa_rechazo}
              </p>
              <p>
                <strong>Tu reclamación:</strong> {reclamacion.motivo_reclamacion}
              </p>
              <p className={`ver-proyecto-reclamo-estado ver-proyecto-reclamo-estado-${reclamacion.estado}`}>
                {ETIQUETA_ESTADO_RECLAMO[reclamacion.estado]}
              </p>
              {reclamacion.respuesta && (
                <div className="ver-proyecto-reclamo-respuesta">
                  <strong>Respuesta del Administrador:</strong>
                  <p>{reclamacion.respuesta}</p>
                </div>
              )}
            </div>
          )}

          {!mostrarFormReclamo && (!reclamacion || reclamacion.estado === 'resuelta') && (
            <button type="button" className="ver-proyecto-reclamo-btn" onClick={() => setMostrarFormReclamo(true)}>
              {reclamacion ? 'Presentar nueva reclamación' : 'Presentar reclamación'}
            </button>
          )}

          {mostrarFormReclamo && (
            <div className="ver-proyecto-reclamo-form">
              <textarea
                placeholder="Explica por qué consideras que esta decisión debería revisarse..."
                value={motivoReclamo}
                onChange={(e) => setMotivoReclamo(e.target.value)}
              />
              {errorReclamo && <p className="ver-proyecto-reclamo-error">{errorReclamo}</p>}
              <div className="ver-proyecto-reclamo-form-acciones">
                <button
                  type="button"
                  className="ver-proyecto-reclamo-enviar"
                  onClick={handleEnviarReclamo}
                  disabled={enviandoReclamo || !motivoReclamo.trim()}
                >
                  {enviandoReclamo ? 'Enviando...' : 'Enviar reclamación'}
                </button>
                <button
                  type="button"
                  className="ver-proyecto-reclamo-cancelar"
                  onClick={() => {
                    setMostrarFormReclamo(false)
                    setMotivoReclamo('')
                    setErrorReclamo('')
                  }}
                  disabled={enviandoReclamo}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VerProyecto
