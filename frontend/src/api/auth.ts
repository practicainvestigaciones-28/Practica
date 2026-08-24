import { apiFetch } from './client'

export interface UsuarioSesion {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  roles: string[]
}

interface RespuestaLogin {
  mensaje: string
  token: string
  usuario: UsuarioSesion
}

interface RespuestaMensaje {
  mensaje: string
}

export function login(correo: string, contraseña: string): Promise<RespuestaLogin> {
  return apiFetch<RespuestaLogin>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo, contraseña }),
    conAuth: false,
  })
}

export function logout(): Promise<RespuestaMensaje> {
  return apiFetch<RespuestaMensaje>('/auth/logout', { method: 'POST' })
}

export function obtenerPerfil(): Promise<UsuarioSesion> {
  return apiFetch<UsuarioSesion>('/auth/perfil')
}

export function solicitarRecuperacion(correo: string): Promise<RespuestaMensaje> {
  return apiFetch<RespuestaMensaje>('/auth/recuperar-contrasena', {
    method: 'POST',
    body: JSON.stringify({ correo }),
    conAuth: false,
  })
}

export function restablecerContraseña(token: string, nuevaContraseña: string): Promise<RespuestaMensaje> {
  return apiFetch<RespuestaMensaje>('/auth/restablecer-contrasena', {
    method: 'POST',
    body: JSON.stringify({ token, nuevaContraseña }),
    conAuth: false,
  })
}

export function cambiarContraseña(contraseñaActual: string, contraseñaNueva: string): Promise<RespuestaMensaje> {
  return apiFetch<RespuestaMensaje>('/auth/cambiar-contrasena', {
    method: 'PATCH',
    body: JSON.stringify({ contraseñaActual, contraseñaNueva }),
  })
}
