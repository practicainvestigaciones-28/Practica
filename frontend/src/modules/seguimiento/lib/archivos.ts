import type { Evidencia } from '../api/tipos'

// Archivos de las evidencias. Mientras el seguimiento viva en el navegador (almacén local), el contenido de cada
// archivo se guarda en IndexedDB y en el informe queda solo su referencia; con backend se subirá vía apiFetchFormData.

const BASE_DATOS = 'sgpvie_seguimiento_archivos'
const ALMACEN = 'evidencias'

export const TAMANO_MAXIMO_EVIDENCIA = 10 * 1024 * 1024
export const EXTENSIONES_EVIDENCIA = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.zip', '.mp4']

function abrirBase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(BASE_DATOS, 1)
    solicitud.onupgradeneeded = () => solicitud.result.createObjectStore(ALMACEN)
    solicitud.onsuccess = () => resolve(solicitud.result)
    solicitud.onerror = () => reject(solicitud.error)
  })
}

async function operar<T>(modo: IDBTransactionMode, accion: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrirBase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const solicitud = accion(bd.transaction(ALMACEN, modo).objectStore(ALMACEN))
      solicitud.onsuccess = () => resolve(solicitud.result)
      solicitud.onerror = () => reject(solicitud.error)
    })
  } finally {
    bd.close()
  }
}

const nuevoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** Guarda el archivo y devuelve la evidencia que se anota en el informe. Lanza un Error con el motivo si no es válido. */
export async function guardarArchivoEvidencia(archivo: File): Promise<Evidencia> {
  const extension = archivo.name.slice(archivo.name.lastIndexOf('.')).toLowerCase()
  if (!EXTENSIONES_EVIDENCIA.includes(extension)) throw new Error(`Tipo de archivo no permitido. Usa: ${EXTENSIONES_EVIDENCIA.join(', ')}.`)
  if (archivo.size > TAMANO_MAXIMO_EVIDENCIA) throw new Error('El archivo supera los 10 MB.')
  const id = nuevoId()
  try {
    await operar('readwrite', (a) => a.put(archivo, id))
  } catch {
    throw new Error('No se pudo guardar el archivo en este navegador.')
  }
  return { tipo: 'archivo', id, nombre: archivo.name, tamano: archivo.size, mime: archivo.type }
}

export async function obtenerArchivoEvidencia(id: string): Promise<Blob | undefined> {
  if (!id) return undefined
  return (await operar<Blob | undefined>('readonly', (a) => a.get(id))) ?? undefined
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
  const blob = await obtenerArchivoEvidencia(ev.id)
  if (!blob) throw new Error('El archivo ya no está disponible en este navegador.')
  window.open(URL.createObjectURL(blob), '_blank', 'noopener')
}

/** Descarga el archivo de la evidencia con su nombre original. */
export async function descargarEvidencia(ev: Evidencia): Promise<void> {
  if (ev.tipo === 'enlace') {
    window.open(ev.url, '_blank', 'noopener,noreferrer')
    return
  }
  const blob = await obtenerArchivoEvidencia(ev.id)
  if (!blob) throw new Error('El archivo ya no está disponible en este navegador.')
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = ev.nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
