import type { DatosVistaProyecto } from '../components/VistaDetalleProyecto'
import logoUrl from '../../../assets/cesmag-logo.png'
import { construirDocumento } from './exportar/contenido'
import { generarDocx } from './exportar/word'
import { generarPdf } from './exportar/pdf'

/**
 * Descarga del proyecto en el formato oficial INV-IC-FR-001 (V7): mismo encabezado,
 * tablas y orden de secciones que el formulario de la Vicerrectoría, ya diligenciado.
 * El contenido se describe una vez (./exportar/contenido) y lo dibujan Word y PDF.
 */

let logoBufferCache: ArrayBuffer | null = null
async function obtenerLogoBuffer(): Promise<ArrayBuffer> {
  if (logoBufferCache) return logoBufferCache
  const respuesta = await fetch(logoUrl)
  logoBufferCache = await respuesta.arrayBuffer()
  return logoBufferCache
}

function bufferABase64(buffer: ArrayBuffer): string {
  let binario = ''
  const bytes = new Uint8Array(buffer)
  const tamanoChunk = 0x8000
  for (let i = 0; i < bytes.length; i += tamanoChunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanoChunk))
  }
  return btoa(binario)
}

function nombreArchivo(titulo: string, extension: string): string {
  const limpio = titulo.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return `${limpio || 'proyecto'}.${extension}`
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export async function generarWordProyecto(datos: DatosVistaProyecto): Promise<void> {
  const blob = await generarDocx(construirDocumento(datos), await obtenerLogoBuffer())
  descargarBlob(blob, nombreArchivo(datos.proyecto.titulo, 'docx'))
}

export async function generarPdfProyecto(datos: DatosVistaProyecto): Promise<void> {
  const logo = `data:image/png;base64,${bufferABase64(await obtenerLogoBuffer())}`
  generarPdf(construirDocumento(datos), logo).save(nombreArchivo(datos.proyecto.titulo, 'pdf'))
}
