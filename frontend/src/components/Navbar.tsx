import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, User, SquarePen, LogOut, FileText, ClipboardList, RefreshCw, Info } from 'lucide-react'
import './Navbar.css'
import { useAuth } from '../context/AuthContext'
import { getRole } from '../lib/auth'
import { getNotificaciones, marcarLeida, type Notificacion, type TipoNotificacion } from '../lib/notificaciones'

const iconoPorTipo: Record<TipoNotificacion, typeof FileText> = {
  observacion: FileText,
  asignacion_comite: ClipboardList,
  cambio_estado: RefreshCw,
  sistema: Info,
}

function Navbar() {
  const navigate = useNavigate()
  const { usuario, cerrarSesion } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const role = getRole()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>(getNotificaciones(role))
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  const nombreUsuario = usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario'

  // cierra los menús si haces clic fuera de ellos
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    cerrarSesion()
    navigate('/')
  }

  const handleClickNotificacion = (n: Notificacion) => {
    marcarLeida(n.id)
    setNotificaciones(getNotificaciones(role))
    setNotifOpen(false)
    navigate('/notificacion', { state: n })
  }

  return (
    <header className="navbar">
      <div className="navbar-actions">
        <div className="navbar-notif-wrapper" ref={notifRef}>
          <button
            type="button"
            className="navbar-icon"
            aria-label="Notificaciones"
            onClick={() => setNotifOpen(!notifOpen)}
          >
            <Bell size={20} />
            {noLeidas > 0 && <span className="navbar-notif-dot" />}
          </button>

          {notifOpen && (
            <div className="navbar-notif-dropdown">
              {notificaciones.length === 0 ? (
                <p className="navbar-notif-empty">No tienes notificaciones.</p>
              ) : (
                notificaciones.map((n) => {
                  const Icono = iconoPorTipo[n.tipo]
                  return (
                    <button
                      type="button"
                      key={n.id}
                      className="navbar-notif-item"
                      onClick={() => handleClickNotificacion(n)}
                    >
                      <span className="navbar-notif-icon">
                        <Icono size={16} />
                      </span>

                      <span className="navbar-notif-body">
                        <span className="navbar-notif-top">
                          <span className="navbar-notif-titulo">{n.titulo}</span>
                          <span className="navbar-notif-fecha">{n.fecha}</span>
                        </span>
                        <span className="navbar-notif-descripcion">{n.descripcion}</span>
                      </span>

                      {!n.leida && <span className="navbar-notif-unread" />}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

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