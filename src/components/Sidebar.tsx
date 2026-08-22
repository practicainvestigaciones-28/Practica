import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, BookOpen, Layers } from 'lucide-react'
import { getRole, type Role } from '../lib/auth'
import './Sidebar.css'

const allNavItems: { to: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['administrador', 'usuario'] },
  { to: '/roles', label: 'Roles', icon: Users, roles: ['administrador'] },
  { to: '/convocatorias', label: 'Convocatorias', icon: FileText, roles: ['administrador', 'usuario'] },
  { to: '/proyectos', label: 'Proyectos', icon: BookOpen, roles: ['administrador', 'usuario'] },
  { to: '/area-conocimiento', label: 'Área de Conocimiento', icon: Layers, roles: ['administrador'] },
]

function Sidebar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const role = getRole()

  const navItems = allNavItems.filter((item) => item.roles.includes(role))

  return (
    <aside
      className={`sidebar ${open ? 'sidebar-open' : 'sidebar-collapsed'}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="sidebar-brand"
        onClick={() => navigate('/inicio')}
        aria-label="Ir al inicio"
      >
        <img src="/SGP.png" alt="SGP-VIE" className="sidebar-brand-logo" />
        {open && <span className="sidebar-brand-text">SGP-VIE</span>}
      </button>

      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <Icon size={20} />
            {open && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar