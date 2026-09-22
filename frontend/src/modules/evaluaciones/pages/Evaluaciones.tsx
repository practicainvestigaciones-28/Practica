import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileText, Search, ArrowLeft, Download, ChevronDown, SquarePen } from 'lucide-react'
import { estadoConfig } from '../../../shared/lib/estado'
import { ApiError } from '../../../shared/api/client'
import * as proyectosApi from '../../proyectos/api/proyectos'
import * as documentosApi from '../../proyectos/api/documentos'
import { cargarProyectosAsignados, type ProyectoEnRevision } from '../lib/bandejaEvaluacion'
import './Evaluaciones.css'

type Vista = 'lista' | 'detalle'
type Orden = 'titulo-asc' | 'titulo-desc'

function Evaluaciones() {
  const navigate = useNavigate()

  const [proyectos, setProyectos] = useState<ProyectoEnRevision[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [vista, setVista] = useState<Vista>('lista')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('titulo-asc')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)

  const [resumen, setResumen] = useState('')
  const [anexos, setAnexos] = useState<documentosApi.DocumentoProyecto[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  useEffect(() => {
    setCargando(true)
    cargarProyectosAsignados()
      .then(setProyectos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos asignados.'))
      .finally(() => setCargando(false))
  }, [])

  const handleFormatoEvaluacion = () => {

    console.log('Descargar formato de evaluación (sin un archivo fijo definido todavía)')
  }

  const handleHistorialEvaluacion = () => {

    console.log('Consultar historial de evaluación (pendiente de vista dedicada)')
  }

  const handleDescargarAnexo = (doc: documentosApi.DocumentoProyecto) => {
    documentosApi
      .descargarDocumentoProyecto(doc.id_proyecto, doc.id_proyecto_documento, doc.archivo)
      .catch(() => setError('No se pudo descargar el documento.'))
  }

  const abrirDetalle = (id_proyecto: number) => {
    setProyectoAbiertoId(id_proyecto)
    setVista('detalle')
    setError('')

    setCargandoDetalle(true)
    Promise.all([
      proyectosApi.obtenerProyecto(id_proyecto),
      documentosApi.listarDocumentosProyecto(id_proyecto),
    ])
      .then(([proyecto, docs]) => {
        setResumen(proyecto.resumen ?? '')
        setAnexos(docs)
      })
      .catch(() => {
        setResumen('')
        setAnexos([])
      })
      .finally(() => setCargandoDetalle(false))
  }

  const volverALista = () => setVista('lista')

  const listaFiltrada = proyectos
    .filter((p) =>
      [p.titulo, p.investigadorPrincipal, p.convocatoria].some((campo) =>
        campo.toLowerCase().includes(busqueda.toLowerCase())
      )
    )
    .sort((a, b) => (orden === 'titulo-asc' ? a.titulo.localeCompare(b.titulo) : b.titulo.localeCompare(a.titulo)))

  const proyectoAbierto = proyectos.find((p) => p.id_proyecto === proyectoAbiertoId) ?? null

  if (cargando) {
    return (
      <div className="eval-page">
        <p className="eval-empty">Cargando proyectos asignados...</p>
      </div>
    )
  }

  if (vista === 'lista') {
    return (
      <div className="eval-page">
        {error && <p className="eval-empty">{error}</p>}

        <div className="eval-lista-header-card">
          <h2>Proyectos asignados</h2>
          <p>Listado de proyectos pendientes de evaluación</p>
        </div>

        <div className="eval-toolbar">
          <button type="button" className="eval-toolbar-btn" onClick={handleFormatoEvaluacion}>
            <FileText size={14} />
            Formato de evaluación
            <Download size={14} />
          </button>
          <button type="button" className="eval-toolbar-btn" onClick={handleHistorialEvaluacion}>
            <Clock size={14} />
            Historial de evaluación
            <span className="eval-toolbar-badge">Consultar</span>
          </button>
        </div>

        <div className="eval-filtros">
          <div className="eval-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Busca por título, investigador o convocatoria"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="eval-orden">
            <span>Ordenar por:</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="titulo-asc">Título A-Z</option>
              <option value="titulo-desc">Título Z-A</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="eval-tabla">
          <div className="eval-tabla-header">
            <span>Título</span>
            <span>Investigador principal</span>
            <span>Convocatoria</span>
            <span>Estado</span>
          </div>

          {listaFiltrada.map((p) => (
            <button type="button" className="eval-tabla-row" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
              <span className="eval-fila-titulo">{p.titulo}</span>
              <span>{p.investigadorPrincipal}</span>
              <span>{p.convocatoria}</span>
              <span className="eval-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                {p.estado}
              </span>
            </button>
          ))}

          {listaFiltrada.length === 0 && <p className="eval-empty">No se encontraron proyectos.</p>}
        </div>
      </div>
    )
  }

  if (!proyectoAbierto) {
    return (
      <div className="eval-page">
        <p className="eval-empty">No se encontró el proyecto.</p>
      </div>
    )
  }

  return (
    <div className="eval-page">
      <button type="button" className="eval-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver
      </button>

      {error && <p className="eval-empty">{error}</p>}

      <div className="eval-detalle-card">
        <div className="eval-detalle-top">
          <div>
            <h2>Detalles de proyecto para revisión</h2>
            <p className="eval-detalle-proyecto-nombre">{proyectoAbierto.titulo}</p>
          </div>
          <div className="eval-detalle-fechas">
            <span>Fecha de envío: {proyectoAbierto.fechaEnvio}</span>
            <span>Fecha límite de evaluación: {proyectoAbierto.fechaLimiteEvaluacion ?? 'Sin definir'}</span>
          </div>
        </div>

        <p className="eval-resumen-label">Resumen de proyecto</p>
        <p className="eval-resumen-texto">{cargandoDetalle ? 'Cargando...' : resumen || 'Sin resumen registrado.'}</p>

        <div className="eval-anexos">
          <h3>Anexos</h3>
          <div className="eval-anexos-lista">
            {!cargandoDetalle && anexos.map((doc) => (
              <div className="eval-anexo-item" key={doc.id_proyecto_documento}>
                <FileText size={14} />
                <span>{doc.tipoDocumento.nombre}</span>
                <button type="button" aria-label="Descargar" onClick={() => handleDescargarAnexo(doc)}>
                  <Download size={14} />
                </button>
              </div>
            ))}
            {!cargandoDetalle && anexos.length === 0 && (
              <p className="eval-empty">Este proyecto todavía no tiene documentos cargados.</p>
            )}
          </div>
        </div>

        {proyectoAbierto.abierta ? (
          <div className="eval-calificacion">
            <h3>Calificación del comité</h3>
            <button
              type="button"
              className="eval-realizar-calificacion"
              onClick={() =>
                navigate('/evaluaciones/calificar', {
                  state: { id_proyecto: proyectoAbierto.id_proyecto, id_etapa: proyectoAbierto.id_etapa, titulo: proyectoAbierto.titulo },
                })
              }
            >
              <SquarePen size={16} />
              Realizar calificación
            </button>
          </div>
        ) : (
          <p className="eval-resumen-texto">
            Esta etapa ya quedó cerrada para este proyecto — el resultado registrado fue: <strong>{proyectoAbierto.estado}</strong>.
          </p>
        )}
      </div>
    </div>
  )
}

export default Evaluaciones
