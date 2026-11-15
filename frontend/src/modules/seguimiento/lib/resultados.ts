import type { ProductoComprometido, ProyectoSeguimiento } from '../api/tipos'
// Numeral 4 del formato INV-IC-FR-019: categorías y conceptos de resultados,
// con los nombres literales del documento. El orden es el del formato.

export interface CategoriaResultados {
  codigo: string
  nombre: string
  conceptos: string[]
}

export const CATEGORIAS_RESULTADOS: CategoriaResultados[] = [
  {
    codigo: '4.1',
    nombre: 'Generación de nuevo conocimiento',
    conceptos: [
      'Artículos de investigación',
      'Productos tecnológicos patentados o en proceso de concesión de la patente',
      'Variedad vegetal',
      'Nueva raza animal',
      'Obras o productos de investigación',
    ],
  },
  {
    codigo: '4.2',
    nombre: 'Desarrollo tecnológico e innovación',
    conceptos: [
      'Productos tecnológicos certificados o validados',
      'Productos empresariales',
      'Regulaciones, normas, reglamentos o legislaciones.',
      'Consultorías e informes técnicos finales',
      'Acuerdos de licencia para la explotación de obras protegidas por derecho de autor',
    ],
  },
  {
    codigo: '4.3',
    nombre: 'Formación de recurso humano en CTeI',
    conceptos: [
      'Dirección tesis de doctorado',
      'Dirección trabajo de grado de maestría',
      'Dirección trabajo de grado pregrado',
      'Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+I (con acto administrativa en el cual se asigna recurso externo)',
      'Proyecto de extensión y responsabilidad social en CTI (que involucre soluciones)',
      'Apoyo a programas y cursos de formación de investigadores (Acto administrativo)',
      'Acompañamiento y asesoría de línea temática del programa Ondas (Aval del programa Ondas)',
    ],
  },
  {
    codigo: '4.4',
    nombre: 'Apropiación social del conocimiento',
    conceptos: [
      'Comunicación con enfoque en las relaciones entre ciencia, tecnología y sociedad',
      'Estrategia pedagógica para el fomento de la CTeI',
      'Participación ciudadana en CTeI',
      'Circulación de conocimiento especializado',
      'Reconocimientos nacionales o internacionales por procesos de apropiación social del conocimiento.',
    ],
  },
]

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Una fila de la tabla de resultados: el título de una subcategoría ("concepto") o un tipo de producto (A1, A2...) con lo que el proyecto comprometió. */
export interface FilaResultado {
  clave: string
  etiqueta: string
  /** Título de una subcategoría con varios tipos (no lleva datos). */
  titulo: boolean
  /** Tipo de producto bajo su subcategoría. */
  sangria: boolean
  /** El comprometido en el proyecto o, si no lo estaba, uno en blanco (proyectado 0) para registrar lo que se obtuvo igual. */
  producto?: ProductoComprometido
}

export interface CategoriaResultadosFilas {
  codigo: string
  nombre: string
  filas: FilaResultado[]
}

/** Identifica un producto comprometido (un mismo nombre de tipo puede estar en dos subcategorías). */
export const claveProducto = (x: { categoria: string; subcategoria?: string; nombre: string }) => `${x.categoria}|${x.subcategoria ?? ''}|${x.nombre}`

/**
 * Numeral 4 del formato: las categorías habilitadas para la convocatoria, cada una con sus subcategorías y, debajo, los tipos de
 * producto (A1, A2, B...). Las subcategorías de un solo tipo con su mismo nombre van en una sola fila. Sin catálogo disponible se usa la
 * lista fija del formato.
 */
export function categoriasDeResultados(p: { resultados_taxonomia?: ProyectoSeguimiento['resultados_taxonomia']; productos: ProductoComprometido[] }): CategoriaResultadosFilas[] {
  const taxonomia = p.resultados_taxonomia ?? CATEGORIAS_RESULTADOS.map((c) => ({ nombre: c.nombre, subcategorias: c.conceptos.map((n) => ({ nombre: n, tipos: [n] })) }))
  return taxonomia.map((cat, i) => {
    const filas: FilaResultado[] = []
    for (const sub of cat.subcategorias) {
      const buscar = (tipo: string): ProductoComprometido =>
        p.productos.find((x) => normalizar(x.nombre) === normalizar(tipo) && (!x.subcategoria || normalizar(x.subcategoria) === normalizar(sub.nombre)) && (p.resultados_taxonomia ? normalizar(x.categoria) === normalizar(cat.nombre) : true)) ??
        { categoria: cat.nombre, subcategoria: sub.nombre, nombre: tipo, proyectado: 0, obtenido: null, soportes: [], observacion: '' }
      const unico = sub.tipos.length <= 1 && (sub.tipos.length === 0 || normalizar(sub.tipos[0]) === normalizar(sub.nombre))
      if (unico) {
        filas.push({ clave: `${cat.nombre}|${sub.nombre}`, etiqueta: sub.nombre, titulo: false, sangria: false, producto: buscar(sub.tipos[0] ?? sub.nombre) })
      } else {
        filas.push({ clave: `${cat.nombre}|${sub.nombre}|titulo`, etiqueta: sub.nombre, titulo: true, sangria: false })
        for (const tipo of sub.tipos) filas.push({ clave: `${cat.nombre}|${sub.nombre}|${tipo}`, etiqueta: tipo, titulo: false, sangria: true, producto: buscar(tipo) })
      }
    }
    return { codigo: `4.${i + 1}`, nombre: cat.nombre, filas }
  })
}
