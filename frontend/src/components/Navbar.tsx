import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, User, SquarePen, LogOut } from 'lucide-react'
import './Navbar.css'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const navigate = useNavigate()
const { usuario, cerrarSesion } = useAuth()
const [menuOpen, setMenuOpen] = useState(false)
const menuRef = useRef<HTMLDivElement>(null)

const nombreUsuario = usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario'

  // cierra el menú si haces clic fuera de él
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
  cerrarSesion()
  navigate('/')
}

  return (
    <header className="navbar">
      <div className="navbar-actions">
        <button className="navbar-icon" aria-label="Notificaciones">
          <Bell size={20} />
        </button>

        <div className="navbar-user-wrapper" ref={menuRef}>
          <button
            type="button"
            className="navbar-user"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <User size={18} />
            <span>{nombreUsuario}</span>
          </button>

          {menuOpen && (
            <div className="navbar-dropdown">
              <button
                type="button"
                className="navbar-dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/perfil')
                }}
              >
                <SquarePen size={16} />
                Perfil
              </button>

              <div className="navbar-dropdown-divider" />

              <button
                type="button"
                className="navbar-dropdown-item"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar