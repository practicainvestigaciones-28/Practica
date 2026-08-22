import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { UsuarioSesion } from '../api/auth'

interface AuthContextValue {
  usuario: UsuarioSesion | null
  token: string | null
  cargando: boolean
  iniciarSesion: (correo: string, contraseña: string, recordarme: boolean) => Promise<void>
  cerrarSesion: () => void
  /** true si el usuario autenticado tiene alguno de los roles indicados */
  tieneRol: (...roles: string[]) => boolean
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
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const sesion = leerSesionGuardada()
    if (sesion) {
      setToken(sesion.token)
      setUsuario(sesion.usuario)
    }
    setCargando(false)
  }, [])

  const iniciarSesion = useCallback(async (correo: string, contraseña: string, recordarme: boolean) => {
    const respuesta = await authApi.login(correo, contraseña)

    limpiarSesionGuardada()
    const storage = recordarme ? localStorage : sessionStorage
    storage.setItem(CLAVE_TOKEN, respuesta.token)
    storage.setItem(CLAVE_USUARIO, JSON.stringify(respuesta.usuario))

    setToken(respuesta.token)
    setUsuario(respuesta.usuario)
  }, [])

  const cerrarSesion = useCallback(() => {
    limpiarSesionGuardada()
    setToken(null)
    setUsuario(null)
    authApi.logout().catch(() => {})
  }, [])

  const tieneRol = useCallback(
    (...roles: string[]) => usuario !== null && roles.some((r) => usuario.roles.includes(r)),
    [usuario]
  )

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, iniciarSesion, cerrarSesion, tieneRol }}>
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
