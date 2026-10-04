import { apiFetch } from '../../../shared/api/client'

export type EstadoReclamacion = 'pendiente' | 'en_revision' | 'resuelta'

export interface ReclamacionBackend {
  id_reclamacion: number
  id_proyecto: number
  id_evaluacion: number | null
  etapa_rechazo: string
  motivo_reclamacion: string
  respuesta: string | null
  fecha_reclamacion: string
  fecha_respuesta: string | null
  estado: EstadoReclamacion
  proyecto: { id_proyecto: number; titulo: string }
  usuarioReclamante: { id_usuario: number; nombre: string; apellido: string }
  usuarioRespuesta: { id_usuario: number; nombre: string; apellido: string } | null
}

/** El investigador presenta una reclamación sobre su propio proyecto rechazado. */
export function crearReclamacion(id_proyecto: number, motivo: string): Promise<{ mensaje: string; reclamacion: ReclamacionBackend }> {
  return apiFetch('/reclamaciones', {
    method: 'POST',
    body: JSON.stringify({ id_proyecto, motivo }),
  })
}

/** Solo Administrador: todas las reclamaciones del sistema. */
export function listarReclamaciones(): Promise<ReclamacionBackend[]> {
  return apiFetch('/reclamaciones')
}

/** Las reclamaciones propias del investigador autenticado. */
export function listarMisReclamaciones(): Promise<ReclamacionBackend[]> {
  return apiFetch('/reclamaciones?mias=true')
}

/** La reclamación propia (si existe) sobre un proyecto puntual — null si nunca reclamó. */
export function obtenerReclamacionDeProyecto(id_proyecto: number): Promise<ReclamacionBackend | null> {
  return apiFetch(`/reclamaciones/proyecto/${id_proyecto}`)
}

/** Solo Administrador. */
export function marcarEnRevision(id_reclamacion: number): Promise<{ mensaje: string; reclamacion: ReclamacionBackend }> {
  return apiFetch(`/reclamaciones/${id_reclamacion}/en-revision`, { method: 'PATCH' })
}

/** Solo Administrador. */
export function responderReclamacion(id_reclamacion: number, respuesta: string): Promise<{ mensaje: string; reclamacion: ReclamacionBackend }> {
  return apiFetch(`/reclamaciones/${id_reclamacion}/responder`, {
    method: 'PATCH',
    body: JSON.stringify({ respuesta }),
  })
}
