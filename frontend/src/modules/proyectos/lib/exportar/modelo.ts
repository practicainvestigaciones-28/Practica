/**
 * Modelo común de documento para reproducir el formato oficial INV-IC-FR-001.
 * El contenido se describe una sola vez (tablas con celdas combinadas, párrafos,
 * saltos de sección) y lo dibujan dos renderizadores: Word (docx) y PDF (jsPDF).
 */

export interface Run {
  t: string
  b?: boolean
  i?: boolean
  /** Color del texto en hex sin '#'. */
  color?: string
  /** Resaltado amarillo, como los campos por diligenciar del formato. */
  resaltar?: boolean
}

export type Texto = string | Run[]

export type Alineacion = 'left' | 'center' | 'right'

export interface Bordes {
  t?: boolean
  b?: boolean
  l?: boolean
  r?: boolean
}

export interface CeldaSpec {
  /** Ancho relativo (cualquier unidad; cada fila se normaliza al ancho de la tabla). */
  w: number
  texto?: Texto
  rowSpan?: number
  fondo?: string
  align?: Alineacion
  valign?: 'top' | 'middle' | 'bottom'
  /** Alto mínimo en puntos. */
  minH?: number
  /** false = sin ningún borde; objeto = solo los lados indicados. */
  bordes?: false | Bordes
  /** Tamaño de letra en puntos (por defecto 10). */
  size?: number
  negrita?: boolean
}

export interface TablaSpec {
  filas: CeldaSpec[][]
  /** Espacio vertical (pt) al terminar la tabla. */
  espacioDespues?: number
}

export interface ParrafoSpec {
  texto: Texto
  align?: Alineacion
  size?: number
  negrita?: boolean
  /** Espacio (pt) antes y después. */
  antes?: number
  despues?: number
}

export type Orientacion = 'vertical' | 'horizontal'

export type Bloque =
  | { tipo: 'tabla'; tabla: TablaSpec }
  | { tipo: 'parrafo'; parrafo: ParrafoSpec }
  | { tipo: 'espacio'; pt: number }
  | { tipo: 'saltoPagina' }

export interface SeccionDoc {
  orientacion: Orientacion
  bloques: Bloque[]
}

export interface DocumentoFormato {
  secciones: SeccionDoc[]
}

// ---------- Resolución de la cuadrícula ----------

export interface CeldaResuelta {
  spec: CeldaSpec
  fila: number
  col: number
  colSpan: number
  rowSpan: number
}

export interface TablaResuelta {
  /** Ancho relativo de cada columna de la cuadrícula unificada. */
  anchos: number[]
  /** Solo las celdas que empiezan en cada fila (las tapadas por un rowSpan no aparecen). */
  filas: CeldaResuelta[][]
}

const EPS = 0.001

export function normalizarRuns(texto: Texto | undefined): Run[] {
  if (texto === undefined) return []
  return typeof texto === 'string' ? [{ t: texto }] : texto
}

/**
 * Convierte filas de celdas con anchos relativos en una cuadrícula regular con
 * colSpan/rowSpan. Cada fila se escala para ocupar el ancho que le deja libre
 * lo que ya ocupan las celdas con rowSpan de filas anteriores, así basta con
 * describir cada fila con sus propios anchos (como en el formato oficial, donde
 * cada bloque tiene columnas distintas).
 */
export function resolverTabla(tabla: TablaSpec): TablaResuelta {
  const total = tabla.filas[0].reduce((s, c) => s + c.w, 0)
  interface Ocupado { x0: number; x1: number; hastaFila: number }
  const ocupados: Ocupado[] = []
  const posiciones: { spec: CeldaSpec; fila: number; x0: number; x1: number }[] = []

  tabla.filas.forEach((fila, r) => {
    const activos = ocupados.filter((o) => o.hastaFila >= r).sort((a, b) => a.x0 - b.x0)
    const libre = total - activos.reduce((s, o) => s + (o.x1 - o.x0), 0)
    const suma = fila.reduce((s, c) => s + c.w, 0)
    const escala = suma > 0 ? libre / suma : 1

    let cursor = 0
    for (const spec of fila) {
      let movido = true
      while (movido) {
        movido = false
        for (const o of activos) {
          if (cursor >= o.x0 - EPS && cursor < o.x1 - EPS) {
            cursor = o.x1
            movido = true
          }
        }
      }
      const ancho = spec.w * escala
      const x0 = cursor
      const x1 = cursor + ancho
      posiciones.push({ spec, fila: r, x0, x1 })
      if ((spec.rowSpan ?? 1) > 1) {
        ocupados.push({ x0, x1, hastaFila: r + (spec.rowSpan ?? 1) - 1 })
      }
      cursor = x1
    }
  })

  const cortes: number[] = [0, total]
  for (const p of posiciones) cortes.push(p.x0, p.x1)
  cortes.sort((a, b) => a - b)
  const unicos: number[] = []
  for (const c of cortes) {
    if (unicos.length === 0 || c - unicos[unicos.length - 1] > EPS * 10) unicos.push(c)
  }
  const indiceDe = (x: number) => {
    let mejor = 0
    let dist = Infinity
    unicos.forEach((u, i) => {
      const d = Math.abs(u - x)
      if (d < dist) {
        dist = d
        mejor = i
      }
    })
    return mejor
  }

  const filas: CeldaResuelta[][] = tabla.filas.map(() => [])
  for (const p of posiciones) {
    const col = indiceDe(p.x0)
    const fin = indiceDe(p.x1)
    filas[p.fila].push({
      spec: p.spec,
      fila: p.fila,
      col,
      colSpan: Math.max(1, fin - col),
      rowSpan: p.spec.rowSpan ?? 1,
    })
  }
  const anchos = unicos.slice(1).map((u, i) => u - unicos[i])
  return { anchos, filas }
}
