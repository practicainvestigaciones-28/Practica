import type { Evidencia, ProductoComprometido, ProyectoSeguimiento, TextosCierre } from '../api/tipos'
import { etiquetaEvidencia } from './archivos'
import { soportesRegistrados } from './reglas'
import { categoriasDeResultados } from './resultados'

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

export const TEXTOS_CIERRE_BASE: Required<TextosCierre> = {
  intro_resultados: INTRO_RESULTADOS,
  soportes: TEXTO_SOPORTES,
  paz_y_salvo: TEXTO_PAZ_Y_SALVO,
}

/** Textos fijos del acta de cierre: los que editó el Administrador y, donde no editó, los del formato. */
export const textosCierre = (editados?: TextosCierre | null): Required<TextosCierre> => ({ ...TEXTOS_CIERRE_BASE, ...(editados ?? {}) })

/** Solo deja los textos que de verdad cambian el del formato (sin vacíos ni iguales al original). */
export function textosEditados(textos?: TextosCierre | null): TextosCierre {
  const limpio: TextosCierre = {}
  for (const clave of Object.keys(TEXTOS_CIERRE_BASE) as (keyof TextosCierre)[]) {
    const valor = textos?.[clave]?.trim()
    if (valor && valor !== TEXTOS_CIERRE_BASE[clave]) limpio[clave] = valor
  }
  return limpio
}

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
  /** Los soportes tal como se registraron (archivo o enlace), para poder abrirlos en pantalla. */
  soportes?: Evidencia[]
  observacion: string
  /** Libros y Capítulos de libro se diligencian en el cierre, no en el informe final. */
  clave?: 'libros' | 'capitulos'
  /** Título de una subcategoría con varios tipos (A1, A2...): ocupa la fila y no lleva datos. */
  titulo?: boolean
  /** Tipo de producto bajo el título de su subcategoría. */
  sangria?: boolean
  /** Franja gris que separa un concepto de un solo tipo del grupo anterior. */
  separador?: boolean
}

export interface CategoriaCierre {
  codigo: string
  nombre: string
  opcional: boolean
  filas: FilaResultadoCierre[]
}

/** Numeral 2: mismas categorías del informe final (019) renumeradas 2.1 a 2.4 (la numeración sigue la del formato
 * aunque una categoría sin resultados no se muestre), con
2.2/2.4 marcadas como opcionales. */
export function resultadosCierre(p: ProyectoSeguimiento): CategoriaCierre[] {
  // Lo que se diligenció en el informe final: los tipos de producto (A1, A2, B...) bajo sus subcategorías, con lo que el proyecto
  // comprometió y lo que se agregó después.
  return categoriasDeResultados(p)
    .map((cat, i) => {
      // Solo los resultados que el proyecto proyectó u obtuvo (1 o más).
      const conDatos = (x: ProductoComprometido | undefined) => !!x && (x.proyectado >= 1 || (x.obtenido ?? 0) >= 1)
      const filas: FilaResultadoCierre[] = []
      cat.filas.forEach((fila, k) => {
        if (fila.titulo) {
          // El título solo va si le sigue algún tipo con datos antes del siguiente título.
          let hay = false
          for (let n = k + 1; n < cat.filas.length && !cat.filas[n].titulo; n++) if (conDatos(cat.filas[n].producto)) hay = true
          if (hay) filas.push({ concepto: fila.etiqueta, proyectado: 0, obtenido: null, soporte: '', observacion: '', titulo: true })
          return
        }
        const x = fila.producto
        if (!conDatos(x)) return
        filas.push({
          concepto: fila.etiqueta,
          proyectado: x?.proyectado ?? 0,
          obtenido: x?.obtenido ?? null,
          soporte: x ? soportesRegistrados(x).map(etiquetaEvidencia).join('\n') : '',
          soportes: x ? soportesRegistrados(x) : [],
          observacion: x?.observacion ?? '',
          sangria: fila.sangria,
        })
      })
      // Franja gris antes de un concepto de un solo tipo que viene después de un grupo con tipos.
      const conSeparadores: FilaResultadoCierre[] = []
      filas.forEach((f, k) => {
        const anterior = filas[k - 1]
        if (anterior && !f.titulo && !f.sangria && (anterior.titulo || anterior.sangria)) conSeparadores.push({ concepto: '', proyectado: 0, obtenido: null, soporte: '', observacion: '', separador: true })
        conSeparadores.push(f)
      })
      return { codigo: `2.${i + 1}`, nombre: cat.nombre, opcional: i === 1 || i === 3, filas: conSeparadores }
    })
    .filter((cat) => cat.filas.length > 0)
}
