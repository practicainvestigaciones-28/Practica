import type { Evidencia } from '../api/tipos'
import { abrirVisor } from '../../../shared/lib/visorDocumento'
import { apiFetchBlob, apiFetchFormData, descargarBlobComoArchivo } from '../../../shared/api/client'

// Archivos de las evidencias: se suben al servidor al adjuntarlos y el informe guarda solo su referencia (el `id` es el nombre en el servidor).

export const TAMANO_MAXIMO_EVIDENCIA = 10 * 1024 * 1024
export const EXTENSIONES_EVIDENCIA = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.zip', '.mp4']

/** Sube el archivo y devuelve la evidencia que se anota en el informe. Lanza un Error con el motivo si no es válido. */
export async function guardarArchivoEvidencia(archivo: File): Promise<Evidencia> {
  const extension = archivo.name.slice(archivo.name.lastIndexOf('.')).toLowerCase()
  if (!EXTENSIONES_EVIDENCIA.includes(extension)) throw new Error(`Tipo de archivo no permitido. Usa: ${EXTENSIONES_EVIDENCIA.join(', ')}.`)
  if (archivo.size > TAMANO_MAXIMO_EVIDENCIA) throw new Error('El archivo supera los 10 MB.')
  const datos = new FormData()
  datos.append('archivo', archivo)
  return apiFetchFormData<Evidencia>('/seguimiento/evidencias/archivo', datos)
}

export const etiquetaEvidencia = (ev: Evidencia) => (ev.tipo === 'enlace' ? ev.url : ev.nombre)

export const esEnlaceValido = (texto: string) => {
  try {
    const url = new URL(texto.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const formatoTamano = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/** Abre la evidencia: el enlace en otra pestaña y el archivo en el visor del navegador. */
export async function verEvidencia(ev: Evidencia): Promise<void> {
  if (ev.tipo === 'enlace') {
    window.open(ev.url, '_blank', 'noopener,noreferrer')
    return
  }
  abrirVisor(await apiFetchBlob(`/seguimiento/evidencias/archivo/${encodeURIComponent(ev.id)}`), ev.nombre)
}

/** Descarga el archivo de la evidencia con su nombre original. */
export async function descargarEvidencia(ev: Evidencia): Promise<void> {
  if (ev.tipo === 'enlace') {
    window.open(ev.url, '_blank', 'noopener,noreferrer')
    return
  }
  descargarBlobComoArchivo(await apiFetchBlob(`/seguimiento/evidencias/archivo/${encodeURIComponent(ev.id)}`), ev.nombre)
}
