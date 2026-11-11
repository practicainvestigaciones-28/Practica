/**
 * Lee los PDF de seguimiento que genera el sistema (o que siguen su mismo formato): acta de inicio (INV-IC-FR-017),
 * informe de avance (FR-018), informe técnico final (FR-019) y acta de cierre (FR-021). Cada uno se reconoce por el
 * código de su encabezado, y de cada uno se leen los datos que el formato trae como texto. Las fechas salen como
 * "AAAA-MM-DD" y lo que no se reconoce no se incluye (se completa a mano en la revisión).
 */
import type { LineaPdf } from './lineasPdf'

export type TipoDocumentoSeguimiento = 'acta_inicio' | 'informe_avance' | 'informe_final' | 'acta_cierre'

export const ETIQUETA_DOCUMENTO: Record<TipoDocumentoSeguimiento, string> = {
  acta_inicio: 'Acta de inicio',
  informe_avance: 'Informe de avance',
  informe_final: 'Informe final',
  acta_cierre: 'Acta de cierre',
}

const CODIGO_DOCUMENTO: Record<string, TipoDocumentoSeguimiento> = {
  'INV-IC-FR-017': 'acta_inicio',
  'INV-IC-FR-018': 'informe_avance',
  'INV-IC-FR-019': 'informe_final',
  'INV-IC-FR-021': 'acta_cierre',
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => sinAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim()
const unir = (partes: string[]) => partes.map((p) => p.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

/** Qué documento es, según el código del encabezado de la primera página; null si no es ninguno de los cuatro. */
export function detectarTipoDocumento(lineas: LineaPdf[]): TipoDocumentoSeguimiento | null {
  for (const l of lineas.slice(0, 12)) {
    const m = /INV-IC-FR-\d{3}/.exec(norm(l.texto))
    if (m && CODIGO_DOCUMENTO[m[0]]) return CODIGO_DOCUMENTO[m[0]]
  }
  return null
}

const MESES: Record<string, string> = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
}

/** "29/10/2026" → "2026-10-29". */
function fechaNumerica(texto: string | undefined): string | undefined {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texto ?? '')
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined
}

/** "16 días del mes de diciembre de 2026" → "2026-12-16". */
function fechaEnLetras(texto: string): string | undefined {
  const m = /(\d{1,2}) d[ií]as del mes de ([a-záéíóú]+) de (\d{4})/i.exec(texto)
  const mes = m ? MESES[norm(m[2])] : undefined
  return m && mes ? `${m[3]}-${mes}-${m[1].padStart(2, '0')}` : undefined
}

/** Valor que sigue a una etiqueta en la misma línea (fragmento siguiente al de la etiqueta). */
function valorDe(lineas: LineaPdf[], etiqueta: RegExp): string | undefined {
  for (const l of lineas) {
    const i = l.items.findIndex((it) => etiqueta.test(norm(it.texto)))
    if (i >= 0 && l.items[i + 1]) return l.items[i + 1].texto.trim()
  }
  return undefined
}

/** Sin el encabezado que se repite arriba de cada página (código, título, versión, fecha) ni el "Página N de M" de abajo. */
function sinEncabezados(lineas: LineaPdf[]): LineaPdf[] {
  return lineas.filter((l) => l.y >= 85 && !/^PAGINA \d+ DE \d+$/.test(norm(l.texto)))
}

function numeroDe(texto: string | undefined): number | undefined {
  const m = /(\d+)/.exec(texto ?? '')
  return m ? Number(m[1]) : undefined
}

/** Texto entre un encabezado (por el inicio de su línea) y el siguiente, como párrafos unidos. */
function cuerpoEntre(lineas: LineaPdf[], desde: RegExp, hasta: RegExp): string {
  const i = lineas.findIndex((l) => desde.test(norm(l.texto)))
  if (i < 0) return ''
  let fin = lineas.length
  for (let k = i + 1; k < lineas.length; k++) {
    if (hasta.test(norm(lineas[k].texto))) {
      fin = k
      break
    }
  }
  return unir(lineas.slice(i + 1, fin).map((l) => l.texto))
}

// ---------------------------------------------------------------------------

export interface LecturaActaInicio {
  numero_acta_aprobacion?: string
  fecha_acta_aprobacion?: string
  centro_costos?: string
  fecha_inicio?: string
  duracion_meses?: number
  tipo_proyecto?: string
  valor_solicitado?: string
  valor_aprobado?: string
}

export function leerActaInicio(crudas: LineaPdf[]): LecturaActaInicio {
  const L = sinEncabezados(crudas)
  const iTipo = L.findIndex((l) => /^2\.? ?TIPO DE PROYECTO/.test(norm(l.texto)))
  return {
    numero_acta_aprobacion: valorDe(L, /^ACTA NO\.?/),
    fecha_acta_aprobacion: fechaNumerica(valorDe(L, /^FECHA$/)),
    centro_costos: valorDe(L, /^CENTRO DE COSTOS/),
    fecha_inicio: fechaNumerica(valorDe(L, /^FECHA DE INICIO/)),
    duracion_meses: numeroDe(valorDe(L, /^DURACION$/)),
    tipo_proyecto: iTipo >= 0 ? unir([L[iTipo + 1]?.texto ?? '']) || undefined : undefined,
    valor_solicitado: valorDe(L, /^VALOR SOLICITADO/),
    valor_aprobado: valorDe(L, /^VALOR APROBADO/),
  }
}

export interface LecturaInformeAvance {
  numero_periodo?: number
  anio?: number
}

/** Del informe de avance el PDF trae el periodo y el año; el avance de cada actividad va como casillas dibujadas, no como texto. */
export function leerInformeAvance(crudas: LineaPdf[]): LecturaInformeAvance {
  const periodo = crudas.map((l) => /PERIODO (\d+) ANO (\d{4})/.exec(norm(l.texto))).find(Boolean)
  return { numero_periodo: periodo ? Number(periodo[1]) : undefined, anio: periodo ? Number(periodo[2]) : undefined }
}

export interface LecturaInformeFinal {
  resumen_ejecucion?: string
  observaciones_objetivos?: string
  actividades_estudiantes?: string
  evidencias_estudiantes?: string
  fecha_radicacion?: string
}

export function leerInformeFinal(crudas: LineaPdf[]): LecturaInformeFinal {
  const L = sinEncabezados(crudas)
  const observaciones = L.find((l) => /^OBSERVACIONES: /.test(norm(l.texto)))?.texto.replace(/^Observaciones:\s*/i, '')
  const fecha = L.map((l) => /FECHA DE ENTREGA DE INFORME TECNICO FINAL: ?(.*)$/.exec(norm(l.texto))).find(Boolean)
  return {
    resumen_ejecucion: cuerpoEntre(L, /^2\.? ?RESUMEN DEL PROYECTO/, /^3\.? ?CUMPLIMIENTO/) || undefined,
    observaciones_objetivos: observaciones?.trim() || undefined,
    actividades_estudiantes: cuerpoEntre(L, /^ACTIVIDADES DESARROLLADAS/, /^EVIDENCIAS$/) || undefined,
    evidencias_estudiantes: cuerpoEntre(L, /^EVIDENCIAS$/, /^SOPORTES:/) || undefined,
    fecha_radicacion: fecha ? fechaNumerica(fecha[1]) : undefined,
  }
}

export interface LecturaActaCierre {
  fecha_inicio_real?: string
  fecha_finalizacion_real?: string
  duracion_real_meses?: number
  ciudad_firma?: string
  fecha_acta?: string
  libros?: number
  capitulos?: number
}

export function leerActaCierre(crudas: LineaPdf[]): LecturaActaCierre {
  const L = sinEncabezados(crudas)
  const firma = L.map((l) => /Se firma la presente Acta de Cierre en (.+?), a los (.+)$/i.exec(l.texto)).find(Boolean)
  const contadores = (etiqueta: RegExp) => {
    const l = L.find((x) => etiqueta.test(norm(x.items[0]?.texto ?? '')))
    // Resultados proyectados | obtenidos: el segundo número es el obtenido.
    const numeros = l?.items.slice(1).map((i) => numeroDe(i.texto)).filter((n): n is number => n !== undefined) ?? []
    return numeros.length >= 2 ? numeros[1] : undefined
  }
  return {
    fecha_inicio_real: fechaNumerica(valorDe(L, /^FECHA DE INICIO/)),
    fecha_finalizacion_real: fechaNumerica(valorDe(L, /^FECHA DE FINALIZACION/)),
    duracion_real_meses: numeroDe(valorDe(L, /^DURACION$/)),
    ciudad_firma: firma?.[1].trim(),
    fecha_acta: firma ? fechaEnLetras(firma[2]) : undefined,
    libros: contadores(/^LIBROS$/),
    capitulos: contadores(/^CAPITULOS DE LIBRO$/),
  }
}
