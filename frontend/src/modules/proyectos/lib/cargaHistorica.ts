import type { UsuarioBuscado } from '../../usuarios/api/usuarios'
import type { ResultadoLecturaPdfProyecto } from './importar/pdf/extraerCamposPdf'

/** Tamaño máximo de cada PDF que se anexa al cargar un proyecto finalizado. */
export const TAMANO_MAXIMO_PDF = 5 * 1024 * 1024

/** Máximo de informes de avance (uno por periodo de 6 meses, hasta 3 años de duración). */
export const MAXIMO_INFORMES_AVANCE = 6

/** Selección de la pantalla "Cargar proyecto finalizado": quién, en qué convocatoria histórica y los PDF a leer. */
export interface SeleccionCargaHistorica {
  investigador: UsuarioBuscado
  id_convocatoria: number
  proyecto: File
  actaInicio: File | null
  /** Uno por periodo, en orden (el primero es el periodo 1); un espacio vacío es un periodo sin PDF. */
  informesAvance: (File | null)[]
  informeFinal: File | null
  actaCierre: File | null
}

// Los archivos no se pueden guardar en el navegador (ni en localStorage), así que viven solo en memoria mientras la
// persona sigue con la carga; si recarga la página, hay que volver a elegirlos.
let seleccionActual: SeleccionCargaHistorica | null = null

export function guardarSeleccionCargaHistorica(seleccion: SeleccionCargaHistorica): void {
  seleccionActual = seleccion
}

export function obtenerSeleccionCargaHistorica(): SeleccionCargaHistorica | null {
  return seleccionActual
}

export function limpiarSeleccionCargaHistorica(): void {
  seleccionActual = null
  lecturaProyectoActual = null
}

// Lo que se leyó del PDF del proyecto: lo usa la pantalla de revisión para llenar el formulario.
let lecturaProyectoActual: ResultadoLecturaPdfProyecto | null = null

export function guardarLecturaProyecto(lectura: ResultadoLecturaPdfProyecto): void {
  lecturaProyectoActual = lectura
}

export function obtenerLecturaProyecto(): ResultadoLecturaPdfProyecto | null {
  return lecturaProyectoActual
}

/** Mensaje de error si el archivo no sirve (no es PDF, está vacío o pesa demasiado); null si está bien. */
export function validarPdf(archivo: File): string | null {
  const esPdf = archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf')
  if (!esPdf) return `"${archivo.name}" no es un PDF.`
  if (archivo.size === 0) return `"${archivo.name}" está vacío.`
  if (archivo.size > TAMANO_MAXIMO_PDF) return `"${archivo.name}" pesa más de ${TAMANO_MAXIMO_PDF / 1024 / 1024} MB.`
  return null
}

export function tamanoLegible(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
