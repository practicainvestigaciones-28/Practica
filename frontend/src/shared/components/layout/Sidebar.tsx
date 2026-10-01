import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, BookOpen, FileCheck2, UserCheck, Scale, FlaskConical, Wallet, TableProperties } from 'lucide-react'
import { getRolesEfectivos, type Role } from '../../../modules/auth/lib/auth'
import './Sidebar.css'

const allNavItems: { to: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['administrador', 'usuario', 'par_evaluador', 'comite_etica', 'comite_investigacion'],
  },
  { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['administrador'] },
  { to: '/convocatorias', label: 'Convocatorias', icon: FileText, roles: ['administrador'] },
  { to: '/proyectos', label: 'Proyectos', icon: BookOpen, roles: ['administrador', 'usuario'] },
  { to: '/formatos-evaluacion', label: 'Formatos de evaluación', icon: FileCheck2, roles: ['administrador'] },
  // "Resultados de Pares" vive como pestaña dentro de Asignaciones, no como
  // entrada propia — junto al resto del flujo de asignación de Pares.
  { to: '/asignaciones', label: 'Asignaciones', icon: UserCheck, roles: ['administrador'] },
  { to: '/comite-etica', label: 'Comité de ética', icon: Scale, roles: ['comite_etica'] },
  { to: '/comite-investigacion', label: 'Comité de investigación', icon: FlaskConical, roles: ['comite_investigacion'] },
  // La bandeja de proyectos del Par Evaluador vive dentro de su propio
  // Dashboard ("Proyectos asignados"), no en una sección aparte.
  { to: '/informacion-pagos', label: 'Información de pagos', icon: Wallet, roles: ['par_evaluador'] },
  // El Líder no ve nada más del sistema: solo este consolidado de seguimiento.
  { to: '/seguimiento-proyectos', label: 'Seguimiento de proyectos', icon: TableProperties, roles: ['lider'] },
]

interface SidebarProps {

  mobileOpen: boolean

  onCloseMobile: () => void
}

function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const [hoverOpen, setHoverOpen] = useState(false)
  const navigate = useNavigate()
  const rolesActivos = getRolesEfectivos()

  const navItems = allNavItems.filter((item) => item.roles.some((r) => rolesActivos.includes(r)))

  const irA = (ruta: string) => {
    onCloseMobile()
    navigate(ruta)
  }

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={[
          'sidebar',
          hoverOpen ? 'sidebar-open' : 'sidebar-collapsed',
          mobileOpen ? 'sidebar-mobile-open' : '',
        ].join(' ').trim()}
        onMouseEnter={() => setHoverOpen(true)}
        onMouseLeave={() => setHoverOpen(false)}
      >
        <button
          type="button"
          className="sidebar-brand"
          onClick={() => irA('/inicio')}
          aria-label="Ir al inicio"
        >
          <img src="/SGP.png" alt="SGP-VIE" className="sidebar-brand-logo" />
          <span className="sidebar-brand-text">SGP-VIE</span>
        </button>

        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <Icon size={20} />
              <span className="sidebar-link-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar