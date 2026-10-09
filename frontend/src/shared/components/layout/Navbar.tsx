import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, User, SquarePen, KeyRound, LogOut, Repeat, Menu } from 'lucide-react'
import './Navbar.css'
import { useAuth } from '../../../modules/auth/context/AuthContext'
import { NOMBRES_ROL_REAL, getRole } from '../../../modules/auth/lib/auth'
import * as notificacionesApi from '../../../modules/notificaciones/api/notificaciones'
import CambiarContrasenaModal from '../../../modules/usuarios/components/CambiarContrasenaModal'

interface NavbarProps {
  onToggleMenu: () => void
}

function Navbar({ onToggleMenu }: NavbarProps) {
  const navigate = useNavigate()
  const { usuario, cerrarSesion } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [mostrarModalContrasena, setMostrarModalContrasena] = useState(false)

  const [notificaciones, setNotificaciones] = useState<notificacionesApi.NotificacionBackend[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const refrescarNotificaciones = () => {
    notificacionesApi
      .listarNotificaciones()
      .then(setNotificaciones)
      .catch(() => setNotificaciones([]))
  }

  useEffect(() => {
    refrescarNotificaciones()
  }, [])

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  const nombreUsuario = usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario'
  // Visible junto al nombre para que alguien con más de un rol siempre sepa
  // con cuál está operando en este momento, sin tener que entrar a "Cambiar
  // de rol" para confirmarlo.
  const rolActivo = usuario ? NOMBRES_ROL_REAL[getRole()] : ''

  // Solo tiene sentido ofrecer "Cambiar de rol" si de verdad hay entre qué
  // elegir: el Administrador siempre ve varias opciones en /elegir-rol (ver
  // SeleccionarRol.tsx) aunque en BD solo tenga el rol Administrador.
  const puedeCambiarRol =
    !!usuario && (usuario.roles.includes(NOMBRES_ROL_REAL.administrador) || usuario.roles.length > 1)

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

  const handleClickNotificacion = (n: notificacionesApi.NotificacionBackend) => {
    notificacionesApi
      .marcarLeida(n.id_notificacion)
      .then(refrescarNotificaciones)
      .catch(() => {})
    setNotifOpen(false)
    navigate('/notificacion', { state: n })
  }

  return (
    <header className="navbar">
      <button
        type="button"
        className="navbar-hamburger"
        aria-label="Abrir menú"
        onClick={onToggleMenu}
      >
        <Menu size={22} />
      </button>

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
                notificaciones.map((n) => (
                  <button
                    type="button"
                    key={n.id_notificacion}
                    className="navbar-notif-item"
                    onClick={() => handleClickNotificacion(n)}
                  >
                    <span className="navbar-notif-icon">
                      <Bell size={16} />
                    </span>

                    <span className="navbar-notif-body">
                      <span className="navbar-notif-top">
                        <span className="navbar-notif-titulo">{n.titulo}</span>
                        <span className="navbar-notif-fecha">
                          {new Date(n.fecha_notificacion).toLocaleDateString('es-CO')}
                        </span>
                      </span>
                      <span className="navbar-notif-descripcion">{n.mensaje}</span>
                    </span>

                    {!n.leida && <span className="navbar-notif-unread" />}
                  </button>
                ))
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
            <span className="navbar-user-info">
              <span className="navbar-user-nombre">{nombreUsuario}</span>
              {rolActivo && <span className="navbar-user-rol">{rolActivo}</span>}
            </span>
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

              <button
                type="button"
                className="navbar-dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  setMostrarModalContrasena(true)
                }}
              >
                <KeyRound size={16} />
                Cambiar contraseña
              </button>

              {puedeCambiarRol && (
                <button
                  type="button"
                  className="navbar-dropdown-item"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/elegir-rol')
                  }}
                >
                  <Repeat size={16} />
                  Cambiar de rol
                </button>
              )}

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

      {mostrarModalContrasena && (
        <CambiarContrasenaModal onClose={() => setMostrarModalContrasena(false)} />
      )}
    </header>
  )
}

export default Navbar