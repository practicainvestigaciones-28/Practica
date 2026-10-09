import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hayRolElegido } from '../lib/auth'

/** Pantalla obligatoria cuando la cuenta tiene una contraseña temporal (ver debe_cambiar_contrasena). */
const RUTA_CAMBIO_OBLIGATORIO = '/cambiar-contrasena-inicial'
const RUTA_ELEGIR_ROL = '/elegir-rol'

function ProtectedRoute() {
  const { token, usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return null
  if (!token) return <Navigate to="/" replace />

  // Mientras no cambie la contraseña temporal, no puede ver ninguna otra
  // pantalla (ni siquiera elegir rol) — se le manda a esa pantalla sin
  // importar a dónde intentara navegar.
  if (usuario?.debe_cambiar_contrasena && location.pathname !== RUTA_CAMBIO_OBLIGATORIO) {
    return <Navigate to={RUTA_CAMBIO_OBLIGATORIO} replace />
  }

  // Si la cuenta tiene más de un rol (o es Administrador, que puede entrar
  // con cualquiera) y todavía no eligió con cuál operar en esta sesión, se
  // le manda a elegir antes de dejarlo ver cualquier otra pantalla — esto
  // cubre tanto el login normal (Login.tsx ya navega directo a
  // /elegir-rol, así que acá no hace nada extra) como el caso recién
  // agregado de cambiar la contraseña temporal: antes, esa pantalla decidía
  // el destino por su cuenta duplicando esta misma lógica, y si su cálculo
  // fallaba mandaba derecho a un solo rol sin dejar elegir. Centralizarlo
  // aquí es la única fuente de verdad, sin importar de dónde venga.
  const puedeElegirRol = (usuario?.roles.length ?? 0) > 1 || Boolean(usuario?.roles.includes('Administrador'))
  if (
    !usuario?.debe_cambiar_contrasena &&
    puedeElegirRol &&
    !hayRolElegido() &&
    location.pathname !== RUTA_ELEGIR_ROL
  ) {
    return <Navigate to={RUTA_ELEGIR_ROL} replace />
  }

  // Y si ya cambió la contraseña (o nunca la tuvo pendiente) y no hace
  // falta elegir rol, esa pantalla de cambio obligatorio no tiene nada que
  // hacer — por si alguien vuelve a esa URL directamente.
  if (!usuario?.debe_cambiar_contrasena && !puedeElegirRol && location.pathname === RUTA_CAMBIO_OBLIGATORIO) {
    return <Navigate to="/inicio" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
