import { useEffect, useState } from 'react'
import {
  FileText, Clock, CheckSquare, Search, ArrowLeft, Download, Upload, X as XIcon, ChevronDown,
} from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { estadoConfig } from '../../../shared/lib/estado'
import { ApiError } from '../../../shared/api/client'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as documentosApi from '../../proyectos/api/documentos'
import { cargarProyectosAsignados, type ProyectoEnRevision } from '../../evaluaciones/lib/bandejaEvaluacion'
import { checklistInvestigacion, construirComentarioChecklist } from '../../evaluaciones/lib/checklistComite'
import './ComiteInvestigacion.css'

type Vista = 'panel' | 'lista' | 'detalle'
type CategoriaLista = 'asignados' | 'pendientes' | 'aprobados'
type Orden = 'titulo-asc' | 'titulo-desc'
type Accion = 'aprobar' | 'correcciones' | 'rechazar' | null

function ComiteInvestigacion() {
  const [proyectos, setProyectos] = useState<ProyectoEnRevision[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [vista, setVista] = useState<Vista>('panel')
  const [categoriaLista, setCategoriaLista] = useState<CategoriaLista>('asignados')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('titulo-asc')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)

  const [documentos, setDocumentos] = useState<documentosApi.DocumentoProyecto[]>([])
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false)

  const [comentario, setComentario] = useState('')
  const [checklist, setChecklist] = useState<Set<number>>(new Set())
  const [archivoFormato, setArchivoFormato] = useState<string | null>(null)
  const [accionPendiente, setAccionPendiente] = useState<Accion>(null)
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

  const asignados = proyectos
  const pendientes = proyectos.filter((p) => p.abierta)
  const aprobados = proyectos.filter((p) => p.resultadoFinal === 'aprobado')

  const abrirLista = (categoria: CategoriaLista) => {
    setCategoriaLista(categoria)
    setBusqueda('')
    setVista('lista')
  }

  const abrirDetalle = (id_proyecto: number) => {
    setProyectoAbiertoId(id_proyecto)
    setComentario('')
    setChecklist(new Set())
    setArchivoFormato(null)
    setError('')
    setVista('detalle')

    setCargandoDocumentos(true)
    documentosApi
      .listarDocumentosProyecto(id_proyecto)
      .then(setDocumentos)
      .catch(() => setDocumentos([]))
      .finally(() => setCargandoDocumentos(false))
  }

  const volverAPanel = () => setVista('panel')
  const volverALista = () => setVista('lista')

  const handleDescargarDocumento = (doc: documentosApi.DocumentoProyecto) => {
    documentosApi
      .descargarDocumentoProyecto(doc.id_proyecto, doc.id_proyecto_documento, doc.archivo)
      .catch(() => setError('No se pudo descargar el documento.'))
  }

  const handleCargarFormato = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Nota: solo se registra el nombre del archivo junto a la evaluación,
    // no se guarda el contenido — el catálogo de documentos del proyecto no
    // tiene todavía un tipo de documento pensado para el formato que carga
    // el comité al evaluar.
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
        comentarios: construirComentarioChecklist(checklistInvestigacion, checklist, comentario),
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

  const alternarItemChecklist = (id: number) => {
    setChecklist((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  const listaBase = categoriaLista === 'asignados' ? asignados : categoriaLista === 'pendientes' ? pendientes : aprobados

  const listaFiltrada = listaBase
    .filter((p) =>
      [p.titulo, p.investigadorPrincipal, p.convocatoria].some((campo) =>
        campo.toLowerCase().includes(busqueda.toLowerCase())
      )
    )
    .sort((a, b) => (orden === 'titulo-asc' ? a.titulo.localeCompare(b.titulo) : b.titulo.localeCompare(a.titulo)))

  const proyectoAbierto = proyectos.find((p) => p.id_proyecto === proyectoAbiertoId) ?? null

  const tituloCategoria =
    categoriaLista === 'asignados' ? 'asignados' : categoriaLista === 'pendientes' ? 'pendientes' : 'aprobados'

  if (cargando) {
    return (
      <div className="cinv-page">
        <p className="cinv-empty">Cargando proyectos asignados...</p>
      </div>
    )
  }

  if (vista === 'panel') {
    return (
      <div className="cinv-page">
        {error && <p className="cinv-error">{error}</p>}

        <div className="cinv-stats-grid">
          <div className="cinv-stat-card">
            <FileText size={18} className="cinv-stat-icon" />
            <span className="cinv-stat-label">Proyectos asignados</span>
            <span className="cinv-stat-badge" style={{ background: '#2f5fa8' }}>{asignados.length}</span>
          </div>
          <div className="cinv-stat-card">
            <Clock size={18} className="cinv-stat-icon" />
            <span className="cinv-stat-label">Proyectos pendientes</span>
            <span className="cinv-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>{pendientes.length}</span>
          </div>
          <div className="cinv-stat-card">
            <CheckSquare size={18} className="cinv-stat-icon" />
            <span className="cinv-stat-label">Proyectos aprobados</span>
            <span className="cinv-stat-badge" style={{ background: '#27ae60' }}>{aprobados.length}</span>
          </div>
        </div>

        <div className="cinv-paneles">
          <div className="cinv-panel">
            <div className="cinv-panel-header cinv-panel-header-azul">Proyectos asignados</div>
            <div className="cinv-panel-lista">
              {asignados.slice(0, 3).map((p) => (
                <button type="button" className="cinv-panel-item" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
                  <FileText size={14} />
                  {p.titulo}
                </button>
              ))}
              {asignados.length === 0 && <p className="cinv-empty">No hay proyectos asignados.</p>}
            </div>
            <button type="button" className="cinv-ver-todos" onClick={() => abrirLista('asignados')}>
              Ver todos
            </button>
          </div>

          <div className="cinv-panel">
            <div className="cinv-panel-header cinv-panel-header-amarillo">Proyectos pendientes</div>
            <div className="cinv-panel-lista">
              {pendientes.slice(0, 3).map((p) => (
                <button type="button" className="cinv-panel-item" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
                  <FileText size={14} />
                  {p.titulo}
                </button>
              ))}
              {pendientes.length === 0 && <p className="cinv-empty">No hay proyectos pendientes.</p>}
            </div>
            <button type="button" className="cinv-ver-todos" onClick={() => abrirLista('pendientes')}>
              Ver todos
            </button>
          </div>

          <div className="cinv-panel">
            <div className="cinv-panel-header cinv-panel-header-verde">Proyectos aprobados</div>
            <div className="cinv-panel-lista">
              {aprobados.slice(0, 3).map((p) => (
                <button type="button" className="cinv-panel-item" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
                  <CheckSquare size={14} />
                  {p.titulo}
                </button>
              ))}
              {aprobados.length === 0 && <p className="cinv-empty">No hay proyectos aprobados.</p>}
            </div>
            <button type="button" className="cinv-ver-todos" onClick={() => abrirLista('aprobados')}>
              Ver todos
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'lista') {
    return (
      <div className="cinv-page">
        <button type="button" className="cinv-volver" onClick={volverAPanel}>
          <ArrowLeft size={16} />
          Volver al panel
        </button>

        {error && <p className="cinv-error">{error}</p>}

        <div className="cinv-lista-header-card">
          <h2>Proyectos {tituloCategoria}</h2>
          <p>Listado de proyectos {categoriaLista === 'pendientes' ? 'pendientes de evaluación' : tituloCategoria}</p>
        </div>

        <div className="cinv-filtros">
          <div className="cinv-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Busca por título, investigador o convocatoria"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="cinv-orden">
            <span>Ordenar por:</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="titulo-asc">Título A-Z</option>
              <option value="titulo-desc">Título Z-A</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="cinv-tabla">
          <div className="cinv-tabla-header">
            <span>Título</span>
            <span>Investigador principal</span>
            <span>Convocatoria</span>
            <span>Estado</span>
          </div>

          {listaFiltrada.map((p) => (
            <button type="button" className="cinv-tabla-row" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
              <span className="cinv-fila-titulo">{p.titulo}</span>
              <span>{p.investigadorPrincipal}</span>
              <span>{p.convocatoria}</span>
              <span className="cinv-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                {p.estado}
              </span>
            </button>
          ))}

          {listaFiltrada.length === 0 && <p className="cinv-empty">No se encontraron proyectos.</p>}
        </div>
      </div>
    )
  }

  if (!proyectoAbierto) {
    return (
      <div className="cinv-page">
        <p className="cinv-empty">No se encontró el proyecto.</p>
      </div>
    )
  }

  return (
    <div className="cinv-page">
      <button type="button" className="cinv-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver
      </button>

      {error && <p className="cinv-error">{error}</p>}

      <h2 className="cinv-detalle-titulo-pagina">Detalles del proyecto para revisión del comité</h2>

      <div className="cinv-detalle-info">
        <div className="cinv-detalle-info-top">
          <div>
            <p><strong>Título del proyecto:</strong> {proyectoAbierto.titulo}</p>
            <p><strong>Investigador principal del proyecto:</strong> {proyectoAbierto.investigadorPrincipal}</p>
            <p className="cinv-detalle-estado-linea">
              <strong>Estado del proyecto:</strong>
              <span className="cinv-estado-punto" style={{ background: estadoConfig[proyectoAbierto.estado].color }} />
              {proyectoAbierto.estado}
            </p>
          </div>
          <div className="cinv-detalle-fechas">
            <span>Fecha de envío: {proyectoAbierto.fechaEnvio}</span>
            <span>Fecha límite de evaluación: {proyectoAbierto.fechaLimiteEvaluacion ?? 'Sin definir'}</span>
          </div>
        </div>
      </div>

      <div className="cinv-documento">
        <h3>Documento a revisar</h3>
        <div className="cinv-documento-lista">
          {cargandoDocumentos && <p className="cinv-empty">Cargando documentos...</p>}
          {!cargandoDocumentos && documentos.map((doc) => (
            <div className="cinv-documento-item" key={doc.id_proyecto_documento}>
              <FileText size={14} />
              <span>{doc.tipoDocumento.nombre}</span>
              <button type="button" onClick={() => handleDescargarDocumento(doc)}>
                <Download size={14} />
                Descargar
              </button>
            </div>
          ))}
          {!cargandoDocumentos && documentos.length === 0 && (
            <p className="cinv-empty">Este proyecto todavía no tiene documentos cargados.</p>
          )}
        </div>
      </div>

      {proyectoAbierto.abierta ? (
        <div className="cinv-calificacion">
          <h3>Calificación del comité</h3>

          <div className="cinv-calificacion-body">
            <ul className="cinv-checklist">
              {checklistInvestigacion.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checklist.has(item.id)}
                      onChange={() => alternarItemChecklist(item.id)}
                    />
                    {item.texto}
                  </label>
                </li>
              ))}
            </ul>

            <div className="cinv-carga-formato">
              <label className="cinv-carga-label">
                <Upload size={16} />
                {archivoFormato ?? 'Carga aquí el formato de evaluación'}
                <input type="file" onChange={handleCargarFormato} />
              </label>
              {archivoFormato && (
                <button type="button" aria-label="Quitar archivo" onClick={() => setArchivoFormato(null)}>
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <textarea
              className="cinv-comentario"
              placeholder="Comentarios..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />

            <div className="cinv-decision-botones">
              <button type="button" className="cinv-btn-aprobar" onClick={() => setAccionPendiente('aprobar')} disabled={enviando}>
                Aprobar
              </button>
              <button type="button" className="cinv-btn-correcciones" onClick={() => setAccionPendiente('correcciones')} disabled={enviando}>
                Correcciones
              </button>
              <button type="button" className="cinv-btn-rechazar" onClick={() => setAccionPendiente('rechazar')} disabled={enviando}>
                Rechazar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="cinv-nota-cerrada">
          Esta etapa ya quedó cerrada para este proyecto — el resultado registrado fue: <strong>{proyectoAbierto.estado}</strong>.
        </p>
      )}

      {accionPendiente === 'aprobar' && (
        <ConfirmModal
          mensaje="¿Confirma la aprobación del proyecto?"
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}

      {accionPendiente === 'correcciones' && (
        <ConfirmModal
          mensaje="¿Confirma la aprobación con correcciones?"
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}

      {accionPendiente === 'rechazar' && (
        <ConfirmModal
          mensaje="¿Desea rechazar el proyecto en revisión?"
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}
    </div>
  )
}

export default ComiteInvestigacion
