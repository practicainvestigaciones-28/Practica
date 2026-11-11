/**
 * Abre un documento en el visor de la aplicación (VisorDocumento, montado en el diseño principal). Así los PDF y las
 * imágenes se ven dentro de la propia página, sin depender del visor del navegador ni de extensiones como Acrobat, que a
 * veces se quedan "cargando" con los archivos que la aplicación abre desde la memoria.
 */
export const EVENTO_ABRIR_VISOR = 'app:abrir-visor'

/** Otro formato en el que se puede descargar el mismo documento (ej. el Word del proyecto). */
export interface DescargaAdicional {
  etiqueta: string
  accion: () => Promise<void> | void
}

export interface DetalleVisor {
  blob: Blob
  nombre: string
  /** Formatos extra para el botón Descargar, además del archivo que se está viendo. */
  descargasAdicionales?: DescargaAdicional[]
}

export function abrirVisor(blob: Blob, nombre: string, descargasAdicionales?: DescargaAdicional[]): void {
  window.dispatchEvent(new CustomEvent<DetalleVisor>(EVENTO_ABRIR_VISOR, { detail: { blob, nombre, descargasAdicionales } }))
}
