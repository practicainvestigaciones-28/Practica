import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import * as authApi from '../api/auth'
import type { UsuarioSesion } from '../api/auth'
import { EVENTO_SESION_EXPIRADA, type DetalleSesionExpirada } from '../../../shared/api/client'
import { buscarCuentaLocalDev, esTokenLocalDev, PREFIJO_TOKEN_LOCAL_DEV } from '../lib/usuariosDev'
import { limpiarRolActivo } from '../lib/auth'

const INTERVALO_MIN_ACTIVIDAD_MS = 60_000

interface AuthContextValue {
  usuario: UsuarioSesion | null
  token: string | null
  cargando: boolean
  iniciarSesion: (correo: string, contraseña: string) => Promise<UsuarioSesion>
  cerrarSesion: () => void
  tieneRol: (...roles: string[]) => boolean
  /** Refleja en la sesión los datos que el propio usuario acaba de editar en su perfil (ver Perfil.tsx). */
  actualizarUsuarioSesion: (datos: Partial<UsuarioSesion>) => void
  /** Mensaje a mostrar en el login cuando la sesión se cerró sola (token
   * vencido, inactividad, etc.). Vive aquí en vez de en el state de la
   * navegación porque ProtectedRoute también redirige a "/" al quedarse
   * sin token, en una carrera con este mismo cierre de sesión — si el
   * mensaje viajara en el state, esa segunda redirección (sin mensaje)
   * a veces la pisaba y el login se veía mudo. */
  mensajeSesionExpirada: string | null
  limpiarMensajeSesionExpirada: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const CLAVE_TOKEN = 'token'
const CLAVE_USUARIO = 'usuario'

function leerSesionGuardada(): { token: string; usuario: UsuarioSesion } | null {
  for (const storage of [localStorage, sessionStorage]) {
    const token = storage.getItem(CLAVE_TOKEN)
    const usuarioRaw = storage.getItem(CLAVE_USUARIO)
    if (token && usuarioRaw) {
      try {
        return { token, usuario: JSON.parse(usuarioRaw) as UsuarioSesion }
      } catch {
        return null
      }
    }
  }
  return null
}

function limpiarSesionGuardada(): void {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(CLAVE_TOKEN)
    storage.removeItem(CLAVE_USUARIO)
  }
  limpiarRolActivo()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [mensajeSesionExpirada, setMensajeSesionExpirada] = useState<string | null>(null)
  const limpiarMensajeSesionExpirada = useCallback(() => setMensajeSesionExpirada(null), [])

  useEffect(() => {
    const sesion = leerSesionGuardada()
    if (sesion) {
      setToken(sesion.token)
      setUsuario(sesion.usuario)
    }
    setCargando(false)
  }, [])

  const iniciarSesion = useCallback(async (correo: string, contraseña: string) => {

    const cuentaLocal = buscarCuentaLocalDev(correo, contraseña)
    const respuesta = cuentaLocal
      ? { mensaje: 'Sesión local de desarrollo', token: `${PREFIJO_TOKEN_LOCAL_DEV}${Date.now()}`, usuario: cuentaLocal }
      : await authApi.login(correo, contraseña)

    limpiarSesionGuardada()
    // Siempre en localStorage: así una sesión iniciada en una pestaña se
    // reconoce en cualquier otra pestaña nueva del mismo navegador, en vez
    // de pedir login otra vez (sessionStorage no se comparte entre pestañas).
    localStorage.setItem(CLAVE_TOKEN, respuesta.token)
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(respuesta.usuario))

    setToken(respuesta.token)
    setUsuario(respuesta.usuario)
    return respuesta.usuario
  }, [])

  const cerrarSesion = useCallback(() => {
    const eraSesionLocalDev = esTokenLocalDev(token)
    // Se llama al backend ANTES de borrar el token guardado — si se borra
    // primero, esta petición sale sin token, el backend responde 401 "falta
    // el token" y eso dispara por error el popup de "sesión expirada" en un
    // cierre de sesión manual, que no debe mostrar ningún mensaje.
    if (!eraSesionLocalDev) authApi.logout().catch(() => {})

    limpiarSesionGuardada()
    setToken(null)
    setUsuario(null)
  }, [token])

  useEffect(() => {
    function manejarSesionExpirada(evento: Event) {
      limpiarSesionGuardada()
      setToken(null)
      setUsuario(null)
      const detalle = (evento as CustomEvent<DetalleSesionExpirada>).detail
      setMensajeSesionExpirada(detalle?.mensaje ?? 'Tu sesión expiró. Vuelve a iniciar sesión.')
      navigate('/', { replace: true })
    }
    window.addEventListener(EVENTO_SESION_EXPIRADA, manejarSesionExpirada)
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, manejarSesionExpirada)
  }, [navigate])

  // Sincroniza sesión entre pestañas: el evento "storage" solo llega a las
  // OTRAS pestañas (no a la que hizo el cambio), así que si alguien inicia o
  // cierra sesión en una pestaña, las demás lo reflejan de inmediato en vez
  // de quedarse con datos de una sesión que ya no existe (o sin ver la nueva).
  useEffect(() => {
    function manejarCambioStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== CLAVE_TOKEN && e.key !== CLAVE_USUARIO) return
      const sesion = leerSesionGuardada()
      setToken(sesion?.token ?? null)
      setUsuario(sesion?.usuario ?? null)
    }
    window.addEventListener('storage', manejarCambioStorage)
    return () => window.removeEventListener('storage', manejarCambioStorage)
  }, [])

  const ultimoPingRef = useRef(0)
  const registrarLatidoActividad = useCallback(() => {

    if (!token || esTokenLocalDev(token)) return
    const ahora = Date.now()
    if (ahora - ultimoPingRef.current < INTERVALO_MIN_ACTIVIDAD_MS) return
    ultimoPingRef.current = ahora
    authApi.registrarActividad().catch(() => {

    })
  }, [token])

  useEffect(() => {
    if (!token) return
    registrarLatidoActividad()
  }, [location.pathname, token, registrarLatidoActividad])

  useEffect(() => {
    if (!token) return
    window.addEventListener('click', registrarLatidoActividad)
    window.addEventListener('keydown', registrarLatidoActividad)
    return () => {
      window.removeEventListener('click', registrarLatidoActividad)
      window.removeEventListener('keydown', registrarLatidoActividad)
    }
  }, [token, registrarLatidoActividad])

  const tieneRol = useCallback(
    (...roles: string[]) => usuario !== null && roles.some((r) => usuario.roles.includes(r)),
    [usuario]
  )

  const actualizarUsuarioSesion = useCallback((datos: Partial<UsuarioSesion>) => {
    setUsuario((actual) => {
      if (!actual) return actual
      const actualizado = { ...actual, ...datos }
      const storage = localStorage.getItem(CLAVE_USUARIO) ? localStorage : sessionStorage
      storage.setItem(CLAVE_USUARIO, JSON.stringify(actualizado))
      return actualizado
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        cargando,
        iniciarSesion,
        cerrarSesion,
        tieneRol,
        actualizarUsuarioSesion,
        mensajeSesionExpirada,
        limpiarMensajeSesionExpirada,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext)
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return contexto
}
