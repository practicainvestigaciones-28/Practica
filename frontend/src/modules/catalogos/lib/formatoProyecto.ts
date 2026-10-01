// Resumen de las secciones del formato de registro de proyecto
// (frontend/src/modules/proyectos/pages/CrearProyecto.tsx), para mostrarlo
// como referencia de solo lectura en "Formatos de evaluación" del
// Administrador. No es un documento institucional con código propio, a
// diferencia de los formatos de comités y pares.

export interface SeccionFormatoProyecto {
  titulo: string
  descripcion: string
}

export const seccionesFormatoProyecto: SeccionFormatoProyecto[] = [
  {
    titulo: 'Hojas de vida',
    descripcion:
      'Datos del investigador principal y de cada co-investigador: identificación, contacto, formación académica, cargos, títulos y producción académica.',
  },
  {
    titulo: 'Información general',
    descripcion:
      'Título del proyecto, participantes, modalidad, área de conocimiento, programa académico al que se articula, lugar de ejecución, duración y financiación solicitada.',
  },
  {
    titulo: 'Grupos y egresados',
    descripcion: 'Grupo de investigación al que se adscribe el proyecto y, si aplica, participantes egresados.',
  },
  {
    titulo: 'Formulación del proyecto',
    descripcion:
      'Resumen, planteamiento del problema, pregunta de investigación, justificación, objetivo general y específicos, antecedentes.',
  },
  {
    titulo: 'Marco teórico y metodología',
    descripcion: 'Marco teórico preliminar y metodología propuesta para el desarrollo del proyecto.',
  },
  {
    titulo: 'Cronograma',
    descripcion: 'Actividades planeadas, sus resultados esperados y su programación por periodos.',
  },
  {
    titulo: 'Resultados esperados',
    descripcion: 'Productos de investigación comprometidos, según las categorías obligatorias del catálogo.',
  },
  {
    titulo: 'Componente ético',
    descripcion: 'Descripción del componente ético del proyecto y funciones del estudiante auxiliar.',
  },
  {
    titulo: 'Firmas y anexos',
    descripcion: 'Documentos de soporte cargados (carta aval, acta de compromiso, entre otros) para enviar el proyecto.',
  },
]
