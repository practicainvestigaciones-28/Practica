import type jsPDF from 'jspdf'
import type { Bloque, CeldaSpec, Texto } from '../../proyectos/lib/exportar/modelo'
import logoUrl from '../../../assets/cesmag-logo.png'
import { FIRMA_ELABORA } from '../../../shared/lib/firmaElabora'

/** Nombre y cargo de la Administración en el sello ("Elaborado por" en las actas, "Revisado por" en los informes): siempre los de FIRMA_ELABORA. */
const selloAdministrador: { nombre: string; cargo: string } = FIRMA_ELABORA

// Piezas que comparten los PDF de los formatos de seguimiento (018, 019).

/** Constancia de la firma electrónica bajo el recuadro de firma: ID de transacción y hash SHA-256 de lo firmado. Sin firma (o con el
 * sello del Administrador, que no la lleva) queda una celda vacía. */
export function celdaEvidenciaFirma(f: { id_transaccion?: string | null; hash_firma?: string | null } | undefined, w: number): CeldaSpec {
  if (!f?.id_transaccion) return { w, texto: '', bordes: false, minH: 1, size: 7 }
  // El ID y el hash son largos y sin espacios: se parten en renglones para que no se salgan de la celda.
  const hash = f.hash_firma ?? ''
  const texto = `ID de transacción:
${f.id_transaccion}
Hash:
${hash.slice(0, 32)}
${hash.slice(32)}`
  return { w, texto: [{ t: texto, color: '555555' }], bordes: false, valign: 'top', size: 7, minH: 40 }
}

/** Sello de la Administración ("Elaborado por:" en las actas, "Revisado por:" en los informes): nombre y cargo de quien
 * firma por la Administración. Con `estampado` (acta firmada o informe aprobado) va con la verificación; si no, apagado. */
export function bloqueSello(rotulo: 'Revisado por:' | 'Elaborado por:', estampado: boolean): Bloque {
  return { tipo: 'sello', sello: { titulo: rotulo, lineas: [selloAdministrador.nombre, selloAdministrador.cargo].filter(Boolean), estampado } }
}

/** Cierre de los informes de avance y final: constancia de que los revisó el Administrador. Aprobado el informe se estampa
 * el sello "Revisado por"; con `true` (sin fecha) o sin aprobar queda el espacio de revisión. */
export function bloqueRevisionAdministrador(revisado: boolean | { nombre: string; fecha: string } | null | undefined, size = 9.5): Bloque {
  if (revisado) return bloqueSello('Revisado por:', true)
  const hueco: CeldaSpec = { w: 60, texto: '', bordes: false }

  const sinBorde = { bordes: false as const, valign: 'top' as const }
  const fila = (texto: Texto, o: Partial<CeldaSpec> = {}): CeldaSpec[] => [{ w: 40, texto, size, ...o }, hueco]
  return {
    tipo: 'tabla',
    tabla: {
      filas: [
        fila([{ t: 'REVISIÓN', color: 'BFBFBF', b: true }], { bordes: { b: true }, valign: 'bottom', minH: 34 }),
        fila('REVISADO POR EL ADMINISTRADOR', { ...sinBorde, negrita: true }),
        fila(selloAdministrador.cargo, sinBorde),
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
