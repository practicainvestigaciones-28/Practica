/**
 * Lee las líneas de un PDF del formato INV-IC-FR-001 (Presentación de proyectos de investigación) y arma la misma
 * `ExtraccionProyectoDocx` que ya produce la lectura de Word, para reusar el resto de la carga. Se guía por los
 * encabezados numerados ("3. RESUMEN", "4.1 PLANTEAMIENTO…") y por la posición de cada texto en la página. Lo que no
 * reconoce queda vacío y se reporta en `noLeidos`: la pantalla de revisión permite completarlo a mano.
 */
import type {
  ActividadCronogramaTexto,
  EstudianteTexto,
  ExtraccionProyectoDocx,
  GrupoTexto,
  ImpactoTexto,
  ParticipanteTexto,
} from '../tipos'
import type { LineaPdf } from './lineasPdf'

export interface ResultadoLecturaPdfProyecto {
  extraccion: ExtraccionProyectoDocx
  /** Nombres de los campos que sí se leyeron. */
  leidos: string[]
  /** Nombres de los campos que no se pudieron leer (se llenan a mano en la revisión). */
  noLeidos: string[]
}

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => sinAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim()
const unir = (partes: string[]) => partes.map((p) => p.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
const cuenta = (s: string, c: string) => s.split(c).length - 1

/** El encabezado que el formato repite arriba de cada página (código, versión, fecha). */
function esEncabezadoDePagina(l: LineaPdf): boolean {
  if (l.y > 95) return false
  const t = norm(l.texto)
  return (
    /CODIGO: ?INV-(IC-)?FR/.test(t) ||
    /^FORMATO$/.test(t) ||
    /^PRESENTACION DE PROYECTOS? DE$/.test(t) ||
    /^INVESTIGACION(, DESARROLLO)?$/.test(t) ||
    /^TECNOLOGICO E INNOVACION$/.test(t) ||
    /^VERSION: ?\d+$/.test(t) ||
    /^FECHA: ?\d/.test(t)
  )
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0
  const o = [...valores].sort((a, b) => a - b)
  return o[Math.floor(o.length / 2)]
}

/** Junta las líneas en párrafos: un hueco mayor al normal entre líneas de la misma página es un salto de párrafo. */
function parrafosDe(lineas: LineaPdf[]): string[] {
  if (lineas.length === 0) return []
  const huecos: number[] = []
  for (let i = 1; i < lineas.length; i++) {
    if (lineas[i].pagina === lineas[i - 1].pagina) huecos.push(lineas[i].y - lineas[i - 1].y)
  }
  const normal = mediana(huecos)
  const parrafos: string[][] = [[lineas[0].texto]]
  for (let i = 1; i < lineas.length; i++) {
    const hueco = lineas[i].pagina === lineas[i - 1].pagina ? lineas[i].y - lineas[i - 1].y : 0
    if (normal > 0 && hueco > normal * 1.6) parrafos.push([lineas[i].texto])
    else parrafos[parrafos.length - 1].push(lineas[i].texto)
  }
  return parrafos.map((p) => unir(p)).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

type ClaveSeccion =
  | 'general'
  | 'grupo'
  | 'resumen'
  | 'descripcion'
  | 'planteamiento'
  | 'pregunta'
  | 'justificacion'
  | 'objetivos'
  | 'antecedentes'
  | 'marco'
  | 'metodologia'
  | 'impacto'
  | 'referencias'
  | 'cronograma'
  | 'resultados'
  | 'etico'
  | 'funciones'
  | 'anexo'
  // Solo para marcar dónde termina la sección anterior (no se leen):
  | 'abstract'
  | 'difusion'

/**
 * Encabezados de sección por su nombre, sin el número (la versión 7 del formato numera "4.x" y la versión 0 de 2018 numera
 * "5.x"). Se busca primero el encabezado numerado; si no hay, el que esté escrito todo en mayúsculas.
 */
const ENCABEZADOS: [ClaveSeccion, RegExp, boolean?][] = [
  ['general', /^INFORMACION GENERAL DEL PROYECTO/],
  ['grupo', /^INFORMACION GENERAL DE ?L GRUPO/],
  ['resumen', /^RESUMEN/],
  ['abstract', /^ABSTRACT/],
  ['descripcion', /^DESCRIPCION DEL PROYECTO/],
  ['planteamiento', /^PLANTEAMIENTO/],
  ['pregunta', /^PREGUNTA/],
  ['justificacion', /^JUSTIFICACION/],
  ['objetivos', /^OBJETIVOS/],
  ['antecedentes', /^ANTECEDENTES/],
  ['marco', /^MARCO TEORICO/],
  ['metodologia', /^METODOLOGIA/],
  ['impacto', /^IMPACTO/],
  ['referencias', /^REFERENCIAS/],
  ['cronograma', /^CRONOGRAMA/],
  ['resultados', /^RESULTADOS/],
  ['difusion', /^ESTRATEGIA DE DIFUSION/],
  ['etico', /^COMPONENTE ETICO/],
  ['funciones', /^FUNCIONES/],
  ['anexo', /^ANEXO ?1\b/, true],
]

/** Quita la numeración del comienzo ("4.1.", "5.10 .", "1 ."). */
const sinNumero = (t: string) => t.replace(/^\d+(?:\.\d+)*\.?\s*\.?\s*/, '')

/** Un título está escrito en mayúsculas (sin contar la instrucción entre paréntesis). */
function esTitulo(texto: string): boolean {
  const base = texto.split('(')[0].replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '')
  return base.length >= 4 && base === base.toUpperCase()
}

function indiceDeEncabezado(L: LineaPdf[], re: RegExp, plano: boolean | undefined): number {
  if (plano) return L.findIndex((l) => re.test(norm(l.texto)))
  const numerado = L.findIndex((l) => {
    const t = norm(l.texto)
    const s = sinNumero(t)
    return s !== t && re.test(s)
  })
  if (numerado >= 0) return numerado
  return L.findIndex((l) => {
    const t = norm(l.texto)
    return sinNumero(t) === t && esTitulo(l.texto) && re.test(t)
  })
}

interface Seccion {
  /** Índice de la línea del encabezado. */
  encabezado: number
  /** Líneas del cuerpo, sin el encabezado ni su instrucción entre paréntesis. */
  cuerpo: LineaPdf[]
}

function ubicarSecciones(L: LineaPdf[]): Partial<Record<ClaveSeccion, Seccion>> {
  const hallados: { clave: ClaveSeccion; idx: number }[] = []
  for (const [clave, re, plano] of ENCABEZADOS) {
    const idx = indiceDeEncabezado(L, re, plano)
    if (idx >= 0) hallados.push({ clave, idx })
  }
  hallados.sort((a, b) => a.idx - b.idx)

  const secciones: Partial<Record<ClaveSeccion, Seccion>> = {}
  hallados.forEach((h, k) => {
    const fin = k + 1 < hallados.length ? hallados[k + 1].idx : L.length
    // La instrucción del formato (entre paréntesis) puede ocupar varias líneas del encabezado.
    let saldo = cuenta(L[h.idx].texto, '(') - cuenta(L[h.idx].texto, ')')
    let inicio = h.idx + 1
    while (saldo > 0 && inicio < fin) {
      saldo += cuenta(L[inicio].texto, '(') - cuenta(L[inicio].texto, ')')
      inicio++
    }
    // Líneas de instrucción sueltas, enteras entre paréntesis, al comienzo del cuerpo.
    while (inicio < fin && /^\(.*\)$/.test(L[inicio].texto.trim())) inicio++
    secciones[h.clave] = { encabezado: h.idx, cuerpo: L.slice(inicio, fin) }
  })
  return secciones
}

const textoDe = (s: Seccion | undefined) => (s ? parrafosDe(s.cuerpo).join('\n\n') : '')

// ---------------------------------------------------------------------------
// Sección 1 y 2: datos generales (tablas, se leen por posición)
// ---------------------------------------------------------------------------

function partirNombre(completo: string): { nombres: string; apellidos: string } {
  const p = completo.split(/\s+/).filter(Boolean)
  if (p.length >= 4) return { nombres: p.slice(0, p.length - 2).join(' '), apellidos: p.slice(-2).join(' ') }
  if (p.length === 3) return { nombres: p[0], apellidos: p.slice(1).join(' ') }
  if (p.length === 2) return { nombres: p[0], apellidos: p[1] }
  return { nombres: p[0] ?? '', apellidos: '' }
}

const participanteVacio = (): ParticipanteTexto => ({ nombres: '', apellidos: '', correo: '', orcid: '', googleAcademico: '' })

const ROL_LINEA = /^(INVESTIGADOR\(A\) PRINCIPAL|CO INVESTIGADOR\(A\)|ESTUDIANTE INVESTIGADOR\(A\))/

/** Participantes de la tabla de información general: cada fila empieza en una etiqueta de rol de la columna izquierda. */
function leerParticipantes(general: LineaPdf[]) {
  const principal: string[] = []
  const coInternos: string[] = []
  const externos: string[] = []
  const estudiantes: EstudianteTexto[] = []

  // Los bloques empiezan en la etiqueta del rol y duran hasta la siguiente etiqueta.
  const inicios: { idx: number; rol: 'principal' | 'co' | 'estudiante'; tipo?: 'interno' | 'externo' | 'egresado' }[] = []
  general.forEach((l, idx) => {
    const t = norm(l.items[0]?.texto ?? '')
    if (l.items[0] && l.items[0].x < 120) {
      if (t.startsWith('INVESTIGADOR(A) PRINCIPAL')) inicios.push({ idx, rol: 'principal' })
      else if (t.startsWith('CO INVESTIGADOR(A)')) inicios.push({ idx, rol: 'co' })
      else if (t.startsWith('ESTUDIANTE INVESTIGADOR(A)')) inicios.push({ idx, rol: 'estudiante' })
    }
  })

  // La columna de nombres está siempre en la misma posición: se toma de la fila del Investigador(a) Principal.
  const filaPrincipal = inicios.find((i) => i.rol === 'principal')
  const xNombre = filaPrincipal ? general[filaPrincipal.idx].items.find((i) => i.x > 150 && !/^(DEDICACION|CODIGO|CEDULA)/.test(norm(i.texto)))?.x : undefined

  // Para los "Co investigador(a)", el tipo (UNICESMAG / Externo / Egresado) está en las líneas siguientes de la etiqueta.
  inicios.forEach((ini, k) => {
    const fin = k + 1 < inicios.length ? inicios[k + 1].idx : general.length
    const bloque = general.slice(ini.idx, fin).filter((l) => !ROL_LINEA.test(norm(l.texto)) || l === general[ini.idx])
    const etiqueta = norm(unir(bloque.map((l) => (l.items[0] && l.items[0].x < 120 ? l.items[0].texto : ''))))
    // Columna de nombres: los fragmentos que están justo a la derecha de las etiquetas.
    const nombre = xNombre !== undefined
      ? unir(bloque.flatMap((l) => l.items.filter((i) => Math.abs(i.x - xNombre) < 6 && !/^(DEDICACION|CODIGO|CEDULA)/.test(norm(i.texto))).map((i) => i.texto)))
      : ''

    if (ini.rol === 'principal') principal.push(nombre)
    else if (ini.rol === 'co') {
      if (etiqueta.includes('EXTERNO')) externos.push(nombre)
      else if (etiqueta.includes('EGRESADO')) {
        // Los egresados se leen aparte (no vienen en esta tabla con nombre).
      } else coInternos.push(nombre)
    } else {
      const codigo = bloque.flatMap((l) => l.items).find((i) => /^\d{6,12}$/.test(i.texto.trim()))?.texto.trim() ?? ''
      const cabecera = general[ini.idx].items
      const xAux = cabecera.find((i) => norm(i.texto) === 'AUXILIAR')?.x
      const xAsis = cabecera.find((i) => norm(i.texto) === 'ASISTENTE')?.x
      const marca = bloque.flatMap((l) => l.items).find((i) => /^[Xx]$/.test(i.texto.trim()))
      let rol: EstudianteTexto['rol'] = ''
      if (marca && xAux !== undefined && xAsis !== undefined) rol = Math.abs(marca.x - xAux) <= Math.abs(marca.x - xAsis) ? 'auxiliar' : 'asistente'
      const { nombres, apellidos } = partirNombre(nombre)
      estudiantes.push({ nombres, apellidos, correo: '', codigo, rol })
    }
  })

  const aParticipante = (n: string): ParticipanteTexto => ({ ...participanteVacio(), ...partirNombre(n) })
  return {
    principal: aParticipante(principal.find(Boolean) ?? ''),
    coinvestigador: coInternos.find(Boolean) ? aParticipante(coInternos.find(Boolean) as string) : null,
    externos: externos.filter(Boolean).map(aParticipante),
    estudiantes: estudiantes.filter((e) => e.nombres || e.codigo),
  }
}

const ROL_LINEA_V0 = /^(INVESTIGADOR PRINCIPAL|CO ?- ?INVESTIGADOR|AUXILIAR O ASISTENTE)/

/**
 * Versión 0 del formato (2018): cada fila trae la etiqueta del rol a la izquierda ("Investigador Principal vinculado a la
 * UNICESMAG"), el nombre en una columna aparte y, a la derecha, la dedicación o el código estudiantil.
 */
function leerParticipantesVersionCero(general: LineaPdf[]) {
  const inicios: { idx: number; rol: 'principal' | 'co' | 'estudiante' }[] = []
  general.forEach((l, idx) => {
    const t = norm(l.items[0]?.texto ?? '')
    if (!l.items[0] || l.items[0].x >= 150) return
    if (t.startsWith('INVESTIGADOR PRINCIPAL')) inicios.push({ idx, rol: 'principal' })
    else if (/^CO ?- ?INVESTIGADOR/.test(t)) inicios.push({ idx, rol: 'co' })
    else if (t.startsWith('AUXILIAR O ASISTENTE')) inicios.push({ idx, rol: 'estudiante' })
  })

  const principal: string[] = []
  const coInternos: string[] = []
  const externos: string[] = []
  const estudiantes: EstudianteTexto[] = []

  inicios.forEach((ini, k) => {
    const fin = k + 1 < inicios.length ? inicios[k + 1].idx : general.length
    const bloque = general.slice(ini.idx, fin)
    // El nombre está en la columna del medio: a la derecha de la etiqueta y antes de "Dedicación" / "Código estudiantil".
    const nombre = unir(
      bloque.flatMap((l) => {
        const xCorte = Math.min(...l.items.filter((i) => /^(DEDICACION|CODIGO ESTUDIANTIL)/.test(norm(i.texto))).map((i) => i.x), Number.POSITIVE_INFINITY)
        return l.items.filter((i) => i.x >= 150 && i.x < xCorte && !/^(DEDICACION|CODIGO|T\.? ?C|M\.? ?T)/.test(norm(i.texto))).map((i) => i.texto)
      })
    )
    const etiqueta = norm(unir(bloque.flatMap((l) => l.items.filter((i) => i.x < 150).map((i) => i.texto))))

    if (ini.rol === 'principal') principal.push(nombre)
    else if (ini.rol === 'co') {
      if (etiqueta.includes('EXTERNO')) externos.push(nombre)
      else if (!etiqueta.includes('EGRESADO')) coInternos.push(nombre)
    } else {
      const codigo = bloque.flatMap((l) => l.items).map((i) => /CODIGO ESTUDIANTIL:? ?([A-Z]?\d{5,12})/.exec(norm(i.texto))?.[1]).find(Boolean) ?? ''
      const { nombres, apellidos } = partirNombre(nombre)
      estudiantes.push({ nombres, apellidos, correo: '', codigo, rol: '' })
    }
  })

  const aParticipante = (n: string): ParticipanteTexto => ({ ...participanteVacio(), ...partirNombre(n) })
  return {
    principal: aParticipante(principal.find(Boolean) ?? ''),
    coinvestigador: coInternos.find(Boolean) ? aParticipante(coInternos.find(Boolean) as string) : null,
    externos: externos.filter(Boolean).map(aParticipante),
    estudiantes: estudiantes.filter((e) => e.nombres || e.codigo),
  }
}

/** La "X" de una casilla pertenece a la opción más cercana a su izquierda en la misma fila. */
function opcionMarcada(lineas: LineaPdf[], opciones: [string, RegExp][]): string {
  const fragmentos = lineas.flatMap((l) => l.items.map((i) => ({ ...i, y: l.y })))
  // A veces la X queda pegada al final de la etiqueta ("Investigación Aplicada: X").
  for (const f of fragmentos) {
    const m = /^(.+?)\s+[Xx]$/.exec(f.texto.trim())
    if (!m) continue
    const texto = norm(m[1])
    for (const [nombre, re] of opciones) if (re.test(texto)) return nombre
  }
  const marcas = fragmentos.filter((f) => /^[Xx]$/.test(f.texto.trim()))
  for (const m of marcas) {
    const candidatos = fragmentos.filter((f) => f !== m && f.x < m.x && Math.abs(f.y - m.y) <= 8 && !/^[Xx]$/.test(f.texto.trim()))
    const cerca = candidatos.sort((a, b) => b.x - a.x)[0]
    if (!cerca) continue
    const texto = norm(cerca.texto)
    for (const [nombre, re] of opciones) if (re.test(texto)) return nombre
  }
  return ''
}

const MODALIDADES: [string, RegExp][] = [
  ['Investigación Científica', /INVESTIGACION CIENTIFICA/],
  ['Desarrollo Tecnológico', /DESARROLLO TECNOLOGICO/],
  ['Innovación', /^INNOVACION/],
  ['Creación Artística y Cultural', /CREACION ARTISTICA/],
  ['Investigación - creación', /INVESTIGACION . ?CREACION|^INVESTIGACION - CREACION/],
]

const AREAS: [string, RegExp][] = [
  ['Ciencias naturales', /CIENCIAS NATURALES/],
  ['Ciencias agrícolas', /CIENCIAS AGRICOLAS/],
  ['Ciencias Sociales', /^CIENCIAS$|SOCIALES/],
  ['Ciencias médicas y de la salud', /CIENCIAS MEDICAS|^SALUD$/],
  ['Ingeniería y Tecnología', /INGENIERIA Y TECNOLOGIA/],
  ['Humanidades, Artes y Diseño', /HUMANIDADES|ARTES Y DISENO/],
]

/** Valor que está en la misma columna (por posición) en la línea de abajo de una línea de etiquetas. */
function valorDebajoDe(lineas: LineaPdf[], etiqueta: RegExp): string {
  const i = lineas.findIndex((l) => l.items.some((it) => etiqueta.test(norm(it.texto))))
  if (i < 0 || !lineas[i + 1]) return ''
  const x = lineas[i].items.find((it) => etiqueta.test(norm(it.texto)))!.x
  const mas = lineas[i + 1].items.filter((it) => Math.abs(it.x - x) < 25)
  return unir(mas.map((m) => m.texto))
}

/** Valor a la derecha de una etiqueta en la misma línea (p. ej. "Facultad/Departamento:   Facultad de…"). */
function valorALaDerecha(lineas: LineaPdf[], etiqueta: RegExp): string {
  const l = lineas.find((x) => etiqueta.test(norm(x.items[0]?.texto ?? '')))
  if (!l) return ''
  // En la versión 0 del formato la etiqueta y su valor van en la misma celda ("Nombre del Grupo: Grupo de…").
  const primero = l.items[0].texto
  const iDosPuntos = primero.indexOf(':')
  const mismoItem = iDosPuntos >= 0 ? primero.slice(iDosPuntos + 1).trim() : ''
  return unir([mismoItem, ...l.items.slice(1).map((i) => i.texto).filter((t) => !/^(DEDICACION|TC|MT)/.test(norm(t)))])
}

/** Lo que sigue después de los últimos dos puntos de un texto ("Valor Total: $97.542.633" → "$97.542.633"). */
const despuesDeDosPuntos = (texto: string | undefined) => (texto ? texto.slice(texto.lastIndexOf(':') + 1).trim() : '')

function leerGrupoCesmag(lineas: LineaPdf[]): GrupoTexto | null {
  // Solo el primer bloque (el del grupo diligenciado): termina donde se repite el encabezado de la plantilla en blanco.
  const finBloque = lineas.findIndex((l, i) => i > 0 && /^INFORMACION GENERAL DEL GRUPO/.test(norm(l.texto)))
  const g = finBloque > 0 ? lineas.slice(0, finBloque) : lineas
  const nombre = valorALaDerecha(g, /^NOMBRE DEL GRUPO/)
  if (!nombre) return null

  const iLider = g.findIndex((l) => /^LIDER DEL GRUPO|^DIRECTOR DEL GRUPO/.test(norm(l.items[0]?.texto ?? '')))
  const xLider = iLider >= 0 ? g[iLider].items[1]?.x : undefined
  const liderMismaCelda = iLider >= 0 ? despuesDeDosPuntos(g[iLider].items[0].texto) : ''
  const lider =
    liderMismaCelda ||
    (iLider >= 0 && xLider !== undefined
      ? unir([g[iLider], g[iLider + 1]].filter(Boolean).flatMap((l) => l.items.filter((i) => Math.abs(i.x - xLider) < 6).map((i) => i.texto)))
      : '')

  const iGruplac = g.findIndex((l) => l.items.some((i) => /^CODIGO GRUPLAC/.test(norm(i.texto))))
  const zona = iGruplac >= 0 ? g.slice(iGruplac, iGruplac + 5) : []
  const codGruplac = unir(zona.flatMap((l) => l.items.filter((i) => i.x < 120 && /^[A-Z]{2,}\d{6,}/.test(i.texto.trim())).map((i) => i.texto)))
  const xSi = zona.flatMap((l) => l.items).find((i) => norm(i.texto) === 'SI')
  const xNo = zona.flatMap((l) => l.items).find((i) => norm(i.texto) === 'NO')
  const marca = zona.flatMap((l) => l.items).find((i) => /^[Xx]$/.test(i.texto.trim()))
  // Versión 0: la casilla va dentro del mismo texto ("Sí: __x__").
  const marcadoSi = zona.flatMap((l) => l.items).some((i) => /^SI:? ?_*X/.test(norm(i.texto)))
  const reconocido =
    marcadoSi || Boolean(marca && xSi && (!xNo || Math.abs(marca.x - xSi.x) < Math.abs(marca.x - xNo.x) + 30) && marca.x < (xNo?.x ?? 9999))
  const xCategoria = zona.flatMap((l) => l.items).find((i) => /^CATEGORIA/.test(norm(i.texto)))?.x
  const categoriaEnCelda = zona.flatMap((l) => l.items).map((i) => /^CATEGORIA:? ?([A-D]\d?|RECONOCIDO)$/.exec(norm(i.texto))?.[1]).find(Boolean)
  const categoria =
    xCategoria !== undefined
      ? zona.flatMap((l) => l.items).find((i) => Math.abs(i.x - xCategoria) < 30 && /^[A-D]\d?$/.test(i.texto.trim()))?.texto.trim() ?? categoriaEnCelda ?? ''
      : categoriaEnCelda ?? ''

  // Línea de investigación y ODS: el texto de la columna derecha, entre sus etiquetas.
  const iLinea = g.findIndex((l) => /^LINEA ACTIVA/.test(norm(l.items[0]?.texto ?? '')))
  const iOds = g.findIndex((l) => /^OBJETIVO DE DESARROLLO SOSTENIBLE/.test(norm(l.items[0]?.texto ?? '')))
  const iInvest = g.findIndex((l) => /^INVESTIGADORES DEL PROYECTO/.test(norm(l.texto)))
  const derecha = (desde: number, hasta: number, x: number) =>
    unir(g.slice(desde, hasta).flatMap((l) => l.items.filter((i) => i.x >= x - 6).map((i) => i.texto)))
  const xDer = iLinea >= 0 ? g[iLinea].items[1]?.x : undefined
  const linea = xDer !== undefined && iOds > iLinea ? derecha(iLinea, iOds, xDer) : ''
  const ods = xDer !== undefined && iOds >= 0 ? derecha(iOds, iInvest > iOds ? iInvest : iOds + 2, xDer) : ''

  return {
    nombre,
    facultadOProgramaTexto: valorALaDerecha(g, /^FACULTAD/),
    programaTexto: valorALaDerecha(g, /^PROGRAMA ACADEMICO/),
    lider,
    codGruplac,
    reconocidoMinciencias: reconocido,
    categoria,
    acuerdoInstitucional: '',
    lineaOTexto: linea,
    odsOLineaMedularTexto: ods,
  }
}

// ---------------------------------------------------------------------------
// Sección 4: objetivos, antecedentes, referencias, impactos
// ---------------------------------------------------------------------------

function leerObjetivos(s: Seccion | undefined): { general: string; especificos: string[] } {
  if (!s) return { general: '', especificos: [] }
  const iGeneral = s.cuerpo.findIndex((l) => /^OBJETIVO GENERAL/.test(sinNumero(norm(l.texto))))
  const iEsp = s.cuerpo.findIndex((l) => /^OBJETIVOS ESPECIFICOS/.test(sinNumero(norm(l.texto))))
  const general = iGeneral >= 0 ? parrafosDe(s.cuerpo.slice(iGeneral + 1, iEsp >= 0 ? iEsp : undefined)).join(' ') : ''
  const especificos: string[] = []
  if (iEsp >= 0) {
    for (const l of s.cuerpo.slice(iEsp + 1)) {
      const t = l.texto.trim()
      const viñeta = /^(?:[•·▪●○\-–*]|\d+[.)])\s*(.*)$/.exec(t)
      if (viñeta) especificos.push(viñeta[1])
      else if (especificos.length > 0) especificos[especificos.length - 1] += ` ${t}`
    }
  }
  return { general: general.trim(), especificos: especificos.map((e) => e.replace(/\s+/g, ' ').trim()).filter(Boolean) }
}

/** Una cita en estilo APA: "Apellido, I. & Apellido, J. (2021). Título…". */
const INICIO_ANTECEDENTE = /^[A-ZÁÉÍÓÚÑ][^()]{1,200}\((?:\d{4}[a-z]?|s\. ?f\.|n\. ?d\.)\)\./

function leerAntecedentes(s: Seccion | undefined): string[] {
  if (!s || s.cuerpo.length === 0) return []
  const entradas: string[][] = []
  for (const l of s.cuerpo) {
    if (INICIO_ANTECEDENTE.test(l.texto.trim()) && (entradas.length === 0 || entradas[entradas.length - 1].length > 1)) entradas.push([l.texto])
    else if (entradas.length === 0) entradas.push([l.texto])
    else entradas[entradas.length - 1].push(l.texto)
  }
  return entradas.map((e) => unir(e)).filter(Boolean)
}

const ANIO_REFERENCIA = /\((?:\d{4}[a-z]?|s\. ?f\.|n\. ?d\.)(?:,[^)]*)?\)/
const INICIO_REFERENCIA = /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü'’.\- ]+,\s+[A-ZÁÉÍÓÚÑ]\./

function leerReferencias(s: Seccion | undefined): string[] {
  if (!s) return []
  const refs: string[] = []
  for (const l of s.cuerpo) {
    const t = l.texto.trim()
    const actual = refs[refs.length - 1]
    if (INICIO_REFERENCIA.test(t) && (!actual || ANIO_REFERENCIA.test(actual))) refs.push(t)
    else if (actual !== undefined) refs[refs.length - 1] = `${actual} ${t}`
    else refs.push(t)
  }
  return refs.map((r) => r.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** Tabla de 3 columnas (impacto esperado | beneficiario potencial | indicador verificable). */
function leerImpactos(L: LineaPdf[], s: Seccion | undefined, encabezadoReferencias: LineaPdf | undefined, columnasFijas?: [number, number, number]): ImpactoTexto[] {
  if (!s) return []
  const cabecera = s.cuerpo.find((l) => l.items.some((i) => /^IMPACTO ESPERADO/.test(norm(i.texto))))
  const columnas = columnasFijas ?? cabecera?.items.map((i) => i.x) ?? []
  if (columnas.length < 3) return []
  const [x1, x2, x3] = columnas
  const filasTexto = s.cuerpo.filter((l) => l !== cabecera && l.items.length > 0)
  // El texto de la última fila puede desbordarse a la línea del encabezado "4.8 REFERENCIAS".
  if (encabezadoReferencias && !columnasFijas) filasTexto.push({ ...encabezadoReferencias, items: encabezadoReferencias.items.filter((i) => i.x > x1 + 40) })
  void L

  const colDe = (x: number) => (x >= x3 - 8 ? 3 : x >= x2 - 8 ? 2 : 1)
  // Una fila nueva empieza donde la columna 1 arranca después de una oración terminada en punto.
  const inicios: number[] = []
  let anteriorTermina = true
  filasTexto.forEach((l, idx) => {
    const c1 = l.items.filter((i) => colDe(i.x) === 1).map((i) => i.texto)
    if (c1.length === 0) return
    if (anteriorTermina) inicios.push(idx)
    anteriorTermina = /[.]$/.test(c1[c1.length - 1].trim())
  })

  return inicios.map((ini, k) => {
    const fin = k + 1 < inicios.length ? inicios[k + 1] : filasTexto.length
    const grupo = filasTexto.slice(ini, fin)
    const col = (n: number) => unir(grupo.flatMap((l) => l.items.filter((i) => colDe(i.x) === n).map((i) => i.texto)))
    return { impactoEsperado: col(1), beneficiarioPotencial: col(2), indicadorVerificable: col(3) }
  })
}

// ---------------------------------------------------------------------------
// Cronograma (4.9)
// ---------------------------------------------------------------------------

const CODIGO_ACTIVIDAD = /^[A-Z]\d+[A-Z]\d+$/

/**
 * Tabla "Actividad | Resultado | Responsable | meses del periodo". Cada fila empieza con el código de la actividad
 * (O1A1…); sus X caen bajo el número del mes. El texto de las celdas que ocupan varias líneas se junta por la franja
 * vertical de cada fila. Los meses salen como posición dentro del periodo (1 a 6), igual que en la lectura de Word.
 */
function leerCronograma(s: Seccion | undefined): ActividadCronogramaTexto[] {
  if (!s) return []
  const L = s.cuerpo
  const encabezados = L
    .map((l, idx) => ({ idx, m: /PERIODO (\d+) . ?ANO (\d{4})/.exec(norm(l.texto)) }))
    .filter((h) => h.m)
    .map((h) => ({ idx: h.idx, periodo: Number(h.m![1]), anio: h.m![2] }))
  const resultado: ActividadCronogramaTexto[] = []

  encabezados.forEach((h, k) => {
    const fin = k + 1 < encabezados.length ? encabezados[k + 1].idx : L.length
    const bloque = L.slice(h.idx + 1, fin)

    // Columnas de los meses: la línea de números que sigue a "Actividad | Resultado | Responsable".
    const lineaMeses = bloque.find((l) => l.items.length >= 4 && l.items.every((i) => /^\d{1,2}$/.test(i.texto.trim())))
    if (!lineaMeses) return
    const columnas = lineaMeses.items.map((i) => ({ x: i.x, mes: Number(i.texto) }))
    // Un periodo tiene 6 meses: si falta el primero (queda pegado al título), se deduce por el espaciado.
    if (columnas.length === 5 && columnas.length > 1) {
      const paso = columnas[1].x - columnas[0].x
      columnas.unshift({ x: columnas[0].x - paso, mes: columnas[0].mes - 1 })
    }
    const posicionEnPeriodo = (mes: number) => ((mes - 1) % 6) + 1

    const filas = bloque.filter((l) => l.items[0] && l.items[0].x < 100 && CODIGO_ACTIVIDAD.test(l.items[0].texto.trim()))
    if (filas.length === 0) return
    // Columnas de texto: su posición sale de la primera fila completa.
    const modelo = filas.find((l) => l.items.length >= 3) ?? filas[0]
    const xResultado = modelo.items[1]?.x
    const xResponsable = modelo.items[2]?.x

    filas.forEach((fila, i) => {
      const anterior = filas[i - 1]
      const siguiente = filas[i + 1]
      // El texto de cada celda arranca en la línea del código de su fila y sigue hacia abajo hasta la fila siguiente.
      void anterior
      const arriba = fila.y - 4
      const abajo = siguiente && siguiente.pagina === fila.pagina ? siguiente.y - 4 : Number.POSITIVE_INFINITY
      const franja = bloque.filter((l) => l.pagina === fila.pagina && l.y >= arriba && l.y < abajo)

      const texto = (x: number | undefined) =>
        x === undefined
          ? ''
          : unir(franja.flatMap((l) => l.items.filter((it) => Math.abs(it.x - x) < 10 && !/^[Xx]$/.test(it.texto.trim())).map((it) => it.texto)))
      const meses = fila.items
        .filter((it) => /^[Xx]$/.test(it.texto.trim()))
        .map((it) => columnas.reduce((a, c) => (Math.abs(c.x - it.x) < Math.abs(a.x - it.x) ? c : a)).mes)
        .map(posicionEnPeriodo)

      resultado.push({
        actividad: fila.items[0].texto.trim(),
        resultado: texto(xResultado),
        responsable: texto(xResponsable),
        periodo: `Periodo ${h.periodo}`,
        anio: h.anio,
        meses: [...new Set(meses)].sort((a, b) => a - b),
      })
    })
  })
  return resultado
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export function extraerProyectoDeLineas(crudas: LineaPdf[]): ResultadoLecturaPdfProyecto {
  const L = crudas.filter((l) => !esEncabezadoDePagina(l))
  const sec = ubicarSecciones(L)

  // 1. Información general
  const general = sec.general?.cuerpo ?? []
  const iTitulo = general.findIndex((l) => /^TITULO:?/.test(norm(l.texto)))
  const iPrincipalActual = general.findIndex((l) => ROL_LINEA.test(norm(l.items[0]?.texto ?? '')))
  // Sin las etiquetas de la versión 7, es la versión 0 del formato (2018).
  const versionCero = iPrincipalActual < 0
  const iPrincipal = versionCero ? general.findIndex((l) => ROL_LINEA_V0.test(norm(l.items[0]?.texto ?? ''))) : iPrincipalActual
  // En la versión 0 el título empieza en la misma línea de "Título:"; en la 7 viene en las líneas de abajo.
  const tituloEnLinea = iTitulo >= 0 ? general[iTitulo].texto.replace(/^T[ií]tulo:?\s*/i, '') : ''
  const titulo = iTitulo >= 0 ? unir([tituloEnLinea, ...general.slice(iTitulo + 1, iPrincipal > iTitulo ? iPrincipal : iTitulo + 3).map((l) => l.texto)]) : ''

  const iModalidad = general.findIndex((l) => /^MODALIDAD DEL PROYECTO/.test(norm(l.texto)))
  const iArea = general.findIndex((l) => /^AREA DE CONOCIMIENTO/.test(norm(l.texto)))
  const iLugar = general.findIndex((l) => /^LUGAR DE EJECUCION/.test(norm(l.texto)))
  const iTipo = general.findIndex((l) => /^TIPO DE PROYECTO/.test(norm(l.texto)))
  const iFinanc = general.findIndex((l) => /^FINANCIACION TOTAL/.test(norm(l.texto)))
  const participantes = versionCero
    ? leerParticipantesVersionCero(general.slice(Math.max(iPrincipal, 0), iArea > iPrincipal ? iArea : undefined))
    : leerParticipantes(iModalidad > 0 ? general.slice(Math.max(iPrincipal, 0), iModalidad) : general.slice(Math.max(iPrincipal, 0)))

  const modalidadTexto = iModalidad >= 0 ? opcionMarcada(general.slice(iModalidad + 1, iArea > iModalidad ? iArea : undefined), MODALIDADES) : ''
  const areaTexto = iArea >= 0 ? opcionMarcada(general.slice(iArea + 1, iLugar > iArea ? iLugar : undefined), AREAS) : ''
  const tipoProyectoTexto =
    iTipo >= 0
      ? opcionMarcada(general.slice(iTipo + 1, iFinanc > iTipo ? iFinanc : undefined), [
          ['Investigación Básica', /BASICA/],
          ['Investigación Aplicada', /APLICADA/],
        ])
      : ''

  const iProgramas = general.findIndex((l) => /^PROGRAMA ?\(S\) DE PREGRADO/.test(norm(l.texto)))
  const textosDePrograma = (l: LineaPdf) =>
    unir(l.items.filter((i) => i.x >= 240 && !AREAS.some(([, re]) => re.test(norm(i.texto))) && !/^[Xx]$/.test(i.texto.trim())).map((i) => i.texto))
  const zonaProgramas = iProgramas >= 0 ? general.slice(Math.max(iArea, iProgramas - 3), iLugar > iProgramas ? iLugar : iProgramas + 3) : []
  // Versión 0: cada línea de la columna de la derecha es un programa o departamento distinto.
  const programasTexto = versionCero
    ? zonaProgramas.map(textosDePrograma).filter(Boolean)
    : iProgramas >= 0
      ? [unir(zonaProgramas.map(textosDePrograma))].filter(Boolean)
      : []

  const lugar = iLugar >= 0 ? general.slice(iLugar + 1, iTipo > iLugar ? iTipo : undefined) : []
  // Versión 0: "Ciudad: Pasto   Departamento: Nariño" y "Duración del Proyecto (en meses): 24 meses", cada uno en su línea.
  const ciudadYDepartamento = lugar.map((l) => /Ciudad:\s*(.+?)\s+Departamento:\s*(.+)$/i.exec(l.texto)).find(Boolean)
  const ciudad = (versionCero ? ciudadYDepartamento?.[1]?.trim() : undefined) || valorDebajoDe(lugar, /^CIUDAD/) || ciudadYDepartamento?.[1]?.trim() || ''
  const departamento = (versionCero ? ciudadYDepartamento?.[2]?.trim() : undefined) || valorDebajoDe(lugar, /^DEPARTAMENTO/) || ciudadYDepartamento?.[2]?.trim() || ''
  const duracionEnLinea = despuesDeDosPuntos(lugar.find((l) => /^DURACION DEL PROYECTO/.test(norm(l.texto)))?.texto)
  const duracionTexto = (versionCero ? duracionEnLinea : '') || valorDebajoDe(lugar, /^DURACION DEL PROYECTO/) || duracionEnLinea

  const financiacion = [...general.slice(iFinanc >= 0 ? iFinanc + 1 : 0), ...L.slice((sec.grupo?.encabezado ?? 0) - 6, sec.grupo?.encabezado ?? 0)]
  const valorDe = (re: RegExp) => valorALaDerecha(financiacion, re) || despuesDeDosPuntos(financiacion.find((l) => re.test(norm(l.texto)))?.texto)
  const valorSolicitadoTexto = valorDe(/^VALOR SOLICITADO/)
  const valorContrapartidaTexto = valorDe(/^VALOR CONTRAPARTIDA/)

  // 2. Grupo de investigación
  const grupoCesmag = sec.grupo ? leerGrupoCesmag(sec.grupo.cuerpo) : null

  // 4. Descripción
  const objetivos = leerObjetivos(sec.objetivos)
  const encabezadoReferencias = sec.referencias ? L[sec.referencias.encabezado] : undefined
  // Versión 0: los títulos de la tabla van centrados sobre sus columnas, así que no marcan dónde empieza cada una; las
  // columnas del formato impreso empiezan en x = 95, 263 y 429.
  const impactos = leerImpactos(L, sec.impacto, encabezadoReferencias, versionCero ? [95, 263, 429] : undefined)

  // Componente ético y funciones: el cierre del formato ("Se firma a los…") no es parte del texto.
  const sinFirma = (s: Seccion | undefined): Seccion | undefined => {
    if (!s) return s
    const corte = s.cuerpo.findIndex((l) => /^(SE FIRMA A LOS|FIRMA EN ACUERDO)/.test(norm(l.texto)))
    return corte >= 0 ? { ...s, cuerpo: s.cuerpo.slice(0, corte) } : s
  }
  const sinNota = (s: Seccion | undefined): Seccion | undefined => {
    if (!s) return s
    const corte = s.cuerpo.findIndex((l) => /^NOTA\./.test(norm(l.texto)))
    return corte >= 0 ? { ...s, cuerpo: s.cuerpo.slice(0, corte) } : s
  }

  const cronograma = leerCronograma(sec.cronograma)

  const extraccion: ExtraccionProyectoDocx = {
    titulo,
    principal: participantes.principal,
    coinvestigador: participantes.coinvestigador,
    externos: participantes.externos,
    egresados: [],
    estudiantes: participantes.estudiantes,
    modalidadTexto,
    areaTexto,
    programasTexto,
    ciudad,
    departamento,
    duracionTexto,
    tipoProyectoTexto,
    valorSolicitadoTexto,
    valorContrapartidaTexto,
    grupoCesmag,
    grupoExterno: null,
    resumen: textoDe(sec.resumen),
    planteamiento: textoDe(sec.planteamiento),
    pregunta: textoDe(sec.pregunta),
    justificacion: textoDe(sec.justificacion),
    objetivoGeneralTexto: objetivos.general,
    objetivosEspecificosTexto: objetivos.especificos,
    antecedentesTexto: leerAntecedentes(sec.antecedentes),
    marcoTeorico: textoDe(sec.marco),
    metodologia: textoDe(sec.metodologia),
    impactos,
    referenciasTexto: leerReferencias(sec.referencias),
    cronograma,
    productos: [],
    componenteEtico: textoDe(sinNota(sinFirma(sec.etico))),
    implicacionesEticas: '',
    fuentesFinanciacion: '',
    permisosLicencias: '',
    funcionesEstudiante: textoDe(sinFirma(sec.funciones)),
    hojasVida: [],
  }

  const campos: [string, boolean][] = [
    ['Título', Boolean(extraccion.titulo)],
    ['Investigador(a) principal', Boolean(extraccion.principal.nombres)],
    ['Co-investigador(a) UNICESMAG', Boolean(extraccion.coinvestigador)],
    ['Estudiantes investigadores', extraccion.estudiantes.length > 0],
    ['Modalidad', Boolean(modalidadTexto)],
    ['Área de conocimiento', Boolean(areaTexto)],
    ['Programa al que se articula', programasTexto.length > 0],
    ['Ciudad y departamento', Boolean(ciudad && departamento)],
    ['Duración', Boolean(duracionTexto)],
    ['Tipo de proyecto', Boolean(tipoProyectoTexto)],
    ['Valor solicitado', Boolean(valorSolicitadoTexto)],
    ['Grupo de investigación', Boolean(grupoCesmag)],
    ['Resumen', Boolean(extraccion.resumen)],
    ['Planteamiento del problema', Boolean(extraccion.planteamiento)],
    ['Pregunta de investigación', Boolean(extraccion.pregunta)],
    ['Justificación', Boolean(extraccion.justificacion)],
    ['Objetivo general', Boolean(extraccion.objetivoGeneralTexto)],
    ['Objetivos específicos', extraccion.objetivosEspecificosTexto.length > 0],
    ['Antecedentes', extraccion.antecedentesTexto.length > 0],
    ['Marco teórico', Boolean(extraccion.marcoTeorico)],
    ['Metodología', Boolean(extraccion.metodologia)],
    ['Impacto', impactos.length > 0],
    ['Referencias', extraccion.referenciasTexto.length > 0],
    ['Componente ético', Boolean(extraccion.componenteEtico)],
    ['Funciones del estudiante', Boolean(extraccion.funcionesEstudiante)],
    ['Cronograma de actividades', cronograma.length > 0],
  ]
  // Estos siguen sin leerse por PDF: se llenan a mano en la revisión.
  const siempreManual = ['Productos esperados', 'Hojas de vida (anexo 1)']

  return {
    extraccion,
    leidos: campos.filter(([, ok]) => ok).map(([n]) => n),
    noLeidos: [...campos.filter(([, ok]) => !ok).map(([n]) => n), ...siempreManual],
  }
}
