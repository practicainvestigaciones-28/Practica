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
