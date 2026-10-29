/** Normaliza para comparar texto libre contra un catálogo: sin tildes, minúsculas, espacios colapsados. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export type ResultadoEmparejamiento<T> =
  | { tipo: 'exacto'; item: T }
  | { tipo: 'normalizado'; item: T }
  | { tipo: 'no_encontrado'; textoOriginal: string }

/**
 * Busca `textoBuscado` dentro de `catalogo` comparando por nombre, primero de
 * forma exacta y luego normalizada (sin tildes/mayúsculas/espacios extra). No
 * hace coincidencia aproximada ("fuzzy"): si no hay una coincidencia clara,
 * devuelve 'no_encontrado' en vez de adivinar.
 */
export function emparejarContraCatalogo<T>(
  textoBuscado: string | null | undefined,
  catalogo: T[],
  obtenerNombre: (item: T) => string
): ResultadoEmparejamiento<T> {
  const texto = (textoBuscado ?? '').trim()
  if (!texto) return { tipo: 'no_encontrado', textoOriginal: texto }

  const exacto = catalogo.find((item) => obtenerNombre(item) === texto)
  if (exacto) return { tipo: 'exacto', item: exacto }

  const textoNorm = normalizarTexto(texto)
  const normalizado = catalogo.find((item) => normalizarTexto(obtenerNombre(item)) === textoNorm)
  if (normalizado) return { tipo: 'normalizado', item: normalizado }

  return { tipo: 'no_encontrado', textoOriginal: texto }
}
