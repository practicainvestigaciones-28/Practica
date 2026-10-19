import type jsPDF from 'jspdf'
import type { Bloque, CeldaSpec, Texto } from '../../proyectos/lib/exportar/modelo'
import logoUrl from '../../../assets/cesmag-logo.png'

// Piezas que comparten los PDF de los formatos de seguimiento (018, 019).

/** Cierre de cada documento (acta de inicio, informes de avance y final, acta de cierre): constancia de que lo revisó
 * el Administrador. Con el documento ya revisado queda marcado; si no, queda el espacio de firma. */
export function bloqueRevisionAdministrador(revisado: boolean, size = 9.5): Bloque {
  const sinBorde = { bordes: false as const, valign: 'top' as const }
  const fila = (texto: Texto, o: Partial<CeldaSpec> = {}): CeldaSpec[] => [
    { w: 40, texto, size, ...o },
    { w: 60, texto: '', bordes: false },
  ]
  const constancia: Texto = revisado ? [{ t: 'Revisado', i: true, color: '1E7A46' }] : [{ t: 'FIRMA', color: 'BFBFBF', b: true }]
  return {
    tipo: 'tabla',
    tabla: {
      filas: [
        fila(constancia, { bordes: { b: true }, valign: 'bottom', minH: 34 }),
        fila('REVISADO POR EL ADMINISTRADOR', { ...sinBorde, negrita: true }),
        fila('Administrador del sistema', sinBorde),
      ],
    },
  }
}

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
