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

export type DecisionFinal = 'aprobado' | 'aprobado_con_correccion' | 'no_aprobado'

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
      'Contribuciones a la investigación, pertinencia, relevancia con respecto con planes de desarrollo institucional, departamental, nacional, planes estratégicos de CTI, Objetivos de Desarrollo Sostenible, la promoción de proyectos por parte de la comunidad, entre otros.',
    maximoPuntos: 10,
  },
  {
    id: 3,
    numero: 3,
    titulo: 'OBJETIVOS GENERAL Y ESPECÍFICOS',
    descripcion:
      'Formulación, claridad, coherencia con planteamiento, coherencia, variables, hipótesis de investigación, entre otros.',
    maximoPuntos: 10,
  },
  {
    id: 4,
    numero: 4,
    titulo: 'ANTECEDENTES',
    descripcion:
      'Calidad del discurso, articulación de los referentes conceptuales y metodológicos respecto a estudios previos de orden regional, nacional e internacional, fundamento teórico articulado al proyecto de investigación, entre otros.',
    maximoPuntos: 9,
  },
  {
    id: 5,
    numero: 5,
    titulo: 'MARCO TEÓRICO PRELIMINAR',
    descripcion:
      'Breve descripción de la teoría que se usará en el proyecto de investigación, comprensión del componente teórico, hipótesis relacionadas, variables, entre otros.',
    maximoPuntos: 10,
  },
  {
    id: 6,
    numero: 6,
    titulo: 'METODOLOGÍA PROPUESTA',
    descripcion:
      'Rigor científico a nivel metodológico: paradigma, enfoque, método, diseño, población o unidad de trabajo, instrumento o técnica de recolección de información, confiabilidad y validación de instrumentos, procedimiento para el análisis de la información.',
    maximoPuntos: 10,
  },
  {
    id: 7,
    numero: 7,
    titulo: 'CRONOGRAMA DE ACTIVIDADES',
    descripcion:
      'Coherencia de las actividades planeadas con los objetivos propuestos y el tiempo de desarrollo del proyecto, definición de manera precisa de las actividades de ejecución del mismo.',
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
    descripcion: 'Aplicación adecuada de las normas (séptima edición en español).',
    maximoPuntos: 5,
  },
  {
    id: 10,
    numero: 10,
    titulo: 'REDACCIÓN',
    descripcion: 'Claridad y coherencia en la redacción, además del uso correcto de la ortografía.',
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
