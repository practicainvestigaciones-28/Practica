import type jsPDF from 'jspdf'
import logoUrl from '../../../assets/cesmag-logo.png'

// Piezas que comparten los PDF de los formatos de seguimiento (018, 019).

let logoCache: string | null = null

/** Logo institucional como data URL, para el encabezado de los formatos. */
export async function obtenerLogo(): Promise<string> {
  if (logoCache) return logoCache
  const blob = await (await fetch(logoUrl)).blob()
  logoCache = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result as string)
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(blob)
  })
  return logoCache
}

/** Los formatos numeran las páginas al pie ("Página 1 de 4"); se escribe al final, cuando ya se sabe el total. */
export function numerarPaginas(doc: jsPDF, margenX: number): void {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor('#000000')
    const { width, height } = doc.internal.pageSize
    doc.text(`Página ${i} de ${total}`, width - margenX, height - 24, { align: 'right' })
  }
}

/** Márgenes horizontales del motor de PDF según la orientación de la hoja. */
export const MARGEN_VERTICAL = 68.4
export const MARGEN_HORIZONTAL = 43.2
