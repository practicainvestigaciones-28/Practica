import jsPDF from 'jspdf'
import { CODIGO_FORMATO, FECHA_FORMATO, TITULO_FORMATO, VERSION_FORMATO } from './contenido'
import { normalizarRuns, resolverTabla } from './modelo'
import type { Alineacion, Bloque, CeldaResuelta, DocumentoFormato, Orientacion, ParrafoSpec, TablaSpec, Texto } from './modelo'

const TAM_BASE = 10
const PAD_X = 4
const PAD_Y = 2.5
const ALTO_MIN_FILA = 13
const INTERLINEADO = 1.2
const COLOR_BORDE = '#444444'

const MARGEN_X: Record<Orientacion, number> = { vertical: 68.4, horizontal: 43.2 }
const TOPE_ENCABEZADO = 28
const ALTO_ENCABEZADO = 51
const INICIO_CONTENIDO = TOPE_ENCABEZADO + ALTO_ENCABEZADO + 14
const MARGEN_INFERIOR = 42

// ---------- texto ----------

interface Palabra {
  t: string
  estilo: 'normal' | 'bold' | 'italic' | 'bolditalic'
  color?: string
  resaltar?: boolean
  w: number
}

interface Linea {
  palabras: Palabra[]
  ancho: number
}

/**
 * Ancho de un texto tal como lo dibuja el visor. `getTextWidth` de jsPDF queda ~5 % corto en pares como "Te" o "Tr"
 * (sin el ajuste de kerning), lo que hace que las palabras se peguen unas con otras al dibujarlas por separado.
 */
function anchoTexto(doc: jsPDF, t: string): number {
  return doc.getStringUnitWidth(t, { kerning: true }) * doc.getFontSize()
}

function estiloDe(b?: boolean, i?: boolean): Palabra['estilo'] {
  if (b && i) return 'bolditalic'
  if (b) return 'bold'
  if (i) return 'italic'
  return 'normal'
}

/** Parte el texto en líneas que caben en `anchoMax`, conservando los cambios de estilo dentro de la línea. */
function envolver(doc: jsPDF, texto: Texto | undefined, anchoMax: number, tam: number, negritaCelda: boolean): Linea[] {
  const runs = normalizarRuns(texto)
  const explicito = Array.isArray(texto)
  doc.setFontSize(tam)
  const lineas: Linea[] = []
  let actual: Linea = { palabras: [], ancho: 0 }

  const cerrar = () => {
    while (actual.palabras.length > 0 && /^\s+$/.test(actual.palabras[actual.palabras.length - 1].t)) {
      const ultima = actual.palabras.pop()!
      actual.ancho -= ultima.w
    }
    lineas.push(actual)
    actual = { palabras: [], ancho: 0 }
  }

  for (const run of runs) {
    const estilo = estiloDe(run.b ?? (explicito ? false : negritaCelda), run.i)
    doc.setFont('helvetica', estilo)
    run.t.split('\n').forEach((parte, idx) => {
      if (idx > 0) cerrar()
      const tokens = parte.match(/\s+|\S+/g) ?? []
      for (const tk of tokens) {
        const esEspacio = /^\s/.test(tk)
        if (esEspacio && actual.palabras.length === 0) continue
        const w = anchoTexto(doc, tk)
        if (!esEspacio && actual.ancho + w > anchoMax + 0.01 && actual.palabras.length > 0) cerrar()
        if (!esEspacio && w > anchoMax) {
          // Palabra más larga que la línea (URL, cadena sin espacios): se corta por caracteres.
          let resto = tk
          while (resto.length > 0) {
            let n = resto.length
            while (n > 1 && anchoTexto(doc, resto.slice(0, n)) > anchoMax - actual.ancho) n--
            const trozo = resto.slice(0, n)
            const wt = anchoTexto(doc, trozo)
            actual.palabras.push({ t: trozo, estilo, color: run.color, resaltar: run.resaltar, w: wt })
            actual.ancho += wt
            resto = resto.slice(n)
            if (resto.length > 0) cerrar()
          }
          continue
        }
        actual.palabras.push({ t: tk, estilo, color: run.color, resaltar: run.resaltar, w })
        actual.ancho += w
      }
    })
  }
  cerrar()
  return lineas
}

function dibujarLinea(doc: jsPDF, linea: Linea, x: number, yBase: number, ancho: number, align: Alineacion | undefined, tam: number) {
  let cx = x + (align === 'center' ? (ancho - linea.ancho) / 2 : align === 'right' ? ancho - linea.ancho : 0)
  doc.setFontSize(tam)
  for (const p of linea.palabras) {
    doc.setFont('helvetica', p.estilo)
    if (p.resaltar) {
      doc.setFillColor(255, 255, 0)
      doc.rect(cx, yBase - tam * 0.85, p.w, tam * 1.05, 'F')
    }
    const c = p.color ?? '000000'
    doc.setTextColor(`#${c}`)
    doc.text(p.t, cx, yBase)
    cx += p.w
  }
  doc.setTextColor('#000000')
}

// ---------- tablas ----------

interface CeldaPdf {
  c: CeldaResuelta
  x: number
  w: number
  tam: number
  lineH: number
  lineas: Linea[]
  consumidas: number
  finFila: number
}

function hexARgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

class Escritor {
  doc: jsPDF
  logo: string
  orientacion: Orientacion = 'vertical'
  y = INICIO_CONTENIDO
  private primera = true

  constructor(doc: jsPDF, logo: string) {
    this.doc = doc
    this.logo = logo
  }

  get anchoPagina() {
    return this.doc.internal.pageSize.getWidth()
  }
  get altoPagina() {
    return this.doc.internal.pageSize.getHeight()
  }
  get margenX() {
    return MARGEN_X[this.orientacion]
  }
  get anchoContenido() {
    return this.anchoPagina - 2 * this.margenX
  }
  get limiteY() {
    return this.altoPagina - MARGEN_INFERIOR
  }

  iniciarSeccion(orientacion: Orientacion) {
    this.orientacion = orientacion
    if (this.primera) {
      this.primera = false
    } else {
      this.doc.addPage('letter', orientacion === 'horizontal' ? 'landscape' : 'portrait')
    }
    this.dibujarEncabezado()
    this.y = INICIO_CONTENIDO
  }

  nuevaPagina() {
    this.doc.addPage('letter', this.orientacion === 'horizontal' ? 'landscape' : 'portrait')
    this.dibujarEncabezado()
    this.y = INICIO_CONTENIDO
  }

  private linea(x1: number, y1: number, x2: number, y2: number) {
    this.doc.line(x1, y1, x2, y2)
  }

  private dibujarEncabezado() {
    const { doc } = this
    const x0 = this.margenX
    const w = this.anchoContenido
    const y0 = TOPE_ENCABEZADO
    const h = ALTO_ENCABEZADO
    const w1 = w * 0.305
    const w3 = w * 0.265
    const w2 = w - w1 - w3

    doc.setDrawColor(COLOR_BORDE)
    doc.setLineWidth(0.5)
    doc.rect(x0, y0, w, h)
    this.linea(x0 + w1, y0, x0 + w1, y0 + h)
    this.linea(x0 + w1 + w2, y0, x0 + w1 + w2, y0 + h)
    this.linea(x0 + w1 + w2, y0 + h / 3, x0 + w, y0 + h / 3)
    this.linea(x0 + w1 + w2, y0 + (2 * h) / 3, x0 + w, y0 + (2 * h) / 3)

    const altoLogo = h - 12
    const anchoLogo = Math.min(w1 - 14, (altoLogo * 576) / 198)
    const altoReal = (anchoLogo * 198) / 576
    doc.addImage(this.logo, 'PNG', x0 + (w1 - anchoLogo) / 2, y0 + (h - altoReal) / 2, anchoLogo, altoReal, 'logo')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor('#000000')
    const titulo: string[] = doc.splitTextToSize(TITULO_FORMATO, w2 - 24)
    const hTitulo = titulo.length * 10 * 1.15
    titulo.forEach((t, i) => {
      doc.text(t, x0 + w1 + w2 / 2, y0 + (h - hTitulo) / 2 + 9 + i * 11.5, { align: 'center' })
    })

    const filas: [string, string][] = [
      ['CÓDIGO:', CODIGO_FORMATO],
      ['VERSIÓN:', VERSION_FORMATO],
      ['FECHA:', FECHA_FORMATO],
    ]
    doc.setFontSize(8.5)
    filas.forEach(([etiqueta, valor], i) => {
      const yb = y0 + (h / 3) * i + h / 6 + 3
      doc.setFont('helvetica', 'bold')
      doc.text(etiqueta, x0 + w1 + w2 + 6, yb)
      const we = anchoTexto(doc, `${etiqueta} `)
      doc.setFont('helvetica', 'normal')
      doc.text(valor, x0 + w1 + w2 + 6 + we, yb)
    })
  }

  parrafo(p: ParrafoSpec) {
    const tam = p.size ?? 11
    const lineH = tam * INTERLINEADO
    this.y += p.antes ?? 0
    const lineas = envolver(this.doc, p.texto, this.anchoContenido, tam, p.negrita ?? false)
    for (const l of lineas) {
      if (this.y + lineH > this.limiteY) this.nuevaPagina()
      dibujarLinea(this.doc, l, this.margenX, this.y + tam * 0.93, this.anchoContenido, p.align, tam)
      this.y += lineH
    }
    this.y += p.despues ?? 0
  }

  tabla(spec: TablaSpec) {
    const { doc } = this
    const res = resolverTabla(spec)
    const suma = res.anchos.reduce((s, a) => s + a, 0)
    const anchosPt = res.anchos.map((a) => (a / suma) * this.anchoContenido)
    const xCol: number[] = [0]
    anchosPt.forEach((a, i) => xCol.push(xCol[i] + a))
    const nFilas = res.filas.length

    const celdas: CeldaPdf[] = []
    for (const fila of res.filas) {
      for (const c of fila) {
        const tam = c.spec.size ?? TAM_BASE
        const w = xCol[c.col + c.colSpan] - xCol[c.col]
        celdas.push({
          c,
          x: xCol[c.col],
          w,
          tam,
          lineH: tam * INTERLINEADO,
          lineas: envolver(doc, c.spec.texto, w - 2 * PAD_X, tam, c.spec.negrita ?? false),
          consumidas: 0,
          finFila: c.fila + c.rowSpan - 1,
        })
      }
    }

    // Alturas de fila: primero las celdas de una sola fila; luego las combinadas ensanchan la última fila que cubren.
    const alto: number[] = new Array(nFilas).fill(ALTO_MIN_FILA)
    const necesario = (c: CeldaPdf) => Math.max(c.lineas.length * c.lineH + 2 * PAD_Y, c.c.spec.minH ?? 0)
    for (const c of celdas) {
      if (c.c.rowSpan === 1) alto[c.c.fila] = Math.max(alto[c.c.fila], necesario(c))
    }
    for (const c of celdas) {
      if (c.c.rowSpan > 1) {
        const cubierto = alto.slice(c.c.fila, c.finFila + 1).reduce((s, a) => s + a, 0)
        const falta = necesario(c) - cubierto
        if (falta > 0) alto[c.finFila] += falta
      }
    }

    // Unidades: conjuntos de filas enlazadas por celdas combinadas (no conviene partirlas entre páginas).
    const finUnidad: number[] = new Array(nFilas).fill(0)
    const inicioUnidad: number[] = new Array(nFilas).fill(0)
    for (let r = 0; r < nFilas; ) {
      let fin = r
      for (let j = r; j <= fin; j++) {
        for (const c of celdas) if (c.c.fila === j) fin = Math.max(fin, c.finFila)
      }
      for (let j = r; j <= fin; j++) {
        inicioUnidad[j] = r
        finUnidad[j] = fin
      }
      r = fin + 1
    }

    const capacidad = this.limiteY - INICIO_CONTENIDO
    const yFila: number[] = new Array(nFilas).fill(0)
    let altoActual = alto.slice()

    const dibujarSegmento = (ini: number, fin: number, parcial: boolean, altoParcial: number) => {
      let yy = this.y
      for (let i = ini; i <= fin; i++) {
        yFila[i] = yy
        yy += parcial ? altoParcial : altoActual[i]
      }
      for (const c of celdas) {
        if (c.c.fila > fin || c.finFila < ini) continue
        const vt = Math.max(c.c.fila, ini)
        const vb = Math.min(c.finFila, fin)
        const top = yFila[vt]
        const bottom = yFila[vb] + (parcial ? altoParcial : altoActual[vb])
        const h = bottom - top
        const x = this.margenX + c.x
        const ultimo = c.finFila <= fin && !(parcial && c.finFila === fin)
        const restantes = c.lineas.length - c.consumidas
        const cabe = Math.max(0, Math.floor((h - 2 * PAD_Y) / c.lineH))
        const tomar = ultimo ? restantes : Math.max(0, Math.min(restantes, cabe))

        const { spec } = c.c
        if (spec.fondo) {
          const [r, g, b] = hexARgb(spec.fondo)
          doc.setFillColor(r, g, b)
          doc.rect(x, top, c.w, h, 'F')
        }
        if (tomar > 0) {
          const completa = c.consumidas === 0 && ultimo
          const hTexto = tomar * c.lineH
          let yTexto = top + PAD_Y
          if (completa && spec.valign === 'middle') yTexto = top + (h - hTexto) / 2
          if (completa && spec.valign === 'bottom') yTexto = bottom - PAD_Y - hTexto
          for (let k = 0; k < tomar; k++) {
            dibujarLinea(
              doc,
              c.lineas[c.consumidas + k],
              x + PAD_X,
              yTexto + k * c.lineH + c.tam * 0.93,
              c.w - 2 * PAD_X,
              spec.align,
              c.tam
            )
          }
        }
        c.consumidas += tomar

        const bordes = spec.bordes
        const lado = (k: 't' | 'b' | 'l' | 'r') => (bordes === false ? false : bordes ? !!bordes[k] : true)
        doc.setDrawColor(COLOR_BORDE)
        doc.setLineWidth(0.5)
        if (lado('t')) doc.line(x, top, x + c.w, top)
        if (lado('b')) doc.line(x, bottom, x + c.w, bottom)
        if (lado('l')) doc.line(x, top, x, bottom)
        if (lado('r')) doc.line(x + c.w, top, x + c.w, bottom)
      }
      this.y = yy
    }

    /** Altura que le falta a una fila que ya se dibujó en parte. */
    const altoRestante = (r: number) => {
      let h = ALTO_MIN_FILA
      for (const c of celdas) {
        if (c.finFila === r) {
          const usado = c.consumidas > 0
          h = Math.max(h, (c.lineas.length - c.consumidas) * c.lineH + 2 * PAD_Y, usado ? 0 : c.c.spec.minH ?? 0)
        }
      }
      return h
    }

    // Las tablas cortas (bloques de grupo, egresados, firmas...) no se parten entre páginas.
    const alturaTotal = alto.reduce((s, a) => s + a, 0)
    if (alturaTotal <= 300 && this.y + alturaTotal > this.limiteY && this.y > INICIO_CONTENIDO + 0.5) this.nuevaPagina()

    // Solo se mantienen juntas las unidades pequeñas; las grandes (p. ej. resultados esperados) se cortan entre filas.
    const unidadMax = Math.min(capacidad, 170)
    const sumaAltos = (ini: number, fin: number) => altoActual.slice(ini, fin + 1).reduce((s, a) => s + a, 0)
    const finBloque = (ini: number) =>
      inicioUnidad[ini] === ini && sumaAltos(ini, finUnidad[ini]) <= unidadMax ? finUnidad[ini] : ini

    let r = 0
    while (r < nFilas) {
      const disponible = this.limiteY - this.y

      // Se dibujan de una vez todas las filas que caben en esta página, para que las celdas combinadas
      // repartan su texto sobre el alto real que ocupan y no fila por fila.
      let k = r - 1
      let acumulado = 0
      while (k + 1 < nFilas) {
        const fin = finBloque(k + 1)
        const h = sumaAltos(k + 1, fin)
        if (acumulado + h > disponible + 0.01) break
        acumulado += h
        k = fin
      }
      if (k >= r) {
        dibujarSegmento(r, k, false, 0)
        r = k + 1
        if (r < nFilas) this.nuevaPagina()
        continue
      }

      // Ni la primera fila (o unidad) cabe en lo que queda de página.
      const fin = finBloque(r)
      const enTope = this.y <= INICIO_CONTENIDO + 0.5
      if (!enTope && (fin > r || altoActual[r] <= 90)) {
        this.nuevaPagina()
        continue
      }
      // Fila alta: se parte por líneas entre esta página y la siguiente.
      if (disponible >= 2 * (TAM_BASE * INTERLINEADO) + 2 * PAD_Y + 6) {
        dibujarSegmento(r, r, true, disponible)
        altoActual[r] = altoRestante(r)
        if (!celdas.some((c) => c.finFila === r && c.consumidas < c.lineas.length)) r++
      }
      if (r < nFilas) this.nuevaPagina()
    }
    this.y += spec.espacioDespues ?? 0
  }

  bloques(bloques: Bloque[]) {
    for (const b of bloques) {
      if (b.tipo === 'tabla') this.tabla(b.tabla)
      else if (b.tipo === 'parrafo') this.parrafo(b.parrafo)
      else if (b.tipo === 'espacio') this.y += b.pt
      else this.nuevaPagina()
    }
  }
}

export function generarPdf(documento: DocumentoFormato, logoDataUrl: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' })
  const escritor = new Escritor(doc, logoDataUrl)
  for (const seccion of documento.secciones) {
    escritor.iniciarSeccion(seccion.orientacion)
    escritor.bloques(seccion.bloques)
  }
  return doc
}
