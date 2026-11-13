import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, PenLine, Pencil } from 'lucide-react'
import * as proyectosApi from '../api/proyectos'
import * as reclamacionesApi from '../../reclamaciones/api/reclamaciones'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import { criteriosEvaluacion, parsearComentariosPar } from '../../evaluaciones/lib/parEvaluador'

/** Puntaje máximo de la rúbrica del Par Evaluador (suma de los máximos de sus criterios). */
const PUNTAJE_MAXIMO_PARES = criteriosEvaluacion.reduce((s, c) => s + c.maximoPuntos, 0)
const formatoPuntaje = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
import { parsearChecklistComite } from '../../evaluaciones/lib/checklistComite'
import { estadoConfig, mapearEstado, etapaPrevia } from '../../../shared/lib/estado'
import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'
import { useCambios } from '../../../shared/realtime/RealtimeContext'
import DocumentosOriginales, { InsigniaHistorico } from '../components/DocumentosOriginales'
import VistaDetalleProyecto from '../components/VistaDetalleProyecto'
import VerProyectoBoton from '../components/VerProyectoBoton'
import './VerProyecto.css'

const camposContenido: { campo: keyof proyectosApi.ProyectoDetalle; label: string }[] = [
  { campo: 'resumen', label: 'Resumen' },
  { campo: 'planteamiento_problema', label: 'Planteamiento del problema' },
  { campo: 'pregunta_investigacion', label: 'Pregunta de investigación' },
  { campo: 'justificacion', label: 'Justificación' },
  { campo: 'marco_teorico', label: 'Marco teórico' },
  { campo: 'metodologia_preliminar', label: 'Metodología preliminar' },
  { campo: 'componente_etico', label: 'Componente ético' },
  { campo: 'fuentes_financiacion', label: 'Fuentes de financiación' },
  { campo: 'permisos_licencias', label: 'Permisos o licencias pertinentes' },
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
  // Cuando el proyecto no fue aprobado, la información del proyecto arranca oculta (la página queda corta y lo primero que se ve es la
  // evaluación); un botón la muestra u oculta. null = todavía no eligió: se usa el valor por defecto.
  const [visibilidadElegida, setVisibilidadElegida] = useState<boolean | null>(null)

  const cargarProyecto = (silencioso = false) => {
    if (!id) return
    if (!silencioso) {
      setCargando(true)
      setError('')
    }
    proyectosApi
      .obtenerProyecto(Number(id))
      .then(setProyecto)
      .catch((err) => {
        if (!silencioso) setError(err instanceof ApiError ? err.message : 'No se pudo cargar el proyecto.')
      })
      .finally(() => {
        if (!silencioso) setCargando(false)
      })

    evaluacionesApi
      .obtenerEstadoConsolidado(Number(id))
      .then(setConsolidado)
      .catch(() => setConsolidado(null))
  }

  useEffect(() => {
    cargarProyecto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useCambios(['proyecto-detalle', 'evaluaciones'], (payload) => {
    if (payload.recurso === 'proyecto-detalle' && payload.id_proyecto !== Number(id)) return
    cargarProyecto(true)
  })

  // Solo el dueño del proyecto puede reclamar o editar (esta pantalla también
  // la abren Administrador/comités para revisar otros proyectos).
  const esDueño = !!proyecto && !!usuario && proyecto.creador.id_usuario === usuario.id_usuario
  // El Par Evaluador evalúa a ciegas: no ve participantes, firmas, hojas de vida ni anexos (ver FirmasNoVisiblesError en el servidor).
  const esSoloPar = !!usuario && usuario.roles.length > 0 && usuario.roles.every((r) => r === 'Par Evaluador')

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

  const location = useLocation()
  // Si se llegó desde el formulario de edición, "Volver" va a la lista de
  // Proyectos (no de regreso al formulario); si no, a donde se venía.
  const volverA = (location.state as { volverA?: string } | null)?.volverA
  const volver = () => (volverA ? navigate(volverA) : navigate(-1))

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
  // El investigador cuyo proyecto no fue aprobado.
  const noAprobado = esDueño && estado === 'Rechazado'
  // Lo que sale de la calificación de los pares es definitivo: no se presentan reclamaciones.
  const rechazadoPorPares = estado === 'Rechazado' && consolidado?.etapa_actual?.nombre === 'Pares'

  // El investigador dueño solo ve la evaluación de la etapa donde está el proyecto (ej. los dos pares), no el historial
  // completo con Comité de Investigación y Comité de Ética de etapas ya superadas, que solo amontonaba información vieja.
  // Los demás roles (Administrador, comités) siguen viendo todo.
  const evaluacionesAMostrar =
    esDueño && consolidado?.etapa_actual
      ? consolidado.etapas_evaluadas.filter((ev) => ev.etapa.id_etapa === consolidado.etapa_actual!.id_etapa)
      : consolidado?.etapas_evaluadas ?? []

  // El investigador dueño puede ocultar la información del proyecto (la página es muy larga) cuando hay una evaluación que
  // revisar o el proyecto no fue aprobado. Si no fue aprobado, arranca oculta; null = todavía no eligió.
  const puedeOcultarInformacion = esDueño && !esSoloPar && (noAprobado || evaluacionesAMostrar.length > 0)
  const informacionVisible = !puedeOcultarInformacion || (visibilidadElegida ?? !noAprobado)

  // Puntaje final de Pares: el promedio de los pares (la última calificación de cada uno). Solo se muestra cuando
  // el Administrador ya envió el resultado; antes es provisional.
  const ultimaPorPar = new Map<number, number>()
  for (const ev of evaluacionesAMostrar) {
    if (ev.etapa.nombre === 'Pares' && ev.puntaje != null) ultimaPorPar.set(ev.evaluado_por.id_usuario, ev.puntaje)
  }
  const puntajesPares = [...ultimaPorPar.values()]
  const promedioPares =
    puntajesPares.length > 0 && !consolidado?.resultado_pares_pendiente
      ? puntajesPares.reduce((s, p) => s + p, 0) / puntajesPares.length
      : null

  return (
    <div className="ver-proyecto-page">
      <div className="ver-proyecto-top">
        <button type="button" className="ver-proyecto-back" onClick={volver}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <h1 className="ver-proyecto-titulo">{proyecto.titulo}</h1>
        <span className="ver-proyecto-badge" style={{ background: estadoConfig[estado].color }}>
          {estado === 'Rechazado' && consolidado?.etapa_actual?.nombre === 'Pares' ? 'No aprobado' : estado}
        </span>
        {proyecto.es_historico && <InsigniaHistorico />}
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
        {/* Aún no se ha guardado con todas las firmas: el dueño vuelve a
            Firmas y anexos para firmar, enviar la firma al co-investigador
            o dar "Guardar proyecto". */}
        {esDueño && proyecto.estado_actual === 'pendiente_firmas' && (
          <button
            type="button"
            className="ver-proyecto-editar-btn"
            onClick={() => navigate(`/proyectos/editar/${proyecto.id_proyecto}`, { state: { tab: 'firmas' } })}
          >
            <PenLine size={14} />
            Continuar con las firmas
          </button>
        )}
      </div>

      {proyecto.es_historico && <DocumentosOriginales idProyecto={proyecto.id_proyecto} />}

      {/* Antes de la información general, a la izquierda. El Par Evaluador ve solo el contenido del proyecto (sin este botón). */}
      {!esSoloPar && <VerProyectoBoton id_proyecto={proyecto.id_proyecto} conTexto />}

      {puedeOcultarInformacion && (
        <div>
          <button type="button" className="ver-proyecto-editar-btn" onClick={() => setVisibilidadElegida(!informacionVisible)}>
            {informacionVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            {informacionVisible ? 'Ocultar información del proyecto' : 'Mostrar información del proyecto'}
          </button>
        </div>
      )}

      {informacionVisible && (
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
            <span className="ver-proyecto-label">Etapa actual</span>
            <span className="ver-proyecto-valor">
              {consolidado?.etapa_actual
                ? `${consolidado.etapa_actual.nombre.replace(/_/g, ' ')}${consolidado.en_revision ? ' (en revisión)' : ''}`
                : etapaPrevia(proyecto.estado_actual)}
            </span>
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
      )}

      {/* Todo lo diligenciado: hojas de vida, participantes, grupos, objetivos, cronograma, resultados, componente ético y los anexos. */}
      {!informacionVisible ? null : esSoloPar ? (
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
      ) : (
        <VistaDetalleProyecto id_proyecto={proyecto.id_proyecto} ocultarBotonVerDocumento />
      )}

      {esDueño && consolidado && evaluacionesAMostrar.length > 0 && (
        <div className="ver-proyecto-card">
          <div className="ver-proyecto-card-header">EVALUACIÓN</div>
          <div className="ver-proyecto-evaluaciones">
            {evaluacionesAMostrar.map((ev, i) => {
              const { criterios, observacionesGenerales } = parsearComentariosPar(ev.comentarios)
              const checklist = criterios.length === 0 ? parsearChecklistComite(ev.comentarios) : null
              const estadoEvaluacion = mapearEstado(ev.resultado.nombre)
              // En Pares puede haber más de un evaluador — nunca se muestra su
              // nombre real (queda anónimo para el investigador), pero sí hay
              // que distinguir cuál evaluación es de cuál par. "Par N" se
              // numera según el orden en que evaluaron (fecha_evaluacion asc),
              // contando solo entre las filas de etapa "Pares" dentro de lo
              // que se está mostrando (no del historial completo, para que la
              // numeración no se desincronice cuando queda filtrado).
              const esPares = ev.etapa.nombre === 'Pares'
              const numeroPar = esPares
                ? evaluacionesAMostrar.slice(0, i + 1).filter((e) => e.etapa.nombre === 'Pares').length
                : null
              const etiquetaEtapa = esPares ? `Par ${numeroPar}` : ev.etapa.nombre.replace(/_/g, ' ')
              return (
                <div className="ver-proyecto-evaluacion-item" key={i}>
                  <div className="ver-proyecto-evaluacion-cabecera">
                    <span className="ver-proyecto-evaluacion-etapa">{etiquetaEtapa}</span>
                    <span
                      className="ver-proyecto-evaluacion-badge"
                      style={{ background: estadoConfig[estadoEvaluacion].color, color: estadoConfig[estadoEvaluacion].colorTexto }}
                    >
                      {estadoEvaluacion === 'Rechazado' && esPares ? 'No aprobado' : estadoEvaluacion}
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
                      {ev.puntaje != null && (
                        <div className="ver-proyecto-puntaje-total">
                          <span>Puntaje total</span>
                          <strong>
                            {formatoPuntaje(ev.puntaje)}/{PUNTAJE_MAXIMO_PARES}
                          </strong>
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
                      {checklist.seguimiento && (
                        <div className="ver-proyecto-observaciones-generales">
                          <strong>¿Requiere seguimiento del Comité de Ética?</strong>
<br />{checklist.seguimiento}
                        </div>
                      )}
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
            {promedioPares !== null && (
              <div className="ver-proyecto-puntaje-final">
                <span>
                  Puntaje final de la evaluación por pares
                  <small>Promedio de {puntajesPares.length === 1 ? '1 par' : `los ${puntajesPares.length} pares`}</small>
                </span>
                <strong>
                  {formatoPuntaje(promedioPares)}/{PUNTAJE_MAXIMO_PARES}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {estado === 'Rechazado' && esDueño && (!rechazadoPorPares || reclamacion) && (
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

          {!mostrarFormReclamo && !rechazadoPorPares && (!reclamacion || reclamacion.estado === 'resuelta') && (
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
