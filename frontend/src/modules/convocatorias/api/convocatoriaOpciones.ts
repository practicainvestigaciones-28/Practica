import { apiFetch } from '../../../shared/api/client'

/**
 * Tipos de catálogo que se pueden restringir por convocatoria. Deben
 * coincidir exactamente con los `tipo` que acepta el backend
 * (convocatoria-opciones.service.ts).
 */
export type TipoOpcionConvocatoria =
  | 'periodo'
  | 'programa'
  | 'facultad'
  | 'grupo'
  | 'linea'
  | 'ods'
  | 'area'
  | 'modalidad'
  | 'tipo_proyecto'
  | 'categoria_producto'

/** Opciones configuradas para una convocatoria, agrupadas por tipo. Un tipo ausente = sin restricción (catálogo global completo). */
export function obtenerOpciones(id_convocatoria: number): Promise<Record<string, number[]>> {
  return apiFetch(`/convocatorias/${id_convocatoria}/opciones`)
}

/** Reemplaza el conjunto completo de ids seleccionados para un tipo de catálogo en una convocatoria. */
export function reemplazarOpciones(
  id_convocatoria: number,
  tipo: TipoOpcionConvocatoria,
  ids: number[]
): Promise<{ mensaje: string; registro: { tipo: string; ids: number[] } }> {
  return apiFetch(`/convocatorias/${id_convocatoria}/opciones`, {
    method: 'PUT',
    body: JSON.stringify({ tipo, ids }),
  })
}

export interface LimiteTextoConvocatoria {
  id_convocatoria: number
  clave: string
  max_caracteres: number
}

export function obtenerLimitesTexto(id_convocatoria: number): Promise<LimiteTextoConvocatoria[]> {
  return apiFetch(`/convocatorias/${id_convocatoria}/limites-texto`)
}

export function reemplazarLimitesTexto(
  id_convocatoria: number,
  limites: { clave: string; max_caracteres: number }[]
): Promise<{ mensaje: string }> {
  return apiFetch(`/convocatorias/${id_convocatoria}/limites-texto`, {
    method: 'PUT',
    body: JSON.stringify({ limites }),
  })
}
