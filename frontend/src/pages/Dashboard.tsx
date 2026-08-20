import { PlusSquare, ClipboardList, CheckSquare, XCircle, Users, Search } from 'lucide-react'
import DonutChart from '../components/DonutChart'
import './Dashboard.css'

const stats = [
  { icon: PlusSquare, label: 'Total de Proyectos', value: 23 },
  { icon: ClipboardList, label: 'Proyectos en Evaluación', value: 10 },
  { icon: CheckSquare, label: 'Proyectos Aprobados', value: 5 },
  { icon: XCircle, label: 'Proyectos Rechazados', value: 8 },
  { icon: Users, label: 'Usuarios Registrados', value: 30 },
]

const estadoData = [
  { label: 'En evaluación', value: 40, color: '#3b4b8c' },
  { label: 'Condicionado', value: 25, color: '#f2c94c' },
  { label: 'Aprobado', value: 20, color: '#27ae60' },
  { label: 'Rechazado', value: 15, color: '#eb5757' },
]

function Dashboard() {
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
            {estadoData.map(({ label, color }) => (
              <li key={label}>
                <span className="legend-dot" style={{ background: color }} />
                {label}
              </li>
            ))}
          </ul>

          <DonutChart data={estadoData} />
        </div>
      </div>
    </div>
  )
}

export default Dashboard