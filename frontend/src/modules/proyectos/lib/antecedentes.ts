// Los antecedentes se escriben en un solo campo, enumerados como en el
// documento ("4.4.1 Título", "1. Título", ...). Cada número abre un
// antecedente nuevo: la línea numerada es su título y lo que sigue (uno o
// varios párrafos) es su contenido. Se guardan con su número.

// Un nivel exige su signo ("1.", "2)", "3-") para no confundir un párrafo que
// empieza con una cifra; varios niveles ("4.4.1") pueden ir sin punto final.
const INICIO_ENUMERADO = /^\s*(?:\d{1,2}(?:\.\d{1,2})+\.?|\d{1,2}\s*[.)-])\s+/

export function empiezaEnumerado(texto: string): boolean {
  return INICIO_ENUMERADO.test(texto)
}

/** Texto del formulario → un antecedente por número (título + contenido). */
export function separarAntecedentes(texto: string): string[] {
  const lineas = texto.split('\n')
  if (!lineas.some(empiezaEnumerado)) {
    // Sin enumeración: todo el texto es un solo antecedente.
    return texto.trim() ? [texto.trim()] : []
  }
  const antecedentes: string[] = []
  for (const linea of lineas) {
    if (empiezaEnumerado(linea) || antecedentes.length === 0) antecedentes.push(linea.trim())
    else antecedentes[antecedentes.length - 1] += '\n' + linea
  }
  return antecedentes.map((a) => a.trim()).filter(Boolean)
}

/**
 * Antecedentes guardados → texto para el formulario. Los guardados antes de
 * conservar el número no lo tienen: se les pone uno para que al volver a
 * guardar no se junten.
 */
export function enumerarAntecedentes(antecedentes: string[]): string {
  return antecedentes.map((a, i) => (empiezaEnumerado(a) ? a : `${i + 1}. ${a}`)).join('\n\n')
}

/** Para mostrarlo: la línea numerada es el título; si no hay número, todo es contenido. */
export function partesAntecedente(texto: string): { titulo: string | null; contenido: string } {
  if (!empiezaEnumerado(texto)) return { titulo: null, contenido: texto.trim() }
  const salto = texto.indexOf('\n')
  if (salto < 0) return { titulo: texto.trim(), contenido: '' }
  return { titulo: texto.slice(0, salto).trim(), contenido: texto.slice(salto + 1).trim() }
}
