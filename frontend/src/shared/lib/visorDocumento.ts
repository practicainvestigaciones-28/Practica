/**
 * Abre un documento en el visor de la aplicación (VisorDocumento, montado en el diseño principal). Así los PDF y las
 * imágenes se ven dentro de la propia página, sin depender del visor del navegador ni de extensiones como Acrobat, que a
 * veces se quedan "cargando" con los archivos que la aplicación abre desde la memoria.
 */
export const EVENTO_ABRIR_VISOR = 'app:abrir-visor'

export interface DetalleVisor {
  blob: Blob
  nombre: string
}

export function abrirVisor(blob: Blob, nombre: string): void {
  window.dispatchEvent(new CustomEvent<DetalleVisor>(EVENTO_ABRIR_VISOR, { detail: { blob, nombre } }))
}
