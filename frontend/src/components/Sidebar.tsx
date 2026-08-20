import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, BookOpen } from 'lucide-react'
import './Sidebar.css'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/roles', label: 'Roles', icon: Users },
  { to: '/convocatorias', label: 'Convocatorias', icon: FileText },
  { to: '/proyectos', label: 'Proyectos', icon: BookOpen },
]

function Sidebar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

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