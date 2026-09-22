import { useEffect, useState } from 'react'
import {
  FileCheck, Clock, CheckSquare, XCircle, FileText, Search, ArrowLeft,
  Download, Upload, X as XIcon, ChevronDown,
} from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { estadoConfig } from '../../../shared/lib/estado'
import { ApiError } from '../../../shared/api/client'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as proyectosApi from '../../proyectos/api/proyectos'
import * as documentosApi from '../../proyectos/api/documentos'
import { cargarProyectosAsignados, type ProyectoEnRevision } from '../../evaluaciones/lib/bandejaEvaluacion'
import './ComiteEtica.css'

type Vista = 'panel' | 'lista' | 'detalle'
type CategoriaLista = 'asignados' | 'pendientes'
type Orden = 'titulo-asc' | 'titulo-desc'
type Accion = 'aprobar' | 'correcciones' | 'rechazar' | null

function ComiteEtica() {
  const [proyectos, setProyectos] = useState<ProyectoEnRevision[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [vista, setVista] = useState<Vista>('panel')
  const [categoriaLista, setCategoriaLista] = useState<CategoriaLista>('asignados')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('titulo-asc')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)

  const [resumen, setResumen] = useState('')
  const [anexos, setAnexos] = useState<documentosApi.DocumentoProyecto[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const [comentario, setComentario] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<Accion>(null)
  const [archivoFormato, setArchivoFormato] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const refrescar = () => {
    setCargando(true)
    setError('')
    cargarProyectosAsignados()
      .then(setProyectos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos asignados.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    refrescar()
  }, [])

  const remitidos = proyectos.filter((p) => p.abierta && p.estado === 'Pendiente').length
  const pendientes = proyectos.filter((p) => p.abierta && p.estado === 'En revisión').length
  const evaluados = proyectos.filter(
    (p) => p.resultadoFinal === 'aprobado' || p.resultadoFinal === 'aprobado_con_correcciones'
  ).length
  const rechazados = proyectos.filter(
    (p) => p.resultadoFinal === 'rechazado' || p.resultadoFinal === 'no_cumple'
  ).length

  const asignados = proyectos
  const pendientesAsignados = proyectos.filter((p) => p.abierta)

  const abrirLista = (categoria: CategoriaLista) => {
    setCategoriaLista(categoria)
    setBusqueda('')
    setVista('lista')
  }

  const abrirDetalle = (id_proyecto: number) => {
    setProyectoAbiertoId(id_proyecto)
    setComentario('')
    setArchivoFormato(null)
    setError('')
    setVista('detalle')

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

  const volverAPanel = () => setVista('panel')
  const volverALista = () => setVista('lista')

  const handleDescargarAnexo = (doc: documentosApi.DocumentoProyecto) => {
    documentosApi
      .descargarDocumentoProyecto(doc.id_proyecto, doc.id_proyecto_documento, doc.archivo)
      .catch(() => setError('No se pudo descargar el documento.'))
  }

  const handleCargarFormato = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Solo se registra el nombre del archivo junto a la evaluación, no se
    // guarda el contenido — no hay todavía un tipo de documento pensado
    // para el formato que carga el comité al evaluar.
    setArchivoFormato(file.name)
    e.target.value = ''
  }

  const confirmarAccion = () => {
    if (proyectoAbiertoId === null || !accionPendiente) return
    const proyecto = proyectos.find((p) => p.id_proyecto === proyectoAbiertoId)
    if (!proyecto) return

    const resultado: evaluacionesApi.ResultadoEvaluacion =
      accionPendiente === 'aprobar'
        ? 'aprobado'
        : accionPendiente === 'correcciones'
          ? 'aprobado_con_correcciones'
          : 'rechazado'

    setEnviando(true)
    evaluacionesApi
      .registrarEvaluacion(proyecto.id_proyecto, proyecto.id_etapa, {
        resultado,
        comentarios: comentario.trim() || undefined,
        formato_evaluacion: archivoFormato ?? undefined,
      })
      .then(() => {
        setAccionPendiente(null)
        setVista('lista')
        refrescar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo registrar la evaluación.'))
      .finally(() => setEnviando(false))
  }

  const listaBase = categoriaLista === 'asignados' ? asignados : pendientesAsignados

  const listaFiltrada = listaBase
    .filter((p) =>
      [p.titulo, p.investigadorPrincipal, p.convocatoria].some((campo) =>
        campo.toLowerCase().includes(busqueda.toLowerCase())
      )
    )
    .sort((a, b) => (orden === 'titulo-asc' ? a.titulo.localeCompare(b.titulo) : b.titulo.localeCompare(a.titulo)))

  const proyectoAbierto = proyectos.find((p) => p.id_proyecto === proyectoAbiertoId) ?? null

  if (cargando) {
    return (
      <div className="cetica-page">
        <p className="cetica-empty">Cargando proyectos asignados...</p>
      </div>
    )
  }

  if (vista === 'panel') {
    return (
      <div className="cetica-page">
        {error && <p className="cetica-empty">{error}</p>}

        <div className="cetica-stats-grid">
          <div className="cetica-stat-card">
            <FileText size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos remitidos</span>
            <span className="cetica-stat-badge" style={{ background: '#2f5fa8' }}>{remitidos}</span>
          </div>
          <div className="cetica-stat-card">
            <Clock size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos pendientes</span>
            <span className="cetica-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>{pendientes}</span>
          </div>
          <div className="cetica-stat-card">
            <CheckSquare size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos evaluados</span>
            <span className="cetica-stat-badge" style={{ background: '#27ae60' }}>{evaluados}</span>
          </div>
          <div className="cetica-stat-card">
            <XCircle size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos rechazados</span>
            <span className="cetica-stat-badge" style={{ background: '#c0392b' }}>{rechazados}</span>
          </div>
        </div>

        <div className="cetica-paneles">
          <div className="cetica-panel">
            <div className="cetica-panel-header cetica-panel-header-azul">Proyectos asignados</div>
            <div className="cetica-panel-lista">
              {asignados.slice(0, 3).map((p) => (
                <button type="button" className="cetica-panel-item" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
                  <FileText size={14} />
                  {p.titulo}
                </button>
              ))}
              {asignados.length === 0 && <p className="cetica-empty">No hay proyectos asignados.</p>}
            </div>
            <button type="button" className="cetica-ver-todos" onClick={() => abrirLista('asignados')}>
              Ver todos
            </button>
          </div>

          <div className="cetica-panel">
            <div className="cetica-panel-header cetica-panel-header-amarillo">Proyectos pendientes</div>
            <div className="cetica-panel-lista">
              {pendientesAsignados.slice(0, 3).map((p) => (
                <button type="button" className="cetica-panel-item" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
                  <FileCheck size={14} />
                  {p.titulo}
                </button>
              ))}
              {pendientesAsignados.length === 0 && <p className="cetica-empty">No hay proyectos pendientes.</p>}
            </div>
            <button type="button" className="cetica-ver-todos" onClick={() => abrirLista('pendientes')}>
              Ver todos
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'lista') {
    return (
      <div className="cetica-page">
        <button type="button" className="cetica-volver" onClick={volverAPanel}>
          <ArrowLeft size={16} />
          Volver al panel
        </button>

        {error && <p className="cetica-empty">{error}</p>}

        <div className="cetica-lista-header-card">
          <h2>Proyectos {categoriaLista === 'asignados' ? 'asignados' : 'pendientes'}</h2>
          <p>Listado de proyectos {categoriaLista === 'asignados' ? 'asignados al comité' : 'pendientes de evaluación'}</p>
        </div>

        <div className="cetica-filtros">
          <div className="cetica-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Busca por título, investigador o convocatoria"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="cetica-orden">
            <span>Ordenar por:</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="titulo-asc">Título A-Z</option>
              <option value="titulo-desc">Título Z-A</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="cetica-tabla">
          <div className="cetica-tabla-header">
            <span>Título</span>
            <span>Investigador principal</span>
            <span>Convocatoria</span>
            <span>Estado</span>
          </div>

          {listaFiltrada.map((p) => (
            <button type="button" className="cetica-tabla-row" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
              <span className="cetica-fila-titulo">{p.titulo}</span>
              <span>{p.investigadorPrincipal}</span>
              <span>{p.convocatoria}</span>
              <span className="cetica-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                {p.estado}
              </span>
            </button>
          ))}

          {listaFiltrada.length === 0 && (
            <p className="cetica-empty">No se encontraron proyectos.</p>
          )}
        </div>
      </div>
    )
  }

  if (!proyectoAbierto) {
    return (
      <div className="cetica-page">
        <p className="cetica-empty">No se encontró el proyecto.</p>
      </div>
    )
  }

  return (
    <div className="cetica-page">
      <button type="button" className="cetica-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver
      </button>

      {error && <p className="cetica-empty">{error}</p>}

      <h2 className="cetica-detalle-titulo-pagina">Detalles del proyecto para revisión del comité</h2>

      <div className="cetica-detalle-info">
        <div className="cetica-detalle-info-top">
          <div>
            <p className="cetica-detalle-proyecto-nombre">{proyectoAbierto.titulo}</p>
            <p>Estado: <strong>{proyectoAbierto.estado}</strong></p>
          </div>
          <div className="cetica-detalle-fechas">
            <span>Fecha de envío: {proyectoAbierto.fechaEnvio}</span>
            <span>Fecha límite de evaluación: {proyectoAbierto.fechaLimiteEvaluacion ?? 'Sin definir'}</span>
          </div>
        </div>

        <p className="cetica-resumen-label">Resumen de proyecto</p>
        <p className="cetica-resumen-texto">{cargandoDetalle ? 'Cargando...' : resumen || 'Sin resumen registrado.'}</p>
      </div>

      <div className="cetica-anexos">
        <h3>Anexos</h3>
        <div className="cetica-anexos-lista">
          {cargandoDetalle && <p className="cetica-empty">Cargando anexos...</p>}
          {!cargandoDetalle && anexos.map((doc) => (
            <div className="cetica-anexo-item" key={doc.id_proyecto_documento}>
              <FileText size={14} />
              <span>{doc.tipoDocumento.nombre}</span>
              <button type="button" aria-label="Descargar" onClick={() => handleDescargarAnexo(doc)}>
                <Download size={14} />
              </button>
            </div>
          ))}
          {!cargandoDetalle && anexos.length === 0 && (
            <p className="cetica-empty">Este proyecto todavía no tiene documentos cargados.</p>
          )}
        </div>
      </div>

      {proyectoAbierto.abierta ? (
        <div className="cetica-calificacion">
          <h3>Calificación del comité</h3>

          <div className="cetica-calificacion-body">
            <div className="cetica-carga-formato">
              <label className="cetica-carga-label">
                <Upload size={16} />
                {archivoFormato ?? 'Cargue aquí el formato de evaluación'}
                <input type="file" onChange={handleCargarFormato} />
              </label>
              {archivoFormato && (
                <button type="button" aria-label="Quitar archivo" onClick={() => setArchivoFormato(null)}>
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <textarea
              className="cetica-comentario"
              placeholder="Comentario..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />

            <div className="cetica-decision-botones">
              <button type="button" className="cetica-btn-aprobar" onClick={() => setAccionPendiente('aprobar')} disabled={enviando}>
                Aprobar
              </button>
              <button type="button" className="cetica-btn-correcciones" onClick={() => setAccionPendiente('correcciones')} disabled={enviando}>
                Correcciones
              </button>
              <button type="button" className="cetica-btn-rechazar" onClick={() => setAccionPendiente('rechazar')} disabled={enviando}>
                No aprobar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="cetica-resumen-texto">
          Esta etapa ya quedó cerrada para este proyecto — el resultado registrado fue: <strong>{proyectoAbierto.estado}</strong>.
        </p>
      )}

      {accionPendiente === 'aprobar' && (
        <ConfirmModal
          mensaje="Confirma la aprobación del proyecto?"
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}

      {accionPendiente === 'correcciones' && (
        <ConfirmModal
          mensaje="Confirma la aprobación con correcciones?"
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}

      {accionPendiente === 'rechazar' && (
        <ConfirmModal
          mensaje="Desea rechazar el proyecto en revisión?"
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}
    </div>
  )
}

export default ComiteEtica
