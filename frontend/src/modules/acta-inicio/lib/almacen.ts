import type { ActaInicioDetalle, ParticipanteActa } from '../api/actaInicio'

// Modo prueba: mientras el backend no exponga /api/acta-inicio, las actas
// viven en localStorage (igual que el módulo de seguimiento). Solo api/ lee
// este almacén, así que conectar el backend no toca las pantallas.

// v2: dos proyectos sin iniciar y opción de reiniciar o reabrir.
const STORAGE_KEY = 'sgpvie_acta_inicio_v2'

/** Lo que guarda el almacén por proyecto: el detalle del acta más los datos del listado. */
export interface ActaGuardada extends ActaInicioDetalle {
  estado_proyecto: string
}

const participante = (
  id: number,
  nombre: string,
  rol: string,
  contacto: Partial<Pick<ParticipanteActa, 'identificacion' | 'telefono' | 'correo' | 'programa_academico' | 'institucion'>> = {}
): ParticipanteActa => ({
  id_usuarioproyecto: id,
  id_usuario: id,
  nombre,
  rol,
  identificacion: null,
  telefono: null,
  correo: null,
  programa_academico: null,
  institucion: null,
  ...contacto,
})

const UNICESMAG = 'Universidad CESMAG'

function semilla(): ActaGuardada[] {
  const base = {
    convocatoria: 'Convocatoria 2026 – 1',
    compromisos: [],
    firmas: [],
    tiene_archivo_generado: false,
    tiene_archivo_firmado: false,
    archivo_firmado_nombre: null,
    fecha_legalizacion: null,
  }

  // Sin iniciar: el Administrador aún no registra los datos de legalización.
  const sinIniciar: ActaGuardada = {
    ...base,
    id_acta_inicio: null,
    id_proyecto: 105,
    titulo: 'Modelo de Analítica para la Permanencia Estudiantil',
    estado_proyecto: 'Aprobado',
    estado: 'en elaboracion',
    objetivo_general: 'Diseñar un modelo de analítica de datos que permita anticipar el riesgo de deserción estudiantil en la Universidad CESMAG.',
    objetivos_especificos: [
      'Caracterizar las variables académicas y socioeconómicas asociadas a la deserción.',
      'Construir y validar un modelo predictivo de riesgo de deserción.',
      'Proponer una estrategia institucional de alertas tempranas basada en el modelo.',
    ],
    grupos: [{ grupo: 'DIDS', entidad: UNICESMAG }],
    tipo_proyecto: null,
    numero_acta_aprobacion: null,
    fecha_acta_aprobacion: null,
    centro_costos: null,
    fecha_inicio: null,
    duracion_meses: null,
    fecha_fin_estimada: null,
    valor_solicitado_unicesmag: 38500000,
    vigencias: [],
    participantes: [
      participante(501, 'Laura Benavides Ortiz', 'Investigador principal', { correo: 'lbenavides@unicesmag.edu.co', programa_academico: 'Ingeniería de Sistemas', institucion: UNICESMAG }),
      participante(502, 'Andrés Guerrero Rosero', 'Co-investigador', { correo: 'aguerrero@unicesmag.edu.co' }),
    ],
  }

  // En firma: acta generada, pendiente de aceptación de compromisos y firmas.
  const enFirma: ActaGuardada = {
    ...base,
    id_acta_inicio: 2,
    id_proyecto: 106,
    titulo: 'Estrategias Pedagógicas Mediadas por Realidad Aumentada',
    estado_proyecto: 'Aprobado',
    estado: 'en firma',
    objetivo_general: 'Evaluar el efecto de estrategias pedagógicas mediadas por realidad aumentada en el aprendizaje de las ciencias básicas.',
    objetivos_especificos: [
      'Identificar las dificultades de aprendizaje en los cursos de ciencias básicas.',
      'Diseñar recursos de realidad aumentada alineados con los resultados de aprendizaje.',
      'Medir el efecto de los recursos en el desempeño académico de los estudiantes.',
    ],
    grupos: [
      { grupo: 'TECNO', entidad: UNICESMAG },
      { grupo: 'GISAE', entidad: UNICESMAG },
    ],
    tipo_proyecto: 'Innovación Educativa',
    numero_acta_aprobacion: '014',
    fecha_acta_aprobacion: '2026-09-18',
    centro_costos: '221415010',
    fecha_inicio: '2026-10-19',
    duracion_meses: 12,
    fecha_fin_estimada: '2027-10-18',
    valor_solicitado_unicesmag: 21400000,
    vigencias: [
      { anio: 2026, valor_asignado: 6400000 },
      { anio: 2027, valor_asignado: 15000000 },
    ],
    participantes: [
      participante(511, 'Camila Erazo Paz', 'Investigador principal', { identificacion: '1085334120', telefono: '3104567890', correo: 'cerazo@unicesmag.edu.co', programa_academico: 'Licenciatura en Matemáticas', institucion: UNICESMAG }),
      participante(512, 'Julián Mora Delgado', 'Co-investigador', { identificacion: '98393455', telefono: '3157894561', correo: 'jmora@unicesmag.edu.co', programa_academico: 'Ingeniería Electrónica', institucion: UNICESMAG }),
    ],
    firmas: [
      { id_firma: 1, id_usuario: 511, nombre: 'Camila Erazo Paz', rol_firmante: 'investigador principal', orden_firma: 1, firmado: false, fecha_firma: null },
      { id_firma: 2, id_usuario: 512, nombre: 'Julián Mora Delgado', rol_firmante: 'co-investigador', orden_firma: 2, firmado: false, fecha_firma: null },
      { id_firma: 3, id_usuario: 0, nombre: 'Vicerrector de Investigación y Extensión', rol_firmante: 'Vicerrector', orden_firma: 3, firmado: false, fecha_firma: null },
    ],
    tiene_archivo_generado: true,
  }

  // Legalizada: es el proyecto 101 que ya aparece en Seguimiento.
  const clausulas = ['compromisos', 'derechos de autor', 'confidencialidad', 'tratamiento de datos'] as const
  const legalizada: ActaGuardada = {
    ...base,
    id_acta_inicio: 1,
    id_proyecto: 101,
    titulo: 'Sistema Integral de Gestión Académica',
    estado_proyecto: 'En ejecución',
    estado: 'legalizada',
    objetivo_general: 'Desarrollar un sistema integral de gestión académica para la Universidad CESMAG.',
    objetivos_especificos: ['Caracterizar los estándares aplicables.', 'Diseñar el instrumento de recolección.', 'Validar el modelo propuesto.'],
    grupos: [{ grupo: 'DIDS', entidad: UNICESMAG }],
    tipo_proyecto: 'Investigación Científica',
    numero_acta_aprobacion: '003',
    fecha_acta_aprobacion: '2026-01-20',
    centro_costos: '221414650',
    fecha_inicio: '2026-02-02',
    duracion_meses: 24,
    fecha_fin_estimada: '2028-02-01',
    valor_solicitado_unicesmag: 43335964,
    vigencias: [
      { anio: 2026, valor_asignado: 24000000 },
      { anio: 2027, valor_asignado: 19335964 },
    ],
    participantes: [
      participante(521, 'Daniela Camacho', 'Investigador principal', { identificacion: '1085298744', telefono: '3001234567', correo: 'dcamacho@unicesmag.edu.co', programa_academico: 'Ingeniería de Sistemas', institucion: UNICESMAG }),
      participante(522, 'Investigador 2', 'Co-investigador', { identificacion: '12998431', telefono: '3019876543', correo: 'investigador2@unicesmag.edu.co', programa_academico: 'Ingeniería de Sistemas', institucion: UNICESMAG }),
    ],
    compromisos: [521, 522].flatMap((id) =>
      clausulas.map((tipo_clausula) => ({ id_usuarioproyecto: id, tipo_clausula, version_texto: 'INV-IC-FR-017 v5', aceptado: true, fecha_aceptacion: '2026-01-28T15:00:00.000Z' }))
    ),
    firmas: [
      { id_firma: 4, id_usuario: 521, nombre: 'Daniela Camacho', rol_firmante: 'investigador principal', orden_firma: 1, firmado: true, fecha_firma: '2026-01-28T15:10:00.000Z' },
      { id_firma: 5, id_usuario: 522, nombre: 'Investigador 2', rol_firmante: 'co-investigador', orden_firma: 2, firmado: true, fecha_firma: '2026-01-29T14:30:00.000Z' },
      { id_firma: 6, id_usuario: 0, nombre: 'Vicerrector de Investigación y Extensión', rol_firmante: 'Vicerrector', orden_firma: 3, firmado: true, fecha_firma: '2026-01-30T16:00:00.000Z' },
    ],
    tiene_archivo_generado: true,
    tiene_archivo_firmado: true,
    archivo_firmado_nombre: 'acta-inicio-firmada-101.pdf',
    fecha_legalizacion: '2026-01-30T16:20:00.000Z',
  }

  // Otro proyecto aprobado sin acta, para poder repetir el flujo completo.
  const sinIniciar2: ActaGuardada = {
    ...base,
    id_acta_inicio: null,
    id_proyecto: 107,
    titulo: 'Gestión Sostenible del Recurso Hídrico en Comunidades Rurales',
    estado_proyecto: 'Aprobado',
    estado: 'en elaboracion',
    objetivo_general: 'Formular un modelo de gestión sostenible del recurso hídrico para comunidades rurales del departamento de Nariño.',
    objetivos_especificos: [
      'Diagnosticar el estado actual del recurso hídrico en las comunidades participantes.',
      'Diseñar con las comunidades un modelo de gestión del recurso.',
      'Evaluar la viabilidad técnica y social del modelo propuesto.',
    ],
    grupos: [
      { grupo: 'SINDAMANOY', entidad: UNICESMAG },
      { grupo: 'Grupo de Estudios Ambientales', entidad: 'Universidad de Nariño' },
    ],
    tipo_proyecto: null,
    numero_acta_aprobacion: null,
    fecha_acta_aprobacion: null,
    centro_costos: null,
    fecha_inicio: null,
    duracion_meses: null,
    fecha_fin_estimada: null,
    valor_solicitado_unicesmag: 27800000,
    vigencias: [],
    participantes: [
      participante(531, 'Marcela Insuasty Lasso', 'Investigador principal', { correo: 'minsuasty@unicesmag.edu.co', programa_academico: 'Ingeniería Ambiental', institucion: UNICESMAG }),
      participante(532, 'Óscar Burbano Chaves', 'Co-investigador', { correo: 'oburbano@udenar.edu.co', institucion: 'Universidad de Nariño' }),
    ],
  }

  return [sinIniciar, sinIniciar2, enFirma, legalizada]
}

function cargar(): ActaGuardada[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ActaGuardada[]
  } catch {
    // Datos corruptos o storage bloqueado: se arranca con la semilla.
  }
  return semilla()
}

let actas: ActaGuardada[] = cargar()

export function leerActas(): ActaGuardada[] {
  return structuredClone(actas)
}

/** Aplica un cambio sobre una copia y la guarda solo si el cambio no lanzó error. */
export function modificarActas(cambio: (lista: ActaGuardada[]) => void): ActaGuardada[] {
  const copia = structuredClone(actas)
  cambio(copia)
  actas = copia
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actas))
  } catch {
    // Sin localStorage los cambios duran solo mientras la pestaña esté abierta.
  }
  return structuredClone(actas)
}

/** Solo modo prueba: vuelve a las actas de ejemplo. */
export function reiniciarActas(): void {
  actas = semilla()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actas))
  } catch {
    // Sin localStorage el reinicio dura solo mientras la pestaña esté abierta.
  }
}
