import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import * as proyectosApi from '../api/proyectos'
import * as reclamacionesApi from '../../reclamaciones/api/reclamaciones'
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

type FormEdicion = {
  titulo: string
  ciudad: string
  departamento: string
  duracion_periodos: string
  resumen: string
  planteamiento_problema: string
  pregunta_investigacion: string
  justificacion: string
  marco_teorico: string
  metodologia_preliminar: string
  componente_etico: string
  funciones_estudiante_auxiliar: string
}

function formDesdeProyecto(p: proyectosApi.ProyectoDetalle): FormEdicion {
  return {
    titulo: p.titulo ?? '',
    ciudad: p.ciudad ?? '',
    departamento: p.departamento ?? '',
    duracion_periodos: p.duracion_periodos != null ? String(p.duracion_periodos) : '',
    resumen: p.resumen ?? '',
    planteamiento_problema: p.planteamiento_problema ?? '',
    pregunta_investigacion: p.pregunta_investigacion ?? '',
    justificacion: p.justificacion ?? '',
    marco_teorico: p.marco_teorico ?? '',
    metodologia_preliminar: p.metodologia_preliminar ?? '',
    componente_etico: p.componente_etico ?? '',
    funciones_estudiante_auxiliar: p.funciones_estudiante_auxiliar ?? '',
  }
}

const camposEdicion: { campo: keyof FormEdicion; label: string }[] = [
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

  const [editando, setEditando] = useState(false)
  const [formEdicion, setFormEdicion] = useState<FormEdicion | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState('')

  useEffect(() => {
    if (!id) return
    setCargando(true)
    setError('')
    proyectosApi
      .obtenerProyecto(Number(id))
      .then(setProyecto)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el proyecto.'))
      .finally(() => setCargando(false))
  }, [id])

  // Solo el dueño del proyecto puede reclamar (esta pantalla también la
  // abren Administrador/comités para revisar otros proyectos).
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

  const abrirEdicion = () => {
    if (!proyecto) return
    setFormEdicion(formDesdeProyecto(proyecto))
    setErrorEdicion('')
    setEditando(true)
  }

  const cancelarEdicion = () => {
    setEditando(false)
    setFormEdicion(null)
    setErrorEdicion('')
  }

  const cambiarCampoEdicion = (campo: keyof FormEdicion, valor: string) => {
    setFormEdicion((actual) => (actual ? { ...actual, [campo]: valor } : actual))
  }

  const guardarEdicion = () => {
    if (!proyecto || !formEdicion) return

    const duracion = Number(formEdicion.duracion_periodos)
    if (!formEdicion.titulo.trim() || !formEdicion.ciudad.trim() || !formEdicion.departamento.trim() || !duracion) {
      setErrorEdicion('Completa título, ciudad, departamento y duración.')
      return
    }
    const faltante = camposEdicion.find(({ campo }) => !formEdicion[campo].trim())
    if (faltante) {
      setErrorEdicion(`Completa el campo "${faltante.label}".`)
      return
    }

    setGuardandoEdicion(true)
    setErrorEdicion('')
    proyectosApi
      .actualizarProyecto(proyecto.id_proyecto, {
        titulo: formEdicion.titulo.trim(),
        ciudad: formEdicion.ciudad.trim(),
        departamento: formEdicion.departamento.trim(),
        duracion_periodos: duracion,
        resumen: formEdicion.resumen.trim(),
        planteamiento_problema: formEdicion.planteamiento_problema.trim(),
        pregunta_investigacion: formEdicion.pregunta_investigacion.trim(),
        justificacion: formEdicion.justificacion.trim(),
        marco_teorico: formEdicion.marco_teorico.trim(),
        metodologia_preliminar: formEdicion.metodologia_preliminar.trim(),
        componente_etico: formEdicion.componente_etico.trim(),
        funciones_estudiante_auxiliar: formEdicion.funciones_estudiante_auxiliar.trim(),
      })
      .then(() => proyectosApi.obtenerProyecto(proyecto.id_proyecto))
      .then((actualizado) => {
        setProyecto(actualizado)
        setEditando(false)
        setFormEdicion(null)
      })
      .catch((err) => setErrorEdicion(err instanceof ApiError ? err.message : 'No se pudo guardar el proyecto.'))
      .finally(() => setGuardandoEdicion(false))
  }

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

  return (
    <div className="ver-proyecto-page">
      <div className="ver-proyecto-top">
        <button type="button" className="ver-proyecto-back" onClick={volver}>
          <ArrowLeft size={16} />
          Volver
        </button>
        {editando && formEdicion ? (
          <input
            className="ver-proyecto-titulo-input"
            value={formEdicion.titulo}
            onChange={(e) => cambiarCampoEdicion('titulo', e.target.value)}
          />
        ) : (
          <h1 className="ver-proyecto-titulo">{proyecto.titulo}</h1>
        )}
        <span className="ver-proyecto-badge" style={{ background: estadoConfig[estado].color }}>
          {estado}
        </span>
        {estado === 'Rechazado' && esDueño && !editando && (
          <button type="button" className="ver-proyecto-editar-btn" onClick={abrirEdicion}>
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
            <span className="ver-proyecto-label">Duración (periodos)</span>
            {editando && formEdicion ? (
              <input
                type="number"
                min={1}
                className="ver-proyecto-input"
                value={formEdicion.duracion_periodos}
                onChange={(e) => cambiarCampoEdicion('duracion_periodos', e.target.value)}
              />
            ) : (
              <span className="ver-proyecto-valor">
                {proyecto.duracion_periodos ? `${proyecto.duracion_periodos} periodos` : '—'}
              </span>
            )}
          </div>
          <div className="ver-proyecto-campo">
            <span className="ver-proyecto-label">Lugar de ejecución</span>
            {editando && formEdicion ? (
              <div className="ver-proyecto-campo-doble">
                <input
                  className="ver-proyecto-input"
                  placeholder="Ciudad"
                  value={formEdicion.ciudad}
                  onChange={(e) => cambiarCampoEdicion('ciudad', e.target.value)}
                />
                <input
                  className="ver-proyecto-input"
                  placeholder="Departamento"
                  value={formEdicion.departamento}
                  onChange={(e) => cambiarCampoEdicion('departamento', e.target.value)}
                />
              </div>
            ) : (
              <span className="ver-proyecto-valor">
                {[proyecto.ciudad, proyecto.departamento].filter(Boolean).join(', ') || '—'}
              </span>
            )}
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
          {editando && formEdicion
            ? camposEdicion.map(({ campo, label }) => (
                <div className="ver-proyecto-seccion" key={campo}>
                  <h3>{label}</h3>
                  <textarea
                    className="ver-proyecto-textarea"
                    value={formEdicion[campo]}
                    onChange={(e) => cambiarCampoEdicion(campo, e.target.value)}
                  />
                </div>
              ))
            : camposContenido.map(({ campo, label }) => (
                <div className="ver-proyecto-seccion" key={campo}>
                  <h3>{label}</h3>
                  <p>{(proyecto[campo] as string | null) || 'No especificado.'}</p>
                </div>
              ))}
        </div>

        {editando && (
          <div className="ver-proyecto-edicion-acciones">
            {errorEdicion && <p className="ver-proyecto-reclamo-error">{errorEdicion}</p>}
            <div className="ver-proyecto-edicion-botones">
              <button type="button" className="ver-proyecto-reclamo-enviar" onClick={guardarEdicion} disabled={guardandoEdicion}>
                {guardandoEdicion ? 'Guardando...' : 'Guardar y reenviar para revisión'}
              </button>
              <button type="button" className="ver-proyecto-reclamo-cancelar" onClick={cancelarEdicion} disabled={guardandoEdicion}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {estado === 'Rechazado' && esDueño && !editando && (
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
