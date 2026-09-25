import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import type { ISectionOptions } from 'docx'
import {
  CODIGO_FORMATO,
  FECHA_FORMATO,
  TITULO_FORMATO,
  VERSION_FORMATO,
} from './contenido'
import { normalizarRuns, resolverTabla } from './modelo'
import type { Alineacion, Bloque, DocumentoFormato, Orientacion, ParrafoSpec, Run, TablaSpec, Texto } from './modelo'

const FUENTE = 'Arial'
const TAM_BASE = 10
const DXA_POR_PT = 20

// Carta (Letter): 8.5" x 11" = 12240 x 15840 twips.
const CARTA = { ancho: 12240, alto: 15840 }
const MARGENES: Record<Orientacion, { izq: number; der: number; sup: number; inf: number; contenido: number }> = {
  vertical: { izq: 1368, der: 1368, sup: 2000, inf: 1000, contenido: CARTA.ancho - 2 * 1368 },
  horizontal: { izq: 900, der: 900, sup: 2000, inf: 900, contenido: CARTA.alto - 2 * 900 },
}

const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const BORDE = { style: BorderStyle.SINGLE, size: 4, color: '444444' }

function alineacion(a: Alineacion | undefined) {
  if (a === 'center') return AlignmentType.CENTER
  if (a === 'right') return AlignmentType.RIGHT
  return AlignmentType.LEFT
}

/** Convierte runs (con saltos de línea '\n') en TextRun de docx. */
function textRuns(texto: Texto | undefined, tam: number, negritaPorDefecto: boolean): TextRun[] {
  const runs: Run[] = normalizarRuns(texto)
  const explicito = Array.isArray(texto)
  const salida: TextRun[] = []
  for (const run of runs) {
    const partes = run.t.split('\n')
    partes.forEach((parte, i) => {
      salida.push(
        new TextRun({
          text: parte,
          font: FUENTE,
          size: Math.round(tam * 2),
          bold: run.b ?? (explicito ? false : negritaPorDefecto),
          italics: run.i,
          color: run.color,
          highlight: run.resaltar ? 'yellow' : undefined,
          break: i > 0 ? 1 : undefined,
        })
      )
    })
  }
  return salida
}

function parrafoDeTexto(texto: Texto | undefined, tam: number, negrita: boolean, align: Alineacion | undefined): Paragraph {
  return new Paragraph({ alignment: alineacion(align), children: textRuns(texto, tam, negrita) })
}

function tablaDocx(spec: TablaSpec, anchoContenido: number): Table {
  const res = resolverTabla(spec)
  const sumaAnchos = res.anchos.reduce((s, a) => s + a, 0)
  const columnas = res.anchos.map((a) => Math.max(1, Math.round((a / sumaAnchos) * anchoContenido)))
  // Ajuste de redondeo para que la suma sea exactamente el ancho disponible.
  columnas[columnas.length - 1] += anchoContenido - columnas.reduce((s, a) => s + a, 0)

  const filas = res.filas.map((celdas) => {
    const alto = Math.max(0, ...celdas.filter((c) => c.rowSpan === 1).map((c) => c.spec.minH ?? 0))
    return new TableRow({
      height: alto > 0 ? { value: Math.round(alto * DXA_POR_PT), rule: HeightRule.ATLEAST } : undefined,
      children: celdas.map((c) => {
        const { spec } = c
        const ancho = columnas.slice(c.col, c.col + c.colSpan).reduce((s, a) => s + a, 0)
        const bordes = spec.bordes
        const lado = (clave: 't' | 'b' | 'l' | 'r') =>
          bordes === false ? SIN_BORDE : bordes && !bordes[clave] ? SIN_BORDE : BORDE
        const tam = spec.size ?? TAM_BASE
        return new TableCell({
          width: { size: ancho, type: WidthType.DXA },
          columnSpan: c.colSpan > 1 ? c.colSpan : undefined,
          rowSpan: c.rowSpan > 1 ? c.rowSpan : undefined,
          shading: spec.fondo ? { type: ShadingType.CLEAR, fill: spec.fondo, color: 'auto' } : undefined,
          verticalAlign:
            spec.valign === 'middle' ? VerticalAlign.CENTER : spec.valign === 'bottom' ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
          margins: { top: 40, bottom: 40, left: 90, right: 90 },
          borders: { top: lado('t'), bottom: lado('b'), left: lado('l'), right: lado('r') },
          children: [parrafoDeTexto(spec.texto, tam, spec.negrita ?? false, spec.align)],
        })
      }),
    })
  })

  return new Table({
    width: { size: anchoContenido, type: WidthType.DXA },
    columnWidths: columnas,
    layout: TableLayoutType.FIXED,
    rows: filas,
  })
}

function espaciador(pt: number): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: Math.max(20, Math.round(pt * DXA_POR_PT)), lineRule: 'exact' },
    children: [new TextRun({ text: '', size: 2 })],
  })
}

function parrafoBloque(p: ParrafoSpec): Paragraph {
  return new Paragraph({
    alignment: alineacion(p.align),
    spacing: { before: Math.round((p.antes ?? 0) * DXA_POR_PT), after: Math.round((p.despues ?? 0) * DXA_POR_PT) },
    children: textRuns(p.texto, p.size ?? 11, p.negrita ?? false),
  })
}

function bloquesADocx(bloques: Bloque[], anchoContenido: number): (Paragraph | Table)[] {
  const salida: (Paragraph | Table)[] = []
  for (const b of bloques) {
    if (b.tipo === 'tabla') {
      salida.push(tablaDocx(b.tabla, anchoContenido))
      // Un párrafo entre tablas evita que Word las fusione en una sola.
      salida.push(espaciador(Math.max(b.tabla.espacioDespues ?? 0, 4)))
    } else if (b.tipo === 'parrafo') {
      salida.push(parrafoBloque(b.parrafo))
    } else if (b.tipo === 'espacio') {
      salida.push(espaciador(b.pt))
    } else {
      salida.push(new Paragraph({ children: [new PageBreak()] }))
    }
  }
  return salida
}

function encabezado(logo: ArrayBuffer, anchoContenido: number): Header {
  const c1 = Math.round(anchoContenido * 0.305)
  const c3 = Math.round(anchoContenido * 0.265)
  const c2 = anchoContenido - c1 - c3
  const celdaCodigo = (etiqueta: string, valor: string) =>
    new TableCell({
      width: { size: c3, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 30, bottom: 30, left: 90, right: 90 },
      borders: { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `${etiqueta} `, bold: true, font: FUENTE, size: 17 }),
            new TextRun({ text: valor, font: FUENTE, size: 17 }),
          ],
        }),
      ],
    })
  const alto = 340
  const tabla = new Table({
    width: { size: anchoContenido, type: WidthType.DXA },
    columnWidths: [c1, c2, c3],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        height: { value: alto, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            width: { size: c1, type: WidthType.DXA },
            rowSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 118, height: 40 } })],
              }),
            ],
          }),
          new TableCell({
            width: { size: c2, type: WidthType.DXA },
            rowSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: TITULO_FORMATO, bold: true, font: FUENTE, size: 20 })],
              }),
            ],
          }),
          celdaCodigo('CÓDIGO:', CODIGO_FORMATO),
        ],
      }),
      new TableRow({ height: { value: alto, rule: HeightRule.ATLEAST }, children: [celdaCodigo('VERSIÓN:', VERSION_FORMATO)] }),
      new TableRow({ height: { value: alto, rule: HeightRule.ATLEAST }, children: [celdaCodigo('FECHA:', FECHA_FORMATO)] }),
    ],
  })
  return new Header({ children: [tabla, espaciador(6)] })
}

export async function generarDocx(documento: DocumentoFormato, logo: ArrayBuffer): Promise<Blob> {
  const secciones: ISectionOptions[] = documento.secciones.map((s) => {
    const m = MARGENES[s.orientacion]
    return {
      properties: {
        page: {
          size: {
            width: CARTA.ancho,
            height: CARTA.alto,
            orientation: s.orientacion === 'horizontal' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
          },
          margin: { left: m.izq, right: m.der, top: m.sup, bottom: m.inf, header: 500 },
        },
      },
      headers: { default: encabezado(logo, m.contenido) },
      children: bloquesADocx(s.bloques, m.contenido),
    }
  })
  return Packer.toBlob(new Document({ styles: { default: { document: { run: { font: FUENTE, size: TAM_BASE * 2 } } } }, sections: secciones }))
}
