import { apiFetch, apiFetchFormData, apiFetchBlob } from './client'

export interface DocumentoProyecto {
  id_proyecto_documento: number
  id_proyecto: number
  id_tipo_documento: number
  archivo: string
  fecha_carga: string
  /** null = pendiente de revisión, true = aprobado, false = rechazado (RQF39) */
  aprobado_rechazado: boolean | null
  tipoDocumento: { id_tipo_documento: number; nombre: string; descripcion: string | null }
  cargadoPor: { nombre: string; apellido: string }
}

export function cargarDocumentoProyecto(id_proyecto: number, id_tipo_documento: number, archivo: File): Promise<unknown> {
  const formData = new FormData()
  formData.append('archivo', archivo)
  formData.append('id_tipo_documento', String(id_tipo_documento))
  return apiFetchFormData(`/proyectos/${id_proyecto}/documentos`, formData)
}

/** RQF38 - lista los documentos que el investigador ya cargó para el proyecto. */
export function listarDocumentosProyecto(id_proyecto: number): Promise<DocumentoProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/documentos`)
}

interface RespuestaValidacion {
  mensaje: string
  documento: DocumentoProyecto
}

/** RQF39 - aprueba o rechaza un documento cargado (solo Administrador). */
export function validarDocumento(
  id_proyecto: number,
  id_proyecto_documento: number,
  aprobado: boolean
): Promise<RespuestaValidacion> {
  return apiFetch(`/proyectos/${id_proyecto}/documentos/${id_proyecto_documento}/validacion`, {
    method: 'PATCH',
    body: JSON.stringify({ aprobado }),
  })
}

/** RQF38 - descarga el archivo real y dispara el guardado en el navegador. */
export async function descargarDocumentoProyecto(
  id_proyecto: number,
  id_proyecto_documento: number,
  nombreSugerido: string
): Promise<void> {
  const blob = await apiFetchBlob(`/proyectos/${id_proyecto}/documentos/${id_proyecto_documento}/descarga`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreSugerido
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
