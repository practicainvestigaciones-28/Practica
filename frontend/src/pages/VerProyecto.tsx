import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import * as proyectosApi from '../api/proyectos'
import { estadoConfig, mapearEstado } from '../lib/estado'
import { ApiError } from '../api/client'
import './VerProyecto.css'

/** Campos narrativos del proyecto que se muestran tal cual, uno por
 * sección, con un texto de respaldo cuando el investigador no los llenó. */
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

function VerProyecto() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [proyecto, setProyecto] = useState<proyectosApi.ProyectoDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

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

  const volver = () => navigate(-1)

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
        <h1 className="ver-proyecto-titulo">{proyecto.titulo}</h1>
        <span className="ver-proyecto-badge" style={{ background: estadoConfig[estado].color }}>
          {estado}
        </span>
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
    </div>
  )
}

export default VerProyecto
