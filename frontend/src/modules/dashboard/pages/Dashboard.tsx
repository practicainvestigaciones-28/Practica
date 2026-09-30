import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusSquare, ClipboardList, CheckSquare, XCircle, Users, Search, Clock, FileText, FileCheck, ArrowLeft, ChevronDown } from 'lucide-react'
import DonutChart from '../../../shared/components/common/DonutChart'
import { getRole } from '../../auth/lib/auth'
import { estadoConfig, ordenEstados, type Estado } from '../../../shared/lib/estado'
import { useAuth } from '../../auth/context/AuthContext'
import * as dashboardApi from '../api/dashboard'
import { ApiError } from '../../../shared/api/client'
import { cargarProyectosAsignados, type ProyectoEnRevision } from '../../evaluaciones/lib/bandejaEvaluacion'
import './Dashboard.css'

function mapearEstado(estadoBackend: string): Estado {
  switch (estadoBackend) {
    case 'revision':
      return 'En revisión'
    case 'aprobado':
    case 'finalizado':
      return 'Aprobado'
    case 'aprobado_con_correcciones':
      return 'Correcciones'
    case 'rechazado':
    case 'no_cumple':
      return 'Rechazado'
    default:
      return 'Pendiente'
  }
}

function DashboardAdministrador() {
  const [stats, setStats] = useState<dashboardApi.EstadisticasDashboard | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    dashboardApi
      .obtenerEstadisticas()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las estadísticas.'))
      .finally(() => setCargando(false))
  }, [])

  const contarPorEstado = (estado: Estado) => {
    if (!stats) return 0
    return stats.proyectosPorEstado
      .filter((p) => mapearEstado(p.estado) === estado)
      .reduce((suma, p) => suma + p.cantidad, 0)
  }

  const tarjetas = [
    { icon: PlusSquare, label: 'Total de Proyectos', value: stats?.totalProyectos ?? 0 },
    { icon: ClipboardList, label: 'Proyectos en Evaluación', value: contarPorEstado('En revisión') },
    { icon: CheckSquare, label: 'Proyectos Aprobados', value: contarPorEstado('Aprobado') },
    { icon: XCircle, label: 'Proyectos Rechazados', value: contarPorEstado('Rechazado') },
    { icon: Users, label: 'Usuarios Registrados', value: stats?.totalUsuarios ?? 0 },
  ]

  const donutData = ordenEstados.map((estado) => ({
    label: estado,
    value: contarPorEstado(estado),
    color: estadoConfig[estado].color,
  }))

  const recientesFiltrados = (stats?.proyectosRecientes ?? []).filter((p) =>
    [p.creador, p.convocatoria].some((campo) => campo.toLowerCase().includes(busqueda.toLowerCase()))
  )

  if (cargando) return <div className="dashboard-view"><p>Cargando estadísticas...</p></div>
  if (error) return <div className="dashboard-view"><p>{error}</p></div>

  return (
    <div className="dashboard-view">
      <div className="stats-grid">
        {tarjetas.map(({ icon: Icon, label, value }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon">
              <Icon size={20} />
            </div>
            <div className="stat-body">
              <span className="stat-label">{label}</span>
              <span className="stat-value">{value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="estado-section">
        <h2>Proyectos por estado</h2>

        <div className="estado-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Busca por investigador o convocatoria"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="estado-chart">
          <ul className="estado-legend">
            {donutData.map(({ label, color, value }) => (
              <li key={label}>
                <span className="legend-dot" style={{ background: color }} />
                {label} ({value})
              </li>
            ))}
          </ul>

          <DonutChart data={donutData} />
        </div>

        {recientesFiltrados.length > 0 && (
          <ul className="estado-legend" style={{ marginTop: 16 }}>
            {recientesFiltrados.map((p) => (
              <li key={p.id_proyecto}>
                {p.titulo} — {p.creador} ({p.convocatoria})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DashboardUsuario() {
  const { usuario } = useAuth()
  const [stats, setStats] = useState<dashboardApi.EstadisticasDashboard | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    dashboardApi
      .obtenerEstadisticas()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setCargando(false))
  }, [])

  const misProyectos = stats?.proyectosRecientes ?? []

  const conteo = ordenEstados.map((estado) => ({
    estado,
    cantidad: misProyectos.filter((p) => mapearEstado(p.estado_actual) === estado).length,
  }))

  return (
    <div className="dashboard-view">
      <div className="usuario-welcome">
        <h2>Hola, {usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario'} 👋</h2>
        <p>Este es el resumen de tus proyectos de investigación.</p>
      </div>

      <div className="usuario-chips-row">
        {conteo.map(({ estado, cantidad }) => (
          <div
            className="usuario-chip"
            key={estado}
            style={{ borderColor: estadoConfig[estado].color }}
          >
            <span
              className="usuario-chip-dot"
              style={{ background: estadoConfig[estado].color }}
            />
            <span className="usuario-chip-count">{cantidad}</span>
            <span className="usuario-chip-label">{estado}</span>
          </div>
        ))}
      </div>

      <div className="usuario-proyectos-card">
        <div className="usuario-proyectos-header">
          <h2>Mis proyectos</h2>
        </div>

        {cargando && <p className="usuario-empty">Cargando proyectos...</p>}

        {!cargando && misProyectos.length === 0 ? (
          <p className="usuario-empty">Todavía no tienes proyectos registrados.</p>
        ) : (
          <div className="usuario-proyectos-list">
            {misProyectos.map((p) => (
              <div className="usuario-proyecto-row" key={p.id_proyecto}>
                <span className="usuario-proyecto-titulo">{p.titulo}</span>
                <span className="usuario-proyecto-fase">{p.convocatoria}</span>
                <span
                  className="usuario-proyecto-pill"
                  style={{ background: estadoConfig[mapearEstado(p.estado_actual)].color }}
                >
                  {mapearEstado(p.estado_actual)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type ParCategoria = 'asignados' | 'pendientes' | 'avalados'
type ParOrden = 'titulo-asc' | 'titulo-desc'

/** El par evaluador no "aprueba" el proyecto, lo avala — el texto del
 * estado "Aprobado" no aplica a su rol, aunque el color siga siendo el
 * mismo (estadoConfig sigue indexado por el Estado real). */
function etiquetaEstadoPar(estado: Estado): string {
  return estado === 'Aprobado' ? 'Avalado' : estado
}

function DashboardParEvaluador() {
  const navigate = useNavigate()
  const [proyectos, setProyectos] = useState<ProyectoEnRevision[]>([])
  const [cargando, setCargando] = useState(true)

  const [vista, setVista] = useState<'panel' | 'lista'>('panel')
  const [categoria, setCategoria] = useState<ParCategoria>('asignados')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<ParOrden>('titulo-asc')

  useEffect(() => {
    cargarProyectosAsignados()
      .then(setProyectos)
      .catch(() => setProyectos([]))
      .finally(() => setCargando(false))
  }, [])

  const asignados = proyectos
  const pendientes = proyectos.filter((p) => p.abierta)
  const avalados = proyectos.filter(
    (p) => p.resultadoFinal === 'aprobado' || p.resultadoFinal === 'aprobado_con_correcciones'
  )

  const abrirLista = (cat: ParCategoria) => {
    setCategoria(cat)
    setBusqueda('')
    setVista('lista')
  }

  const irACalificar = (p: ProyectoEnRevision) =>
    navigate('/evaluaciones/calificar', {
      state: { id_proyecto: p.id_proyecto, id_etapa: p.id_etapa, titulo: p.titulo },
    })

  if (cargando) {
    return (
      <div className="dashboard-view">
        <p className="par-empty">Cargando proyectos asignados...</p>
      </div>
    )
  }

  if (vista === 'lista') {
    const listaBase = categoria === 'asignados' ? asignados : categoria === 'pendientes' ? pendientes : avalados
    const tituloCategoria = categoria === 'asignados' ? 'asignados' : categoria === 'pendientes' ? 'pendientes' : 'avalados'

    const listaFiltrada = listaBase
      .filter((p) =>
        [p.titulo, p.investigadorPrincipal, p.convocatoria].some((campo) =>
          campo.toLowerCase().includes(busqueda.toLowerCase())
        )
      )
      .sort((a, b) => (orden === 'titulo-asc' ? a.titulo.localeCompare(b.titulo) : b.titulo.localeCompare(a.titulo)))

    return (
      <div className="dashboard-view">
        <button type="button" className="par-volver" onClick={() => setVista('panel')}>
          <ArrowLeft size={16} />
          Volver al panel
        </button>

        <div className="par-lista-header-card">
          <h2>Proyectos {tituloCategoria}</h2>
          <p>Listado de proyectos {categoria === 'pendientes' ? 'pendientes de evaluación' : tituloCategoria}</p>
        </div>

        <div className="par-filtros">
          <div className="par-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Busca por título, investigador o convocatoria"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="par-orden">
            <span>Ordenar por:</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as ParOrden)}>
              <option value="titulo-asc">Título A-Z</option>
              <option value="titulo-desc">Título Z-A</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="par-tabla">
          <div className="par-tabla-header">
            <span>Título</span>
            <span>Investigador principal</span>
            <span>Convocatoria</span>
            <span>Estado</span>
          </div>

          {listaFiltrada.map((p) =>
            categoria === 'pendientes' ? (
              <button type="button" className="par-tabla-row" key={p.id_asignacion} onClick={() => irACalificar(p)}>
                <span className="par-fila-titulo">{p.titulo}</span>
                <span>{p.investigadorPrincipal}</span>
                <span>{p.convocatoria}</span>
                <span className="par-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                  {etiquetaEstadoPar(p.estado)}
                </span>
              </button>
            ) : (
              <div className="par-tabla-row par-tabla-row-no-clickeable" key={p.id_asignacion}>
                <span className="par-fila-titulo">{p.titulo}</span>
                <span>{p.investigadorPrincipal}</span>
                <span>{p.convocatoria}</span>
                <span className="par-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                  {etiquetaEstadoPar(p.estado)}
                </span>
              </div>
            )
          )}

          {listaFiltrada.length === 0 && <p className="par-empty">No se encontraron proyectos.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-view">
      <div className="par-stats-grid">
        <div className="par-stat-card">
          <FileText size={18} className="par-stat-icon" />
          <span className="par-stat-label">Proyectos asignados</span>
          <span className="par-stat-badge" style={{ background: '#2f5fa8' }}>{asignados.length}</span>
        </div>
        <div className="par-stat-card">
          <Clock size={18} className="par-stat-icon" />
          <span className="par-stat-label">Proyectos pendientes</span>
          <span className="par-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>{pendientes.length}</span>
        </div>
        <div className="par-stat-card">
          <CheckSquare size={18} className="par-stat-icon" />
          <span className="par-stat-label">Proyectos avalados</span>
          <span className="par-stat-badge" style={{ background: '#27ae60' }}>{avalados.length}</span>
        </div>
      </div>

      <div className="par-paneles">
        <div className="par-panel">
          <div className="par-panel-header par-panel-header-azul">Proyectos asignados</div>
          <div className="par-panel-lista">
            {asignados.slice(0, 3).map((p) => (
              <div className="par-panel-item" key={p.id_asignacion}>
                <FileText size={14} />
                {p.titulo}
              </div>
            ))}
            {asignados.length === 0 && <p className="par-empty">No hay proyectos asignados.</p>}
          </div>
          <button type="button" className="par-ver-todos" onClick={() => abrirLista('asignados')}>
            Ver todos
          </button>
        </div>

        <div className="par-panel">
          <div className="par-panel-header par-panel-header-amarillo">Proyectos pendientes</div>
          <div className="par-panel-lista">
            {pendientes.slice(0, 3).map((p) => (
              <div className="par-panel-item" key={p.id_asignacion}>
                <FileCheck size={14} />
                {p.titulo}
              </div>
            ))}
            {pendientes.length === 0 && <p className="par-empty">No hay proyectos pendientes.</p>}
          </div>
          <button type="button" className="par-ver-todos" onClick={() => abrirLista('pendientes')}>
            Ver todos
          </button>
        </div>

        <div className="par-panel">
          <div className="par-panel-header par-panel-header-verde">Proyectos avalados</div>
          <div className="par-panel-lista">
            {avalados.slice(0, 3).map((p) => (
              <div className="par-panel-item" key={p.id_asignacion}>
                <CheckSquare size={14} />
                {p.titulo}
              </div>
            ))}
            {avalados.length === 0 && <p className="par-empty">No hay proyectos avalados.</p>}
          </div>
          <button type="button" className="par-ver-todos" onClick={() => abrirLista('avalados')}>
            Ver todos
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Misma tabla que ve el Administrador en "Proyectos" (título, investigador,
 * convocatoria, asignado a, estado con la leyenda de colores) pero acotada a
 * los proyectos que le llegaron a este integrante de comité — no a todos los
 * del sistema.
 */
function DashboardComiteTabla({ etiquetaAsignado }: { etiquetaAsignado: string }) {
  const [proyectos, setProyectos] = useState<ProyectoEnRevision[]>([])
  const [cargando, setCargando] = useState(true)
  const [indiceEstadoResaltado, setIndiceEstadoResaltado] = useState(0)

  useEffect(() => {
    cargarProyectosAsignados()
      .then(setProyectos)
      .catch(() => setProyectos([]))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndiceEstadoResaltado((i) => (i + 1) % ordenEstados.length)
    }, 1400)
    return () => clearInterval(intervalo)
  }, [])

  const estadoResaltado = ordenEstados[indiceEstadoResaltado]

  return (
    <div className="dashboard-view">
      <div className="dashcom-table">
        <div className="dashcom-table-header">
          <span className="dashcom-col-divisor">Título</span>
          <span className="dashcom-header-investigador dashcom-col-divisor">Investigador</span>
          <span className="dashcom-header-convocatoria">Convocatoria</span>
          <span className="dashcom-header-convocatoria">Asignado a</span>
          <div className="dashcom-fase-header">
            <span>Estado</span>
            <div className="dashcom-estado-legend">
              {ordenEstados.map((estado, i) => (
                <span
                  key={estado}
                  className={`dashcom-estado-segment ${i === indiceEstadoResaltado ? 'dashcom-legend-activo' : ''}`}
                  style={{ background: estadoConfig[estado].color }}
                  title={estado}
                />
              ))}
            </div>
            <span
              className="dashcom-legend-caption"
              style={{ background: estadoConfig[estadoResaltado].color, color: estadoConfig[estadoResaltado].colorTexto }}
            >
              {estadoResaltado}
            </span>
          </div>
        </div>

        {cargando && <p className="dashcom-empty">Cargando proyectos...</p>}

        {!cargando &&
          proyectos.map((p) => (
            <div className="dashcom-row" key={p.id_proyecto}>
              <span className="dashcom-row-titulo dashcom-col-divisor">{p.titulo}</span>
              <span className="dashcom-row-investigador dashcom-col-divisor">{p.investigadorPrincipal}</span>
              <span className="dashcom-row-fase">{p.convocatoria}</span>
              <span className="dashcom-row-fase">{etiquetaAsignado}</span>
              <span
                className="dashcom-row-estado"
                style={{ background: estadoConfig[p.estado].color }}
                title={`Estado: ${p.estado}`}
              />
            </div>
          ))}

        {!cargando && proyectos.length === 0 && <p className="dashcom-empty">No se encontraron proyectos.</p>}
      </div>
    </div>
  )
}

function Dashboard() {
  const role = getRole()
  if (role === 'administrador') return <DashboardAdministrador />
  if (role === 'par_evaluador') return <DashboardParEvaluador />
  if (role === 'comite_investigacion') return <DashboardComiteTabla etiquetaAsignado="Comité de Investigación" />
  if (role === 'comite_etica') return <DashboardComiteTabla etiquetaAsignado="Comité de Ética" />
  return <DashboardUsuario />
}

export default Dashboard