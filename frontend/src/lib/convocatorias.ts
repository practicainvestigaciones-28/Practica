import { apiFetch } from '../api/client'

export interface ConvocatoriaBackend {
  id_convocatoria: number
  nombre: string
  descripcion: string | null
  fecha_inicio: string
  fecha_fin: string
  estado: string
  creador: { id_usuario: number; nombre: string; apellido: string }
  fecha_creacion: string
  _count?: { proyectos: number }
}

interface RespuestaConMensaje<T> {
  mensaje: string
  convocatoria: T
}

export function listarConvocatorias(filtro?: {
  estado?: 'activa' | 'cerrada' | 'inactiva'
}): Promise<ConvocatoriaBackend[]> {
  const query = filtro?.estado ? `?estado=${filtro.estado}` : ''
  return apiFetch<ConvocatoriaBackend[]>(`/convocatorias${query}`)
}

/** Trae una convocatoria puntual — útil para revalidar su estado justo
 * antes de dejar crear un proyecto (RQF de "convocatoria según estado"). */
export function obtenerConvocatoria(id: number): Promise<ConvocatoriaBackend> {
  return apiFetch<ConvocatoriaBackend>(`/convocatorias/${id}`)
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