/**
 * Líneas de texto de un PDF, reconstruidas a partir de los fragmentos de texto que entrega pdf.js (cada uno con su
 * posición en la página). Es lo único que necesita el lector de campos: no depende de pdf.js, así se puede probar con
 * texto de cualquier origen.
 */

/** Un fragmento de texto tal como lo entrega pdf.js: `y` se mide desde ABAJO de la página (como en el PDF). */
export interface FragmentoTexto {
  texto: string
  x: number
  y: number
  ancho: number
  alto: number
}

export interface ItemLinea {
  x: number
  texto: string
}

export interface LineaPdf {
  /** 1 = primera página. */
  pagina: number
  /** Distancia desde la parte de ARRIBA de la página (crece hacia abajo). */
  y: number
  /** Alto aproximado de la letra: sirve para distinguir saltos de párrafo. */
  alto: number
  /** Fragmentos de la línea de izquierda a derecha (las columnas de una tabla quedan como fragmentos separados). */
  items: ItemLinea[]
  /** Todo el texto de la línea, con los fragmentos unidos por un espacio. */
  texto: string
}

const TOLERANCIA_Y = 2.5

/** Agrupa los fragmentos de una página en líneas, de arriba hacia abajo y de izquierda a derecha. */
export function agruparEnLineas(fragmentos: FragmentoTexto[], pagina: number, altoPagina: number): LineaPdf[] {
  const utiles = fragmentos.filter((f) => f.texto.trim() !== '')
  const ordenados = [...utiles].sort((a, b) => b.y - a.y || a.x - b.x)

  const grupos: FragmentoTexto[][] = []
  for (const f of ordenados) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && Math.abs(ultimo[0].y - f.y) <= TOLERANCIA_Y) ultimo.push(f)
    else grupos.push([f])
  }

  return grupos.map((g) => {
    const porX = [...g].sort((a, b) => a.x - b.x)
    // Fragmentos casi pegados (palabras partidas por el PDF) se unen en uno solo; los separados por un hueco, no.
    const items: ItemLinea[] = []
    let finAnterior = Number.NEGATIVE_INFINITY
    let altoMax = 0
    for (const f of porX) {
      altoMax = Math.max(altoMax, f.alto)
      const hueco = f.x - finAnterior
      const ultimoItem = items[items.length - 1]
      if (ultimoItem && hueco < Math.max(1.5, f.alto * 0.9)) {
        ultimoItem.texto += hueco > f.alto * 0.12 ? ` ${f.texto.trim()}` : f.texto.trim()
      } else {
        items.push({ x: f.x, texto: f.texto.trim() })
      }
      finAnterior = f.x + f.ancho
    }
    return {
      pagina,
      y: altoPagina - g[0].y,
      alto: altoMax,
      items,
      texto: items.map((i) => i.texto).join(' ').replace(/\s+/g, ' ').trim(),
    }
  })
}
