import * as pdfjs from 'pdfjs-dist'
import trabajadorPdf from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { agruparEnLineas, type FragmentoTexto, type LineaPdf } from './lineasPdf'

pdfjs.GlobalWorkerOptions.workerSrc = trabajadorPdf

export class PdfSinTextoError extends Error {}

/**
 * Lee un PDF con texto seleccionable y devuelve sus líneas (página por página, de arriba hacia abajo). Un PDF que es
 * solo una imagen escaneada no tiene texto: en ese caso lanza PdfSinTextoError y los datos se llenan a mano.
 */
export async function leerLineasDePdf(archivo: File): Promise<LineaPdf[]> {
  const datos = new Uint8Array(await archivo.arrayBuffer())
  const documento = await pdfjs.getDocument({ data: datos }).promise
  const lineas: LineaPdf[] = []

  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero)
    const { height } = pagina.getViewport({ scale: 1 })
    const contenido = await pagina.getTextContent()
    const fragmentos: FragmentoTexto[] = []
    for (const item of contenido.items) {
      if (!('str' in item)) continue
      fragmentos.push({ texto: item.str, x: item.transform[4], y: item.transform[5], ancho: item.width, alto: item.height })
    }
    lineas.push(...agruparEnLineas(fragmentos, numero, height))
  }

  await documento.destroy()
  if (lineas.length === 0) {
    throw new PdfSinTextoError('El PDF no tiene texto que se pueda leer (parece un escaneo). Los datos se llenan a mano.')
  }
  return lineas
}
