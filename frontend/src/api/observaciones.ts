import { apiFetch, apiFetchFormData } from './client'

export interface ObservacionProyecto {
  id_observacion: number
  id_etapa: number
  observacion: string
  archivo_adjunto: string | null
  fecha_observacion: string
  etapa: { id_etapa: number; nombre: string; descripcion: string | null }
  usuario: { id_usuario: number; nombre: string; apellido: string }
  proyectoDocumento: {
    id_proyecto_documento: number
    id_proyecto: number
    archivo: string
    aprobado_rechazado: boolean | null
    tipoDocumento: { id_tipo_documento: number; nombre: string }
  }
}

interface RespuestaObservacion {
  mensaje: string
  observacion: ObservacionProyecto
}

export function crearObservacion(
  id_proyecto: number,
  id_proyecto_documento: number,
  datos: { id_etapa: number; observacion: string; archivo?: File }
): Promise<RespuestaObservacion> {
  const formData = new FormData()
  formData.append('id_etapa', String(datos.id_etapa))
  formData.append('observacion', datos.observacion)
  if (datos.archivo) formData.append('archivo', datos.archivo)
  return apiFetchFormData(`/proyectos/${id_proyecto}/documentos/${id_proyecto_documento}/observaciones`, formData)
}

export function listarObservacionesDocumento(
  id_proyecto: number,
  id_proyecto_documento: number
): Promise<ObservacionProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/documentos/${id_proyecto_documento}/observaciones`)
}

export function listarObservacionesProyecto(
  id_proyecto: number,
  id_etapa?: number
): Promise<ObservacionProyecto[]> {
  const qs = id_etapa ? `?id_etapa=${id_etapa}` : ''
  return apiFetch(`/proyectos/${id_proyecto}/observaciones${qs}`)
}

export function eliminarObservacion(id_proyecto: number, id_observacion: number): Promise<{ mensaje: string }> {
  return apiFetch(`/proyectos/${id_proyecto}/observaciones/${id_observacion}`, { method: 'DELETE' })
}
