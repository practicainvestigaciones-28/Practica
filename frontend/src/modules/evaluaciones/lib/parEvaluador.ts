// Rúbrica fija de evaluación por par evaluador. El backend solo guarda un
// puntaje y un comentario por evaluación (ver evaluaciones.service.ts), así
// que este detalle por criterio se combina en un solo texto al guardar
// (ver construirComentarios en FormularioCalificacion.tsx).

export interface CriterioEvaluacion {
  id: number
  numero: number
  titulo: string
  descripcion: string
  maximoPuntos: number
}

export interface PuntajeCriterio {
  criterioId: number
  puntaje: number | null
  observacion: string
}

export const criteriosEvaluacion: CriterioEvaluacion[] = [
  {
    id: 1,
    numero: 1,
    titulo: 'PLANTEAMIENTO DEL PROBLEMA',
    descripcion: 'Factibilidad y claridad.',
    maximoPuntos: 10,
  },
  {
    id: 2,
    numero: 2,
    titulo: 'JUSTIFICACIÓN',
    descripcion:
      'Contribuciones de la investigación, pertinencia, relevancia social en cuanto a beneficios para los usuarios directos o indirectos, vinculación con planes de desarrollo nacional, departamental o municipal, planes estratégicos de CTI, Objetivos del Desarrollo Sostenible, aportes del proyecto de investigación con la promoción de programas de pre y posgrado, entre otras.',
    maximoPuntos: 10,
  },
  {
    id: 3,
    numero: 3,
    titulo: 'OBJETIVOS GENERAL Y ESPECÍFICOS',
    descripcion: 'Formulación, claridad, viabilidad, coherencia con el problema de investigación.',
    maximoPuntos: 10,
  },
  {
    id: 4,
    numero: 4,
    titulo: 'ANTECEDENTES',
    descripcion:
      'Calidad del discurso, articulación de los referentes consultados y síntesis del contexto con respecto a estudios previos del orden regional, nacional e internacional, para fundamentar teóricamente el proyecto de investigación.',
    maximoPuntos: 9,
  },
  {
    id: 5,
    numero: 5,
    titulo: 'MARCO TEÓRICO PRELIMINAR',
    descripcion:
      'Breve descripción de la teoría en la cual se inscribe el proyecto de investigación, contemplando aspectos como: supuestos teóricos, categorías, variables, hipótesis de investigación, entre otras.',
    maximoPuntos: 10,
  },
  {
    id: 6,
    numero: 6,
    titulo: 'METODOLOGÍA PROPUESTA',
    descripcion:
      'Rigor científico a nivel metodológico: paradigma, enfoque, método, tipo, diseño, población (o unidad de análisis), muestra (o unidad de trabajo), técnicas e instrumentos de recolección de información, confiabilidad y validación de técnicas, procedimiento para el análisis de la información.',
    maximoPuntos: 10,
  },
  {
    id: 7,
    numero: 7,
    titulo: 'CRONOGRAMA DE ACTIVIDADES',
    descripcion:
      'Coherencia de las actividades planeadas con los objetivos propuestos y el tiempo de desarrollo del proyecto, definiendo de manera precisa las actividades para la ejecución del mismo.',
    maximoPuntos: 6,
  },
  {
    id: 8,
    numero: 8,
    titulo: 'REFERENCIAS',
    descripcion: 'Pertinencia de las fuentes consultadas, dependiendo del tipo de investigación.',
    maximoPuntos: 5,
  },
  {
    id: 9,
    numero: 9,
    titulo: 'APLICACIÓN DE NORMAS',
    descripcion: 'Aplicación adecuada de las normas APA (séptima edición en español).',
    maximoPuntos: 5,
  },
  {
    id: 10,
    numero: 10,
    titulo: 'REDACCIÓN',
    descripcion: 'Claridad y coherencia en la redacción de los textos, además del uso correcto de la ortografía.',
    maximoPuntos: 6,
  },
  {
    id: 11,
    numero: 11,
    titulo: 'IMPACTO',
    descripcion:
      'Establecimiento de indicadores verificables (cuantitativos y/o cualitativos) para evaluar el impacto del proyecto de investigación en cuanto a la relevancia social, económica, educativa, cultural, ambiental, su contribución científica y/o desarrollo tecnológico.',
    maximoPuntos: 9,
  },
]

export const puntajeMaximoTotal = criteriosEvaluacion.reduce((sum, c) => sum + c.maximoPuntos, 0)

export interface CriterioComentado {
  numero: number
  titulo: string
  puntaje: string
  maximoPuntos: number
  observacion: string | null
}

export interface ComentariosParseados {
  criterios: CriterioComentado[]
  observacionesGenerales: string | null
}

const PATRON_LINEA_CRITERIO = /^Criterio (\d+) \((.+?)\): (.+?)\/(\d+)(?: — (.+))?$/
const PATRON_OBSERVACIONES_GENERALES = /^Observaciones generales: (.+)$/

/**
 * Deshace el formato de construirComentarios (FormularioCalificacion.tsx)
 * para mostrar cada criterio en su propia fila en vez de un solo párrafo.
 * Si el texto no sigue ese formato (comentario libre de datos antiguos),
 * devuelve 0 criterios y el llamador debe mostrar el texto crudo.
 */
export function parsearComentariosPar(comentarios: string | null): ComentariosParseados {
  const criterios: CriterioComentado[] = []
  let observacionesGenerales: string | null = null

  for (const linea of (comentarios ?? '').split('\n')) {
    const match = linea.match(PATRON_LINEA_CRITERIO)
    if (match) {
      criterios.push({
        numero: Number(match[1]),
        titulo: match[2],
        puntaje: match[3],
        maximoPuntos: Number(match[4]),
        observacion: match[5]?.trim() || null,
      })
      continue
    }
    const matchGenerales = linea.match(PATRON_OBSERVACIONES_GENERALES)
    if (matchGenerales) observacionesGenerales = matchGenerales[1].trim()
  }

  return { criterios, observacionesGenerales }
}
