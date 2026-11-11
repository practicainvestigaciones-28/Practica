import { apiFetch } from '../../../shared/api/client'

/** Fases de revisión de una convocatoria, en el orden en que ocurren. Deben coincidir con las del backend. */
export const FASES_VENTANA = ['comite', 'etica', 'pares', 'reclamaciones'] as const
export type FaseVentana = (typeof FASES_VENTANA)[number]

export const NOMBRE_FASE: Record<FaseVentana, string> = {
  comite: 'Comité de Investigación',
  etica: 'Comité de Ética',
  pares: 'Pares evaluadores',
  reclamaciones: 'Reclamaciones',
}

export type EstadoVentana = 'programada' | 'abierta' | 'reabierta' | 'cerrada'

export interface VentanaBackend {
  id_convocatoria: number
  fase: FaseVentana
  abre_en: string
  cierra_en: string
  reabierta: boolean
  abierta: boolean
  estado: EstadoVentana
}

export function obtenerVentanas(id_convocatoria: number): Promise<VentanaBackend[]> {
  return apiFetch(`/convocatorias/${id_convocatoria}/ventanas`)
}

/** Reemplaza los plazos de la convocatoria: las fases que no se envíen quedan sin restricción. Fechas en ISO. */
export function guardarVentanas(
  id_convocatoria: number,
  ventanas: { fase: FaseVentana; abre_en: string; cierra_en: string }[]
): Promise<{ mensaje: string; ventanas: VentanaBackend[] }> {
  return apiFetch(`/convocatorias/${id_convocatoria}/ventanas`, {
    method: 'PUT',
    body: JSON.stringify({ ventanas }),
  })
}

/** Reabre la fase sin tocar sus fechas (mientras se hace una edición). */
export function reabrirVentana(id_convocatoria: number, fase: FaseVentana): Promise<{ mensaje: string; ventanas: VentanaBackend[] }> {
  return apiFetch(`/convocatorias/${id_convocatoria}/ventanas/${fase}/reabrir`, { method: 'PATCH' })
}

/** Termina la reapertura: la fase vuelve a regirse por sus fechas. */
export function cerrarVentana(id_convocatoria: number, fase: FaseVentana): Promise<{ mensaje: string; ventanas: VentanaBackend[] }> {
  return apiFetch(`/convocatorias/${id_convocatoria}/ventanas/${fase}/cerrar`, { method: 'PATCH' })
}
