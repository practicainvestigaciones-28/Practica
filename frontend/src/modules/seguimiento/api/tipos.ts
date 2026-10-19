// Contrato de datos de la etapa de seguimiento, ejecución y cierre
// (M-02 a M-08 del prototipo, RQF81-RQF141). Las tablas equivalentes ya
// existen en Prisma (FinanciacionVigencia,
// FirmaDocumento, etc.); estas interfaces son la forma en que el frontend
// espera recibirlas cuando existan las rutas /api/seguimiento.

export interface TipoNovedad {
  id: number
  nombre: string
  descripcion: string
  afecta_fechas: boolean
  afecta_participantes: boolean
  afecta_productos: boolean
  activo: boolean
}

export interface TipoArticulacion {
  id: number
  nombre: string
  descripcion: string
  activo: boolean
}

export interface Vigencia {
  anio: number
  asignado: number
  ejecutado: number
}

export interface MetaCronograma {
  objetivo: string
  meta: string
  actividad: string
  responsable: string
}

/** Soporte de una actividad: un enlace o un archivo adjunto (su contenido se guarda aparte, ver lib/archivos.ts). */
export type Evidencia =
  | { tipo: 'enlace'; url: string }
  | { tipo: 'archivo'; id: string; nombre: string; tamano: number; mime: string }

export type EstadoActividad = 'No iniciada' | 'En ejecución' | 'Cumplida' | 'Aplazada'

export interface DetalleAvance {
  /** Cronograma del formato INV-IC-FR-018: 6 meses x 4 semanas; true = semana en que se trabajó la actividad. */
  semanas: boolean[]
  estado: EstadoActividad
  porcentaje: number
  /** Avance acumulado con que cerró el periodo anterior aprobado (0 en el primero): desde ahí se continúa. */
  previo?: number
  observacion: string
  evidencias: Evidencia[]
}

export type EstadoPeriodo = 'Programado' | 'Borrador' | 'Radicado' | 'Aprobado' | 'Devuelto'

export interface PeriodoInforme {
  numero: number
  apertura: string
  limite: string
  estado: EstadoPeriodo
  detalle: DetalleAvance[]
  fecha_radicacion: string | null
  observacion_revision: string
  /** El investigador solicita el informe y el Administrador lo habilita: sin eso no se puede diligenciar (yyyy-mm-dd). */
  fecha_solicitud?: string | null
  fecha_habilitacion?: string | null
  /** Motivo con que el Administrador rechazó la última solicitud. */
  observacion_solicitud?: string
  /** El informe lo firman el investigador principal y el co-investigador antes de radicarlo. */
  firmas: FirmaSeguimiento[]
}

export type EstadoNovedad = 'Pendiente' | 'Aprobada' | 'Rechazada'

export interface Novedad {
  id: number
  id_tipo: number
  tipo: string
  fecha: string
  justificacion: string
  soporte: string
  estado: EstadoNovedad
  observacion: string
  meses_prorroga: number
  participante_saliente: string
  participante_entrante: string
  acto_administrativo: string
}

export interface ProductoComprometido {
  categoria: string
  nombre: string
  proyectado: number
  obtenido: number | null
  /** Soporte de los resultados obtenidos: cada uno es un enlace o un archivo adjunto (uno por resultado obtenido). */
  soportes: Evidencia[]
  observacion: string
}

export interface ObjetivoInforme {
  titulo: string
  descripcion: string
  cumplimiento: string
  cumplido: boolean
}

export type RolFirmante = 'Investigador principal' | 'Co-investigadores' | 'Líder del grupo' | 'Vicerrector'

export interface FirmaSeguimiento {
  rol: RolFirmante
  firmado: boolean
  fecha: string | null
}

export type EstadoInformeFinal = 'Borrador' | 'Radicado' | 'Aprobado' | 'Devuelto'

/** Datos de contacto de un investigador en el numeral 1 del formato INV-IC-FR-019. */
export interface PersonaInforme {
  nombre: string
  grupo: string
  programa: string
  correo: string
  telefono: string
}

export interface ApoyoInforme {
  nombre: string
  tipo: 'Auxiliar' | 'Asistente'
  codigo_estudiantil: string
  correo: string
}

/** Numeral 1 del formato: lo que no viene ya del proyecto (título, convocatoria, centro de costos). */
export interface InfoGeneralInforme {
  area_conocimiento: string
  investigador_principal: PersonaInforme
  co_investigador_interno: PersonaInforme
  co_investigador_externo: PersonaInforme
  apoyos: ApoyoInforme[]
  ciudad: string
  departamento: string
  financiacion_externa: number
}

/** Informe técnico final, con los numerales del formato INV-IC-FR-019. */
export interface InformeFinal {
  /** 1. Información general del proyecto */
  info: InfoGeneralInforme
  /** 2. Resumen del proyecto */
  resumen: string
  /** 3. Cumplimiento de objetivos */
  objetivos: ObjetivoInforme[]
  observaciones_objetivos: string
  /** 5 y 6. Filas de 5 columnas: nombre, fecha de adquisición, estado o ISBN/ISSN, código de inventario, observaciones. */
  equipos: string[][]
  materiales: string[][]
  /** 7. Participación de auxiliares o asistentes (los nombres son los de info.apoyos). */
  actividades_apoyos: string
  evidencias_apoyos: string
  estado: EstadoInformeFinal
  observacion_devolucion: string
  /** Fecha de entrega: el día en que se radica. */
  fecha_entrega: string | null
  /** El investigador solicita el informe final y el Administrador lo habilita; solo entonces se diligencia. */
  fecha_solicitud?: string | null
  fecha_habilitacion?: string | null
  /** Motivo con que el Administrador rechazó la última solicitud. */
  observacion_solicitud?: string
  firmas: FirmaSeguimiento[]
}

/** Acta de cierre, con lo que el formato INV-IC-FR-021 pide además de lo que ya
 * viene del proyecto y del informe técnico final. */
export interface CierreProyecto {
  /** Numeral 1: línea de investigación del investigador principal y del coinvestigador. */
  linea_investigacion_principal: string
  linea_investigacion_co: string
  /** Programa académico de cada estudiante investigador, en el orden de informe_final.info.apoyos. */
  programas_estudiantes: string[]
  /** Numeral 2.1: Libros y Capítulos de libro solo existen en este formato. */
  libros: number
  libros_soporte: string
  libros_observacion: string
  capitulos: number
  capitulos_soporte: string
  capitulos_observacion: string
  paz_y_salvo: boolean
  fecha_fin_real: string
  ciudad: string
  fecha_acta: string
  firmas: FirmaSeguimiento[]
  finalizado: boolean
}

/** Bloque "Equipo investigador" del formato INV-IC-FR-018. */
export interface EquipoInvestigador {
  co_investigadores_internos: string[]
  co_investigadores_externos: string[]
  auxiliares: string[]
  asistentes: string[]
}

export type EstadoSeguimiento = 'En ejecución' | 'En seguimiento' | 'Informe final radicado' | 'Finalizado' | 'Cancelado'

export interface ProyectoSeguimiento {
  id_proyecto: number
  titulo: string
  investigador_principal: string
  programa_academico: string
  equipo: EquipoInvestigador
  grupo: string
  convocatoria: string
  modalidad: string
  articulacion: string
  centro_costos: string
  /** Fecha de inicio y duración vienen del acta de inicio legalizada (M-01). */
  fecha_inicio: string
  duracion_meses: number
  /** Meses sumados por prórrogas aprobadas (M-05). */
  prorroga_meses: number
  participantes: string[]
  vigencias: Vigencia[]
  metas: MetaCronograma[]
  periodos: PeriodoInforme[]
  novedades: Novedad[]
  productos: ProductoComprometido[]
  informe_final: InformeFinal
  cierre: CierreProyecto
}
