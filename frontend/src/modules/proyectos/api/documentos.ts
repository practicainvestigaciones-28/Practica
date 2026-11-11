import { apiFetch, apiFetchFormData, apiFetchBlob } from '../../../shared/api/client'
import { abrirVisor } from '../../../shared/lib/visorDocumento'

export interface DocumentoProyecto {
  id_proyecto_documento: number
  id_proyecto: number
  id_tipo_documento: number
  archivo: string
  /** Nombre con el que se subió (null en documentos cargados antes de guardarlo). */
  nombre_original: string | null
  /** A quién corresponde (el estudiante de cada Acta de compromiso); null si no aplica. */
  titular: string | null
  fecha_carga: string

  aprobado_rechazado: boolean | null
  tipoDocumento: { id_tipo_documento: number; nombre: string; descripcion: string | null }
  cargadoPor: { nombre: string; apellido: string }
}

export function cargarDocumentoProyecto(
  id_proyecto: number,
  id_tipo_documento: number,
  archivo: File,
  /** A quién corresponde el documento (ej. el estudiante de un Acta de compromiso). */
  titular?: string
): Promise<unknown> {
  const formData = new FormData()
  formData.append('id_tipo_documento', String(id_tipo_documento))
  if (titular?.trim()) formData.append('titular', titular.trim())
  formData.append('archivo', archivo)
  return apiFetchFormData(`/proyectos/${id_proyecto}/documentos`, formData)
}

export function listarDocumentosProyecto(id_proyecto: number): Promise<DocumentoProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/documentos`)
}

interface RespuestaValidacion {
  mensaje: string
  documento: DocumentoProyecto
}

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

/**
 * Muestra el documento en el visor de la aplicación (sin descargarlo). No se usa una pestaña del navegador porque
 * extensiones como Acrobat se quedan "cargando" con los archivos que se abren desde la memoria.
 */
export async function verDocumentoProyecto(id_proyecto: number, id_proyecto_documento: number, nombre = 'Documento'): Promise<void> {
  const blob = await apiFetchBlob(`/proyectos/${id_proyecto}/documentos/${id_proyecto_documento}/descarga`)
  abrirVisor(blob, nombre)
}
