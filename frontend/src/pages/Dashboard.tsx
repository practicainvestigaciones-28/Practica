import { useState, useEffect } from 'react'
import { PlusSquare, ClipboardList, CheckSquare, XCircle, Users, Search } from 'lucide-react'
import DonutChart from '../components/DonutChart'
import { getRole } from '../lib/auth'
import { estadoConfig, ordenEstados, type Estado } from '../lib/estado'
import { useAuth } from '../context/AuthContext'
import * as dashboardApi from '../api/dashboard'
import { ApiError } from '../api/client'
import './Dashboard.css'

/** Traduce el estado_actual real del backend al tipo Estado que usa la UI */
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

// ---------- Vista de administrador (datos globales del sistema) ----------

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

// ---------- Vista de usuario (solo sus propios datos) ----------

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

// ---------- Selector según el rol ----------

function Dashboard() {
  const role = getRole()
  return role === 'administrador' ? <DashboardAdministrador /> : <DashboardUsuario />
}

export default Dashboard
