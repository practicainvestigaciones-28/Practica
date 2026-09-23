import { apiFetch } from '../../../shared/api/client'

export interface NotificacionBackend {
  id_notificacion: number
  id_usuario: number
  titulo: string
  mensaje: string
  leida: boolean
  fecha_notificacion: string
  enlace: string | null
}

export function listarNotificaciones(): Promise<NotificacionBackend[]> {
  return apiFetch('/notificaciones')
}

export function contarNoLeidas(): Promise<{ total: number }> {
  return apiFetch('/notificaciones/no-leidas')
}

export function marcarLeida(id_notificacion: number): Promise<{ mensaje: string }> {
  return apiFetch(`/notificaciones/${id_notificacion}/leida`, { method: 'PATCH' })
}

/** Solo Administrador: crea una notificación para otro usuario. */
export function crearNotificacion(
  id_usuario: number,
  datos: { titulo: string; mensaje: string; enlace?: string }
): Promise<{ mensaje: string; registro: NotificacionBackend }> {
  return apiFetch('/notificaciones', {
    method: 'POST',
    body: JSON.stringify({ id_usuario, ...datos }),
  })
}
