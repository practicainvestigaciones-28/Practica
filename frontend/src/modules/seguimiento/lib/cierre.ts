import type { ProyectoSeguimiento } from '../api/tipos'
import { etiquetaEvidencia } from './archivos'
import { soportesRegistrados } from './reglas'
import { CATEGORIAS_RESULTADOS } from './resultados'

// Contenido propio del formato INV-IC-FR-021 (acta de cierre), compartido por
// la pestaña de cierre y por el PDF. Los textos son literales del documento.

/** Numeral 1: casillas de "Modalidad del proyecto", en el orden del formato. */
export const MODALIDADES_CIERRE = [
  'Investigación científica',
  'Innovación',
  'Investigación de aula/ Innovación educativa',
  'Desarrollo tecnológico',
  'Creación artística y cultural',
] as const

/** Casilla que corresponde a la modalidad del proyecto, o -1 si no coincide con ninguna. */
export function indiceModalidad(modalidad: string): number {
  const m = modalidad.trim().toLowerCase()
  if (m.includes('educativa') || m.includes('aula')) return 2
  if (m.includes('científica') || m.includes('cientifica')) return 0
  if (m.includes('tecnológico') || m.includes('tecnologico')) return 3
  if (m.includes('artística') || m.includes('artistica')) return 4
  if (m.startsWith('innovaci')) return 1
  return -1
}

export const INTRO_RESULTADOS =
  'Los investigadores entregaron los informes parciales y final, así como los productos resultados de la investigación.'

export const TEXTO_SOPORTES =
  'La presente acta está soportada con las evidencias de los productos resultados de investigación entregados por los investigadores del proyecto, las cuales reposan en la Vicerrectoría de Investigación y Extensión.'

export const TEXTO_PAZ_Y_SALVO =
  'Por medio de la presente, se da por cumplido satisfactoriamente los compromisos adquiridos, se da cierre al proyecto de investigación y se declara que los investigadores se encuentran a paz y salvo por todo concepto relacionado con el proyecto de investigación en mención.'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "Se firma la presente Acta de Cierre en San Juan de Pasto, a los xx días del mes de xxxxx de xxxx." */
export function fraseFirmaCierre(ciudad: string, fechaActa: string): string {
  if (!fechaActa) return `Se firma la presente Acta de Cierre en ${ciudad || '__________'}, a los ___ días del mes de __________ de ____.`
  const [anio, mes, dia] = fechaActa.split('-').map(Number)
  return `Se firma la presente Acta de Cierre en ${ciudad}, a los ${dia} días del mes de ${MESES[mes - 1]} de ${anio}.`
}

export interface FilaResultadoCierre {
  concepto: string
  proyectado: number
  obtenido: number | null
  soporte: string
  observacion: string
  /** Libros y Capítulos de libro se diligencian en el cierre, no en el informe final. */
  clave?: 'libros' | 'capitulos'
}

export interface CategoriaCierre {
  codigo: string
  nombre: string
  opcional: boolean
  filas: FilaResultadoCierre[]
}

/** Numeral 2: mismas categorías del informe final (019) renumeradas 2.1 a 2.4 (la numeración sigue la del formato
 * aunque una categoría sin resultados no se muestre), con
 * "Libros" y "Capítulos de libro" después de los artículos y 2.2/2.4 marcadas como opcionales. */
export function resultadosCierre(p: ProyectoSeguimiento, cierre = p.cierre): CategoriaCierre[] {
  return CATEGORIAS_RESULTADOS.map((cat, i) => {
    const filas: FilaResultadoCierre[] = cat.conceptos.map((concepto) => {
      const x = p.productos.find((prod) => prod.nombre === concepto)
      return { concepto, proyectado: x?.proyectado ?? 0, obtenido: x?.obtenido ?? null, soporte: x ? soportesRegistrados(x).map(etiquetaEvidencia).join('\n') : '', observacion: x?.observacion ?? '' }
    })
    if (i === 0) {
      filas.splice(
        1,
        0,
        { concepto: 'Libros', proyectado: 0, obtenido: cierre.libros, soporte: cierre.libros_soporte, observacion: cierre.libros_observacion, clave: 'libros' },
        { concepto: 'Capítulos de libro', proyectado: 0, obtenido: cierre.capitulos, soporte: cierre.capitulos_soporte, observacion: cierre.capitulos_observacion, clave: 'capitulos' }
      )
    }
    // Solo se muestran los resultados que el proyecto proyectó u obtuvo (1 o más); Libros y Capítulos de libro
    // siempre, porque son lo único que se registra directamente en el cierre.
    const visibles = filas.filter((f) => f.clave || f.proyectado >= 1 || (f.obtenido ?? 0) >= 1)
    return { codigo: `2.${i + 1}`, nombre: cat.nombre, opcional: i === 1 || i === 3, filas: visibles }
  }).filter((cat) => cat.filas.length > 0)
}
