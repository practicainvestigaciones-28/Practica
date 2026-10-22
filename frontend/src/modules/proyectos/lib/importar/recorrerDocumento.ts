/**
 * Primitivas de bajo nivel para leer el XML de un .docx (word/document.xml,
 * ya parseado con DOMParser) como una lista de tablas de texto, y buscar
 * campos dentro de ellas por su etiqueta. No sabe nada del formato
 * INV-IC-FR-001 en particular — eso vive en extraerCampos.ts.
 */

function textoDeCelda(celda: Element): string {
  const parrafos: string[] = []
  const nodosParrafo = celda.getElementsByTagName('w:p')
  for (let i = 0; i < nodosParrafo.length; i++) {
    const p = nodosParrafo[i]
    if (p.parentElement !== celda) continue // ignora párrafos de una tabla anidada
    let texto = ''
    const recorrer = (nodo: ChildNode) => {
      if (nodo.nodeType !== 1) return
      const el = nodo as Element
      if (el.tagName === 'w:t') {
        texto += el.textContent ?? ''
      } else if (el.tagName === 'w:br' || el.tagName === 'w:cr') {
        texto += '\n'
      } else if (el.tagName === 'w:tab') {
        texto += '\t'
      } else {
        el.childNodes.forEach(recorrer)
      }
    }
    p.childNodes.forEach(recorrer)
    parrafos.push(texto)
  }
  return parrafos.join('\n').trim()
}

/** tabla -> fila -> texto de cada celda, en el orden en que aparecen en el documento. */
export function extraerTablas(doc: Document): string[][][] {
  const tablasEl = doc.getElementsByTagName('w:tbl')
  const tablas: string[][][] = []
  for (let t = 0; t < tablasEl.length; t++) {
    const tablaEl = tablasEl[t]
    const filasEl = tablaEl.getElementsByTagName('w:tr')
    const filas: string[][] = []
    for (let r = 0; r < filasEl.length; r++) {
      const filaEl = filasEl[r]
      if (filaEl.parentElement !== tablaEl) continue
      const celdasEl = filaEl.getElementsByTagName('w:tc')
      const celdas: string[] = []
      for (let c = 0; c < celdasEl.length; c++) {
        const celdaEl = celdasEl[c]
        if (celdaEl.parentElement !== filaEl) continue
        celdas.push(textoDeCelda(celdaEl))
      }
      filas.push(celdas)
    }
    tablas.push(filas)
  }
  return tablas
}

interface CeldaEncontrada {
  tabla: number
  fila: number
  indiceCelda: number
  celdas: string[]
}

/** Primera celda cuyo texto (trim) empieza exactamente por `etiqueta`. */
export function buscarCeldaConEtiqueta(tablas: string[][][], etiqueta: string): CeldaEncontrada | null {
  for (let t = 0; t < tablas.length; t++) {
    for (let f = 0; f < tablas[t].length; f++) {
      const fila = tablas[t][f]
      const i = fila.findIndex((c) => c.trim().startsWith(etiqueta))
      if (i !== -1) return { tabla: t, fila: f, indiceCelda: i, celdas: fila }
    }
  }
  return null
}

/** Todas las celdas cuyo texto empieza por `etiqueta` (para campos que se repiten, como varios coinvestigadores). */
export function buscarTodasLasCeldasConEtiqueta(tablas: string[][][], etiqueta: string): CeldaEncontrada[] {
  const resultado: CeldaEncontrada[] = []
  for (let t = 0; t < tablas.length; t++) {
    for (let f = 0; f < tablas[t].length; f++) {
      const fila = tablas[t][f]
      const i = fila.findIndex((c) => c.trim().startsWith(etiqueta))
      if (i !== -1) resultado.push({ tabla: t, fila: f, indiceCelda: i, celdas: fila })
    }
  }
  return resultado
}

/** Valor de la celda que sigue, en la misma fila, a la celda con esa etiqueta exacta. */
export function valorTrasEtiqueta(tablas: string[][][], etiqueta: string): string {
  const encontrada = buscarCeldaConEtiqueta(tablas, etiqueta)
  if (!encontrada || encontrada.indiceCelda + 1 >= encontrada.celdas.length) return ''
  return encontrada.celdas[encontrada.indiceCelda + 1].trim()
}

/**
 * Para campos donde la etiqueta encabeza una columna y el valor viene en la
 * misma posición de columna, en la fila de abajo (p. ej. "Correo
 * electrónico" en el Anexo 1, o "Código GrupLac:" en la información del
 * grupo). Busca una celda que sea EXACTAMENTE igual a la etiqueta, y toma la
 * celda en ese mismo índice de columna de la fila siguiente.
 */
export function valorEnFilaSiguiente(tablas: string[][][], etiqueta: string): string {
  for (const tabla of tablas) {
    for (let f = 0; f < tabla.length; f++) {
      const i = tabla[f].findIndex((c) => c.trim() === etiqueta)
      if (i === -1) continue
      const filaValor = tabla[f + 1]
      if (!filaValor) return ''
      return (filaValor[i] ?? '').trim()
    }
  }
  return ''
}

/** Para etiquetas tipo "Título: valor", donde la etiqueta y el valor están en la misma celda. */
export function valorEnMismaCelda(tablas: string[][][], etiqueta: string): string {
  const encontrada = buscarCeldaConEtiqueta(tablas, etiqueta)
  if (!encontrada) return ''
  const texto = encontrada.celdas[encontrada.indiceCelda].trim()
  return texto.slice(etiqueta.length).replace(/^:/, '').trim()
}

/**
 * Como valorEnMismaCelda, pero si la celda de la etiqueta no trae nada más
 * que la etiqueta (el valor quedó en la celda vecina, en vez de pegado),
 * cae a buscar el valor ahí. Cubre las dos formas en que puede venir
 * diligenciado un campo tipo "Título:".
 */
export function valorEnMismaCeldaOTrasEtiqueta(tablas: string[][][], etiqueta: string): string {
  const enLaMisma = valorEnMismaCelda(tablas, etiqueta)
  if (enLaMisma) return enLaMisma
  return valorTrasEtiqueta(tablas, etiqueta)
}

/** Índice de la tabla que tiene una celda cuyo texto empieza por `etiqueta` (para localizar secciones), o -1. */
export function indiceTablaConEtiqueta(tablas: string[][][], etiqueta: string): number {
  const encontrada = buscarCeldaConEtiqueta(tablas, etiqueta)
  return encontrada ? encontrada.tabla : -1
}

/**
 * Contenido de una "caja" de descripción (4.1 Planteamiento, 4.5 Marco
 * teórico, etc.): la celda empieza con el título y las instrucciones del
 * formato en una sola línea, y lo que haya después del primer salto de línea
 * es lo que escribió el investigador. Si no hay salto de línea, se asume que
 * no se diligenció nada.
 */
export function contenidoDeCaja(tablas: string[][][], titulo: string): string {
  const encontrada = buscarCeldaConEtiqueta(tablas, titulo)
  if (!encontrada) return ''
  const texto = encontrada.celdas[encontrada.indiceCelda]
  const salto = texto.indexOf('\n')
  if (salto === -1) return ''
  return texto.slice(salto + 1).trim()
}

/**
 * Divide un "Nombre Apellido" combinado en nombres/apellidos. El formato
 * oficial, para coinvestigadores externos, egresados y estudiantes, solo
 * tiene una celda de nombre completo (a diferencia del investigador
 * principal y el coinvestigador UNICESMAG, que sí tienen Nombres/Apellidos
 * separados en el Anexo 1). Es una aproximación: toma la última palabra como
 * apellido y el resto como nombres — no distingue apellidos compuestos.
 */
export function dividirNombreCompleto(nombreCompleto: string): { nombres: string; apellidos: string } {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return { nombres: '', apellidos: '' }
  if (partes.length === 1) return { nombres: partes[0], apellidos: '' }
  return { nombres: partes.slice(0, -1).join(' '), apellidos: partes[partes.length - 1] }
}
