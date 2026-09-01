import { PlusSquare, ClipboardList, CheckSquare, XCircle, Users, Search } from 'lucide-react'
import DonutChart from '../components/DonutChart'
import { getRole } from '../lib/auth'
import { estadoConfig, ordenEstados, type Estado } from '../lib/estado'
import './Dashboard.css'

// ---------- Vista de administrador (datos globales del sistema) ----------

type EstadoGlobal = 'En evaluación' | 'Condicionado' | 'Aprobado' | 'Rechazado'

interface ProyectoSistema {
  titulo: string
  investigador: string
  estadoGlobal: EstadoGlobal
}

const estadoGlobalColor: Record<EstadoGlobal, string> = {
  'En evaluación': '#3b4b8c',
  'Condicionado': '#f2c94c',
  'Aprobado': '#27ae60',
  'Rechazado': '#eb5757',
}

const proyectosSistema: ProyectoSistema[] = [
  { titulo: 'Proyecto 1', investigador: 'Investigador 1', estadoGlobal: 'En evaluación' },
  { titulo: 'Proyecto 2', investigador: 'Investigador 2', estadoGlobal: 'Condicionado' },
  { titulo: 'Proyecto 3', investigador: 'Investigador 3', estadoGlobal: 'Rechazado' },
  { titulo: 'Proyecto 4', investigador: 'Investigador 4', estadoGlobal: 'Aprobado' },
  { titulo: 'Proyecto 5', investigador: 'Investigador 5', estadoGlobal: 'En evaluación' },
]

const usuariosSistema: { nombre: string }[] = [
  { nombre: 'Usuario 1' },
  { nombre: 'Usuario 2' },
  { nombre: 'Usuario 3' },
]

function DashboardAdministrador() {
  const contarPorEstado = (estado: EstadoGlobal) =>
    proyectosSistema.filter((p) => p.estadoGlobal === estado).length

  const stats = [
    { icon: PlusSquare, label: 'Total de Proyectos', value: proyectosSistema.length },
    { icon: ClipboardList, label: 'Proyectos en Evaluación', value: contarPorEstado('En evaluación') },
    { icon: CheckSquare, label: 'Proyectos Aprobados', value: contarPorEstado('Aprobado') },
    { icon: XCircle, label: 'Proyectos Rechazados', value: contarPorEstado('Rechazado') },
    { icon: Users, label: 'Usuarios Registrados', value: usuariosSistema.length },
  ]

  const estadoData: EstadoGlobal[] = ['En evaluación', 'Condicionado', 'Aprobado', 'Rechazado']
  const donutData = estadoData.map((estado) => ({
    label: estado,
    value: contarPorEstado(estado),
    color: estadoGlobalColor[estado],
  }))

  return (
    <div className="dashboard-view">
      <div className="stats-grid">
        {stats.map(({ icon: Icon, label, value }) => (
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
          <input type="text" placeholder="Busca por investigador o convocatoria" />
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
      </div>
    </div>
  )
}

// ---------- Vista de usuario (solo sus propios datos) ----------

interface ProyectoPropio {
  titulo: string
  fase: string
  estado: Estado
}

const misProyectos: ProyectoPropio[] = [
  { titulo: 'Sistema Integral de Gestión Académica', fase: 'Comité investigación', estado: 'Pendiente' },
  { titulo: 'Plataforma de Seguimiento a Proyectos de Investigación', fase: 'Pares', estado: 'Rechazado' },
  { titulo: 'Observatorio de Innovación Regional', fase: 'Comité ética', estado: 'En revisión' },
  { titulo: 'Red de Conocimiento Universitario', fase: 'Comité investigación', estado: 'Aprobado' },
]

function DashboardUsuario() {
  const conteo = ordenEstados.map((estado) => ({
    estado,
    cantidad: misProyectos.filter((p) => p.estado === estado).length,
  }))

  return (
    <div className="dashboard-view">
      <div className="usuario-welcome">
        <h2>Hola, Usuario X 👋</h2>
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

        {misProyectos.length === 0 ? (
          <p className="usuario-empty">Todavía no tienes proyectos registrados.</p>
        ) : (
          <div className="usuario-proyectos-list">
            {misProyectos.map((p) => (
              <div className="usuario-proyecto-row" key={p.titulo}>
                <span className="usuario-proyecto-titulo">{p.titulo}</span>
                <span className="usuario-proyecto-fase">{p.fase}</span>
                <span
                  className="usuario-proyecto-pill"
                  style={{ background: estadoConfig[p.estado].color }}
                >
                  {p.estado}
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