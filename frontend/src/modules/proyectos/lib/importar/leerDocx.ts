import JSZip from 'jszip'
import { DocxInvalidoError } from './tipos'

/** Descomprime un .docx (es un zip) y devuelve el XML de word/document.xml ya parseado. */
export async function leerDocumentoXml(archivo: File): Promise<Document> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(archivo)
  } catch {
    throw new DocxInvalidoError('El archivo no es un documento Word (.docx) válido.')
  }

  const entrada = zip.file('word/document.xml')
  if (!entrada) {
    throw new DocxInvalidoError('El archivo no tiene la estructura de un documento Word (.docx).')
  }

  const xml = await entrada.async('text')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new DocxInvalidoError('No se pudo leer el contenido del documento Word.')
  }

  return doc
}
