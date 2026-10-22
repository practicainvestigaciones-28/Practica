import { leerDocumentoXml } from './leerDocx'
import { extraerProyectoDeDocx } from './extraerCampos'
import { DocxInvalidoError, type ResultadoImportacionDocx } from './tipos'

export type { ResultadoImportacionDocx, ExtraccionProyectoDocx } from './tipos'
export { construirBorradorDesdeExtraccion, type CatalogosParaImportar } from './emparejarCatalogos'

/** Lee un .docx del formato INV-IC-FR-001 diligenciado y extrae sus datos en texto crudo. */
export async function importarProyectoDesdeDocx(archivo: File): Promise<ResultadoImportacionDocx> {
  try {
    const doc = await leerDocumentoXml(archivo)
    return extraerProyectoDeDocx(doc)
  } catch (error) {
    if (error instanceof DocxInvalidoError) {
      return { extraccion: null, advertencias: [], error: error.message }
    }
    return { extraccion: null, advertencias: [], error: 'No se pudo leer el documento. Verifica que sea un archivo .docx válido.' }
  }
}
