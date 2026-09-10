import type { Estado } from './estado'

export interface ProyectoParaEvaluar {
  id: number
  titulo: string
  investigadorPrincipal: string
  convocatoria: string
  facultad: string
  estado: Estado
  fechaEnvio: string
  fechaLimiteEvaluacion: string
  resumen: string
  anexos: string[]
  asignado: boolean
}

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

export interface EvaluacionGuardada {
  proyectoId: number
  puntajes: PuntajeCriterio[]
  observacionesGenerales: string
  decision: DecisionFinal | null
  firmaArchivo: string | null
  nombreEvaluador: string
  cedula: string
  ciudad: string
  fecha: string
}

// ⚠️ MODO PRUEBA — mientras el backend no esté listo. Este catálogo de
// criterios y sus puntajes máximos lo tomé literal de tu mockup del
// formulario; si en la práctica formativa ya existe una versión oficial
// (por ejemplo un documento de la Vicerrectoría), reemplázalo aquí.
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
    maximoPuntos: 10,
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
    maximoPuntos: 4,
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

const proyectosSemilla: ProyectoParaEvaluar[] = [
  {
    id: 1,
    titulo: 'Proyecto 1',
    investigadorPrincipal: 'Investigador 1',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'Pendiente',
    fechaEnvio: '01/01/2026',
    fechaLimiteEvaluacion: '15/01/2026',
    resumen:
      'Lorem ipsum dolor sit amet consectetur adipiscing elit fringilla, ut convallis vulputate est vestibulum rhoncus facilisi, hac elementum arcu. Leo dictum a interdum. Ver mas',
    anexos: ['Propuesta_proyecto_1.pdf'],
    asignado: true,
  },
  {
    id: 2,
    titulo: 'Proyecto 2',
    investigadorPrincipal: 'Investigador 2',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'En revisión',
    fechaEnvio: '02/01/2026',
    fechaLimiteEvaluacion: '16/01/2026',
    resumen: 'Lorem ipsum dolor sit amet consectetur adipiscing elit fringilla, ut convallis vulputate.',
    anexos: ['Propuesta_proyecto_2.pdf'],
    asignado: true,
  },
  {
    id: 3,
    titulo: 'Proyecto 3',
    investigadorPrincipal: 'Investigador 3',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'En revisión',
    fechaEnvio: '01/01/2026',
    fechaLimiteEvaluacion: '15/01/2026',
    resumen:
      'Lorem ipsum dolor sit amet consectetur adipiscing elit fringilla, ut convallis vulputate est vestibulum rhoncus facilisi, hac elementum arcu. Leo dictum a interdum. Ver mas',
    anexos: ['Propuesta_proyecto_1.pdf'],
    asignado: true,
  },
  {
    id: 4,
    titulo: 'Proyecto 4',
    investigadorPrincipal: 'Investigador 4',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'Aprobado',
    fechaEnvio: '18/12/2025',
    fechaLimiteEvaluacion: '02/01/2026',
    resumen: 'Lorem ipsum dolor sit amet consectetur adipiscing elit fringilla, ut convallis vulputate.',
    anexos: ['Propuesta_proyecto_4.pdf'],
    asignado: true,
  },
  {
    id: 5,
    titulo: 'Proyecto 5',
    investigadorPrincipal: 'Investigador 5',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad Y',
    estado: 'Aprobado',
    fechaEnvio: '19/12/2025',
    fechaLimiteEvaluacion: '03/01/2026',
    resumen: 'Lorem ipsum dolor sit amet consectetur adipiscing elit fringilla, ut convallis vulputate.',
    anexos: ['Propuesta_proyecto_5.pdf'],
    asignado: true,
  },
  {
    id: 6,
    titulo: 'Proyecto 6',
    investigadorPrincipal: 'Investigador 6',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad Y',
    estado: 'Correcciones',
    fechaEnvio: '20/12/2025',
    fechaLimiteEvaluacion: '04/01/2026',
    resumen: 'Lorem ipsum dolor sit amet consectetur adipiscing elit fringilla, ut convallis vulputate.',
    anexos: ['Propuesta_proyecto_6.pdf'],
    asignado: true,
  },
]

const STORAGE_KEY_PROYECTOS = 'sgpvie_par_evaluador_proyectos'
const STORAGE_KEY_EVALUACIONES = 'sgpvie_par_evaluador_evaluaciones'

function cargar<T>(key: string, semilla: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return semilla
}

function guardarEnStorage(key: string, datos: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(datos))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let proyectos: ProyectoParaEvaluar[] = cargar(STORAGE_KEY_PROYECTOS, proyectosSemilla)
let evaluaciones: Record<number, EvaluacionGuardada> = cargar(STORAGE_KEY_EVALUACIONES, {})

export function getProyectosParaEvaluar(): ProyectoParaEvaluar[] {
  return proyectos
}

export function getProyectoParaEvaluar(id: number): ProyectoParaEvaluar | undefined {
  return proyectos.find((p) => p.id === id)
}

export function getEvaluacionGuardada(proyectoId: number): EvaluacionGuardada | undefined {
  return evaluaciones[proyectoId]
}

export function guardarEvaluacion(evaluacion: EvaluacionGuardada): void {
  evaluaciones = { ...evaluaciones, [evaluacion.proyectoId]: evaluacion }
  guardarEnStorage(STORAGE_KEY_EVALUACIONES, evaluaciones)

  // El estado del proyecto en la lista se actualiza según la decisión final
  const nuevoEstado: Estado =
    evaluacion.decision === 'aprobado'
      ? 'Aprobado'
      : evaluacion.decision === 'aprobado_con_correccion'
        ? 'Correcciones'
        : evaluacion.decision === 'no_aprobado'
          ? 'Rechazado'
          : 'En revisión'

  proyectos = proyectos.map((p) => (p.id === evaluacion.proyectoId ? { ...p, estado: nuevoEstado } : p))
  guardarEnStorage(STORAGE_KEY_PROYECTOS, proyectos)
}