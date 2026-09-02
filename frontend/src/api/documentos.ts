import { apiFetchFormData } from './client'

export function cargarDocumentoProyecto(id_proyecto: number, id_tipo_documento: number, archivo: File): Promise<unknown> {
  const formData = new FormData()
  formData.append('archivo', archivo)
  formData.append('id_tipo_documento', String(id_tipo_documento))
  return apiFetchFormData(`/proyectos/${id_proyecto}/documentos`, formData)
}
