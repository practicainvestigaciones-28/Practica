import { apiFetch } from './client'

export interface ConvocatoriaBackend {
  id_convocatoria: number
  nombre: string
  descripcion: string | null
  fecha_inicio: string
  fecha_fin: string
  estado: string
  creado_por: number
  fecha_creacion: string
  _count?: { proyectos: number }
}

interface RespuestaConMensaje<T> {
  mensaje: string
  convocatoria: T
}

export function listarConvocatorias(): Promise<ConvocatoriaBackend[]> {
  return apiFetch<ConvocatoriaBackend[]>('/convocatorias')
}

export function crearConvocatoria(datos: {
  nombre: string
  fecha_inicio: string
  fecha_fin: string
}): Promise<RespuestaConMensaje<ConvocatoriaBackend>> {
  return apiFetch('/convocatorias', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function actualizarConvocatoria(
  id: number,
  datos: { nombre?: string; fecha_inicio?: string; fecha_fin?: string }
): Promise<RespuestaConMensaje<ConvocatoriaBackend>> {
  return apiFetch(`/convocatorias/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}

export function cambiarEstadoConvocatoria(
  id: number,
  estado: 'activa' | 'cerrada' | 'inactiva'
): Promise<RespuestaConMensaje<ConvocatoriaBackend>> {
  return apiFetch(`/convocatorias/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  })
}

export function eliminarConvocatoria(id: number): Promise<{ mensaje: string }> {
  return apiFetch(`/convocatorias/${id}`, { method: 'DELETE' })
}
