import { useState } from 'react'
import {
  FileCheck, Clock, CheckSquare, XCircle, FileText, Search, ArrowLeft,
  Download, Upload, X as XIcon, ChevronDown,
} from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { estadoConfig } from '../lib/estado'
import {
  getProyectosComiteEtica,
  getProyectoComiteEtica,
  evaluarProyecto,
  type ProyectoComiteEtica,
} from '../lib/comiteEtica'
import './ComiteEtica.css'

type Vista = 'panel' | 'lista' | 'detalle'
type CategoriaLista = 'asignados' | 'pendientes'
type Orden = 'titulo-asc' | 'titulo-desc'
type Accion = 'aprobar' | 'correcciones' | 'rechazar' | null

function ComiteEtica() {
  const [proyectos, setProyectos] = useState<ProyectoComiteEtica[]>(getProyectosComiteEtica())
  const [vista, setVista] = useState<Vista>('panel')
  const [categoriaLista, setCategoriaLista] = useState<CategoriaLista>('asignados')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('titulo-asc')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<Accion>(null)
  const [archivoFormato, setArchivoFormato] = useState<string | null>(null)

  const refrescar = () => setProyectos([...getProyectosComiteEtica()])

  const pendientesDeEvaluacion = (p: ProyectoComiteEtica) =>
    p.estado === 'Pendiente' || p.estado === 'En revisión'

  const remitidos = proyectos.filter((p) => p.estado === 'Pendiente').length
  const pendientes = proyectos.filter((p) => p.estado === 'En revisión').length
  const evaluados = proyectos.filter((p) => p.estado === 'Aprobado' || p.estado === 'Correcciones').length
  const rechazados = proyectos.filter((p) => p.estado === 'Rechazado').length

  const asignados = proyectos.filter((p) => p.asignado)
  const pendientesAsignados = proyectos.filter((p) => p.asignado && pendientesDeEvaluacion(p))

  const abrirLista = (categoria: CategoriaLista) => {
    setCategoriaLista(categoria)
    setBusqueda('')
    setVista('lista')
  }

  const abrirDetalle = (id: number) => {
    const p = getProyectoComiteEtica(id)
    setProyectoAbiertoId(id)
    setComentario(p?.comentario ?? '')
    setArchivoFormato(null)
    setVista('detalle')
  }

  const volverAPanel = () => setVista('panel')
  const volverALista = () => setVista('lista')

  const handleFormatoEvaluacion = () => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    console.log('Descargar formato de evaluación (modo prueba, sin backend todavía)')
  }

  const handleHistorialEvaluacion = () => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    console.log('Consultar historial de evaluación (modo prueba, sin backend todavía)')
  }

  const handleDescargarAnexo = (nombre: string) => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    console.log('Descargar anexo (modo prueba, sin backend todavía):', nombre)
  }

  const handleCargarFormato = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoFormato(file.name)
    e.target.value = ''
  }

  const confirmarAccion = () => {
    if (proyectoAbiertoId === null || !accionPendiente) return

    const nuevoEstado =
      accionPendiente === 'aprobar' ? 'Aprobado' : accionPendiente === 'correcciones' ? 'Correcciones' : 'Rechazado'

    evaluarProyecto(proyectoAbiertoId, nuevoEstado, comentario)
    refrescar()
    setAccionPendiente(null)
    setVista('lista')
  }

  const listaBase = categoriaLista === 'asignados' ? asignados : pendientesAsignados

  const listaFiltrada = listaBase
    .filter((p) =>
      [p.titulo, p.investigadorPrincipal, p.convocatoria].some((campo) =>
        campo.toLowerCase().includes(busqueda.toLowerCase())
      )
    )
    .sort((a, b) => (orden === 'titulo-asc' ? a.titulo.localeCompare(b.titulo) : b.titulo.localeCompare(a.titulo)))

  const proyectoAbierto = proyectos.find((p) => p.id === proyectoAbiertoId) ?? null

  // ---------- Vista: Panel principal ----------
  if (vista === 'panel') {
    return (
      <div className="cetica-page">
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
                <button type="button" className="cetica-panel-item" key={p.id} onClick={() => abrirDetalle(p.id)}>
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
                <button type="button" className="cetica-panel-item" key={p.id} onClick={() => abrirDetalle(p.id)}>
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

  // ---------- Vista: Lista ----------
  if (vista === 'lista') {
    return (
      <div className="cetica-page">
        <button type="button" className="cetica-volver" onClick={volverAPanel}>
          <ArrowLeft size={16} />
          Volver al panel
        </button>

        <div className="cetica-lista-header-card">
          <h2>Proyectos {categoriaLista === 'asignados' ? 'asignados' : 'pendientes'}</h2>
          <p>Listado de proyectos {categoriaLista === 'asignados' ? 'asignados al comité' : 'pendientes de evaluación'}</p>
        </div>

        <div className="cetica-toolbar">
          <button type="button" className="cetica-toolbar-btn" onClick={handleFormatoEvaluacion}>
            <FileText size={14} />
            Formato de evaluación
            <Download size={14} />
          </button>
          <button type="button" className="cetica-toolbar-btn" onClick={handleHistorialEvaluacion}>
            <Clock size={14} />
            Historial de evaluación
            <span className="cetica-toolbar-badge">Consultar</span>
          </button>
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
            <span>Facultad</span>
            <span>Estado</span>
          </div>

          {listaFiltrada.map((p) => (
            <button type="button" className="cetica-tabla-row" key={p.id} onClick={() => abrirDetalle(p.id)}>
              <span className="cetica-fila-titulo">{p.titulo}</span>
              <span>{p.investigadorPrincipal}</span>
              <span>{p.convocatoria}</span>
              <span>{p.facultad}</span>
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

  // ---------- Vista: Detalle ----------
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

      <h2 className="cetica-detalle-titulo-pagina">Detalles del proyecto para revisión del comité</h2>

      <div className="cetica-detalle-info">
        <div className="cetica-detalle-info-top">
          <div>
            <p className="cetica-detalle-proyecto-nombre">{proyectoAbierto.titulo}</p>
            <p>Estado: <strong>{proyectoAbierto.estado}</strong></p>
          </div>
          <div className="cetica-detalle-fechas">
            <span>Fecha de envío: {proyectoAbierto.fechaEnvio}</span>
            <span>Fecha límite de evaluación: {proyectoAbierto.fechaLimiteEvaluacion}</span>
          </div>
        </div>

        <p className="cetica-resumen-label">Resumen de proyecto</p>
        <p className="cetica-resumen-texto">{proyectoAbierto.resumen}</p>
      </div>

      <div className="cetica-anexos">
        <h3>Anexos</h3>
        <div className="cetica-anexos-lista">
          {proyectoAbierto.anexos.map((nombre) => (
            <div className="cetica-anexo-item" key={nombre}>
              <FileText size={14} />
              <span>{nombre}</span>
              <button type="button" aria-label="Descargar" onClick={() => handleDescargarAnexo(nombre)}>
                <Download size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="cetica-ver-todos-anexos">Ver todos</button>
        </div>
      </div>

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
            <button type="button" className="cetica-btn-aprobar" onClick={() => setAccionPendiente('aprobar')}>
              Aprobar
            </button>
            <button type="button" className="cetica-btn-correcciones" onClick={() => setAccionPendiente('correcciones')}>
              Correcciones
            </button>
            <button type="button" className="cetica-btn-rechazar" onClick={() => setAccionPendiente('rechazar')}>
              No aprobar
            </button>
          </div>
        </div>
      </div>

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