import type {
  ConceptoRubro,
  EquipoInvestigador,
  FirmaSeguimiento,
  ProyectoSeguimiento,
  RolFirmante,
  TipoArticulacion,
  TipoNovedad,
} from '../api/tipos'
import { SEMANAS_POR_PERIODO, generarPeriodos } from './reglas'
import { CATEGORIAS_RESULTADOS } from './resultados'

// Modo prueba: mientras no existan las rutas /api/seguimiento en el backend,
// los datos de M-02 a M-08 viven en localStorage (mismo enfoque que los
// catálogos de convocatorias). La capa api/ es la única que lee este almacén,
// así que conectar el backend solo implica cambiar esa capa.

// v4: informes y acta de cierre según los formatos INV-IC-FR-018, 019 y 021.
const STORAGE_KEY = 'sgpvie_seguimiento_v4'

export interface EstadoAlmacen {
  conceptos: ConceptoRubro[]
  tipos_novedad: TipoNovedad[]
  tipos_articulacion: TipoArticulacion[]
  proyectos: ProyectoSeguimiento[]
}

const firmas = (...roles: RolFirmante[]): FirmaSeguimiento[] => roles.map((rol) => ({ rol, firmado: false, fecha: null }))

// Lo que el proyecto de ejemplo comprometió en la formulación; el resto de
// conceptos del formato INV-IC-FR-019 quedan en cero.
const PROYECTADO: Record<string, number> = {
  'Artículos de investigación': 2,
  'Productos tecnológicos patentados o en proceso de concesión de la patente': 1,
  'Obras o productos de investigación': 1,
  'Dirección trabajo de grado de maestría': 1,
  'Dirección trabajo de grado pregrado': 2,
  'Circulación de conocimiento especializado': 1,
}

const PRODUCTOS_BASE = CATEGORIAS_RESULTADOS.flatMap((c) =>
  c.conceptos.map((nombre) => ({ categoria: c.nombre, nombre, proyectado: PROYECTADO[nombre] ?? 0 }))
)

const METAS_BASE = [
  { objetivo: 'OE 1. Caracterizar los estándares aplicables', meta: 'Un documento de caracterización', actividad: 'Revisión documental', responsable: 'Investigador 1' },
  { objetivo: 'OE 1. Caracterizar los estándares aplicables', meta: 'Un documento de caracterización', actividad: 'Sistematización de fuentes', responsable: 'Auxiliar 1' },
  { objetivo: 'OE 2. Diseñar el instrumento de recolección', meta: 'Instrumento validado por pares', actividad: 'Diseño y pilotaje', responsable: 'Investigador 2' },
  { objetivo: 'OE 3. Validar el modelo propuesto', meta: 'Informe de validación', actividad: 'Aplicación y análisis', responsable: 'Investigador 1' },
]

export type BaseProyecto = Pick<
  ProyectoSeguimiento,
  'id_proyecto' | 'titulo' | 'investigador_principal' | 'grupo' | 'modalidad' | 'articulacion' | 'centro_costos' | 'fecha_inicio' | 'duracion_meses' | 'vigencias'
> & { objetivo_general: string; programa_academico?: string; equipo?: Partial<EquipoInvestigador> }

function crearProyecto(base: BaseProyecto): ProyectoSeguimiento {
  const { objetivo_general, programa_academico, equipo, ...resto } = base
  const programa = programa_academico ?? 'Ingeniería de Sistemas'
  const equipoFinal: EquipoInvestigador = {
    co_investigadores_internos: ['Investigador 2'],
    co_investigadores_externos: [],
    auxiliares: ['Estudiante 1'],
    asistentes: [],
    ...equipo,
  }
  const persona = (nombre: string, interna: boolean) => ({ nombre, grupo: interna ? base.grupo : '', programa: interna ? programa : '', correo: '', telefono: '' })
  const p: ProyectoSeguimiento = {
    ...resto,
    convocatoria: 'Convocatoria 2026 – 1',
    programa_academico: programa,
    equipo: equipoFinal,
    prorroga_meses: 0,
    participantes: [`Investigador principal · ${base.investigador_principal}`, 'Co-investigador · Investigador 2', 'Auxiliar · Estudiante 1'],
    solicitudes: [],
    metas: METAS_BASE.map((m) => ({ ...m })),
    periodos: [],
    novedades: [],
    productos: PRODUCTOS_BASE.map((x) => ({ ...x, obtenido: null, soportes: [], observacion: '' })),
    informe_final: {
      info: {
        area_conocimiento: '',
        investigador_principal: persona(base.investigador_principal, true),
        co_investigador_interno: persona(equipoFinal.co_investigadores_internos[0] ?? '', true),
        co_investigador_externo: persona(equipoFinal.co_investigadores_externos[0] ?? '', false),
        apoyos: [
          ...equipoFinal.auxiliares.map((nombre) => ({ nombre, tipo: 'Auxiliar' as const, codigo_estudiantil: '', correo: '' })),
          ...equipoFinal.asistentes.map((nombre) => ({ nombre, tipo: 'Asistente' as const, codigo_estudiantil: '', correo: '' })),
        ],
        ciudad: 'San Juan de Pasto',
        departamento: 'Nariño',
        financiacion_externa: 0,
      },
      resumen: '',
      objetivos: [
        { titulo: 'Objetivo general', descripcion: objetivo_general, cumplimiento: '', cumplido: false },
        { titulo: 'OE 1', descripcion: 'Caracterizar los estándares aplicables.', cumplimiento: '', cumplido: false },
        { titulo: 'OE 2', descripcion: 'Diseñar el instrumento de recolección.', cumplimiento: '', cumplido: false },
        { titulo: 'OE 3', descripcion: 'Validar el modelo propuesto.', cumplimiento: '', cumplido: false },
      ],
      observaciones_objetivos: '',
      equipos: [],
      materiales: [],
      actividades_apoyos: '',
      evidencias_apoyos: '',
      estado: 'Borrador',
      observacion_devolucion: '',
      fecha_entrega: null,
      firmas: firmas('Investigador principal', 'Co-investigadores', 'Líder del grupo'),
    },
    cierre: {
      linea_investigacion_principal: '',
      linea_investigacion_co: '',
      programas_estudiantes: [],
      libros: 0,
      libros_soporte: '',
      libros_observacion: '',
      capitulos: 0,
      capitulos_soporte: '',
      capitulos_observacion: '',
      paz_y_salvo: false,
      fecha_fin_real: '',
      ciudad: 'San Juan de Pasto',
      fecha_acta: '',
      firmas: firmas('Investigador principal', 'Co-investigadores', 'Líder del grupo', 'Vicerrector'),
      finalizado: false,
    },
  }
  p.periodos = generarPeriodos(p)
  return p
}

/** Marca las primeras semanas del cronograma en proporción al avance. */
const semanasHasta = (porcentaje: number) =>
  Array.from({ length: SEMANAS_POR_PERIODO }, (_, i) => i < Math.round((porcentaje / 100) * SEMANAS_POR_PERIODO))

function aprobarPeriodo(p: ProyectoSeguimiento, i: number, porcentaje: number, fecha: string) {
  const pe = p.periodos[i]
  pe.estado = 'Aprobado'
  pe.fecha_radicacion = fecha
  pe.firmas = pe.firmas.map((f) => ({ ...f, firmado: true, fecha }))
  pe.detalle = pe.detalle.map(() => ({
    semanas: semanasHasta(porcentaje),
    estado: porcentaje === 100 ? 'Cumplida' : 'En ejecución',
    porcentaje,
    observacion: 'Actividad desarrollada según cronograma.',
    evidencias: ['evidencia_periodo.pdf'],
  }))
}

function semilla(): EstadoAlmacen {
  const principal = crearProyecto({
    id_proyecto: 101,
    titulo: 'Sistema Integral de Gestión Académica',
    investigador_principal: 'Daniela Camacho',
    grupo: 'DIDS',
    modalidad: 'Investigación científica',
    articulacion: 'Interinstitucional',
    centro_costos: '221414650',
    fecha_inicio: '2026-02-02',
    duracion_meses: 24,
    vigencias: [
      { anio: 2026, asignado: 24000000, ejecutado: 0 },
      { anio: 2027, asignado: 19335964, ejecutado: 0 },
    ],
    objetivo_general: 'Desarrollar un sistema integral de gestión académica para la Universidad CESMAG.',
  })

  const observatorio = crearProyecto({
    id_proyecto: 102,
    titulo: 'Observatorio de Innovación Regional',
    investigador_principal: 'Investigador 3',
    grupo: 'GISAE',
    modalidad: 'Innovación',
    articulacion: 'Intrainstitucional',
    centro_costos: '221414731',
    fecha_inicio: '2025-08-01',
    duracion_meses: 18,
    vigencias: [
      { anio: 2025, asignado: 10000000, ejecutado: 6200000 },
      { anio: 2026, asignado: 18400000, ejecutado: 3000000 },
    ],
    objetivo_general: 'Consolidar un observatorio de innovación para la región.',
  })
  aprobarPeriodo(observatorio, 0, 40, '2026-01-30')
  observatorio.periodos[1].estado = 'Radicado'
  observatorio.periodos[1].fecha_radicacion = '2026-07-30'
  observatorio.periodos[1].firmas = observatorio.periodos[1].firmas.map((f) => ({ ...f, firmado: true, fecha: '2026-07-30' }))
  observatorio.periodos[1].detalle = observatorio.periodos[1].detalle.map(() => ({
    semanas: semanasHasta(75),
    estado: 'En ejecución',
    porcentaje: 75,
    observacion: 'Avance conforme al plan.',
    evidencias: ['actas_reunion.pdf'],
  }))
  observatorio.solicitudes.push({
    id: 1,
    id_concepto: 2,
    concepto: 'Salidas de campo',
    valor: 1800000,
    fecha_requerida: '2026-11-20',
    anio: 2026,
    descripcion: 'Desplazamiento a municipios de la región para levantamiento de información.',
    fecha_solicitud: '2026-09-28',
    estado: 'Pendiente',
    observacion: '',
  })

  const red = crearProyecto({
    id_proyecto: 103,
    titulo: 'Red de Conocimiento Universitario',
    investigador_principal: 'Investigador 4',
    grupo: 'TECNO',
    modalidad: 'Desarrollo tecnológico',
    articulacion: 'Interinstitucional',
    centro_costos: '221414845',
    fecha_inicio: '2025-03-03',
    duracion_meses: 12,
    vigencias: [{ anio: 2025, asignado: 16900000, ejecutado: 15700000 }],
    objetivo_general: 'Articular una red de conocimiento entre universidades de la región.',
  })
  aprobarPeriodo(red, 0, 50, '2025-09-01')
  aprobarPeriodo(red, 1, 100, '2026-03-02')
  red.productos = red.productos.map((x) =>
    x.proyectado > 0
      ? { ...x, obtenido: x.proyectado, soportes: Array.from({ length: x.proyectado }, (_, i) => `https://repositorio.unicesmag.edu.co/handle/${123 + i}`) }
      : x
  )
  red.informe_final = {
    ...red.informe_final,
    info: {
      ...red.informe_final.info,
      area_conocimiento: 'Ingeniería y Tecnología',
      investigador_principal: { ...red.informe_final.info.investigador_principal, correo: 'investigador4@unicesmag.edu.co', telefono: '3004567890' },
      co_investigador_interno: { ...red.informe_final.info.co_investigador_interno, correo: 'investigador2@unicesmag.edu.co', telefono: '3019876543' },
      apoyos: red.informe_final.info.apoyos.map((a) => ({ ...a, codigo_estudiantil: '20211045', correo: 'estudiante1@unicesmag.edu.co' })),
    },
    actividades_apoyos: 'Apoyo en la recolección de información y en la documentación del repositorio compartido.',
    evidencias_apoyos: 'Actas de reunión y bitácora de actividades en el drive del grupo.',
    fecha_entrega: '2026-03-20',
    resumen: 'Se conformó la red con cuatro universidades y se publicó el repositorio compartido.',
    objetivos: red.informe_final.objetivos.map((o) => ({ ...o, cumplimiento: 'Cumplido según lo planteado en la propuesta.', cumplido: true })),
    estado: 'Radicado',
    firmas: red.informe_final.firmas.map((f) => ({ ...f, firmado: true, fecha: '2026-03-20' })),
  }

  const plataforma = crearProyecto({
    id_proyecto: 104,
    titulo: 'Plataforma de Seguimiento a Proyectos',
    investigador_principal: 'Investigador 2',
    grupo: 'SINDAMANOY',
    modalidad: 'Investigación científica',
    articulacion: 'Intrainstitucional',
    centro_costos: '221414902',
    fecha_inicio: '2025-06-02',
    duracion_meses: 24,
    vigencias: [
      { anio: 2025, asignado: 15600000, ejecutado: 4100000 },
      { anio: 2026, asignado: 15600000, ejecutado: 0 },
    ],
    objetivo_general: 'Construir una plataforma de seguimiento a proyectos institucionales.',
  })
  plataforma.novedades.push({
    id: 1,
    id_tipo: 5,
    tipo: 'Cancelación',
    fecha: '2026-04-15',
    justificacion: 'Retiro del investigador principal sin reemplazo disponible.',
    soporte: 'solicitud_cancelacion.pdf',
    estado: 'Aprobada',
    observacion: 'Aprobada por la Vicerrectoría.',
    meses_prorroga: 0,
    participante_saliente: '',
    participante_entrante: '',
    acto_administrativo: 'Resolución 045 de 2026',
  })

  return {
    conceptos: [
      { id: 1, nombre: 'Compra y suministro de elementos', antelacion_valor: 8, antelacion_unidad: 'días', descripcion: 'Materiales e insumos del proyecto', activo: true },
      { id: 2, nombre: 'Salidas de campo', antelacion_valor: 8, antelacion_unidad: 'días', descripcion: 'Desplazamientos para recolección de información', activo: true },
      { id: 3, nombre: 'Participación en eventos', antelacion_valor: 2, antelacion_unidad: 'meses', descripcion: 'Inscripción, tiquetes y viáticos', activo: true },
      { id: 4, nombre: 'Contratación por honorarios', antelacion_valor: 1, antelacion_unidad: 'meses', descripcion: 'Servicios profesionales externos', activo: true },
    ],
    tipos_novedad: [
      { id: 1, nombre: 'Prórroga', descripcion: 'Ampliación del plazo de ejecución', afecta_fechas: true, afecta_participantes: false, afecta_productos: false, activo: true },
      { id: 2, nombre: 'Suspensión', descripcion: 'Interrupción temporal del proyecto', afecta_fechas: true, afecta_participantes: false, afecta_productos: false, activo: true },
      { id: 3, nombre: 'Cambio de investigador', descripcion: 'Retiro o reemplazo de un participante', afecta_fechas: false, afecta_participantes: true, afecta_productos: false, activo: true },
      { id: 4, nombre: 'Ajuste de productos', descripcion: 'Modificación de los productos comprometidos', afecta_fechas: false, afecta_participantes: false, afecta_productos: true, activo: true },
      { id: 5, nombre: 'Cancelación', descripcion: 'Terminación anticipada sin cumplimiento', afecta_fechas: true, afecta_participantes: true, afecta_productos: true, activo: true },
    ],
    tipos_articulacion: [
      { id: 1, nombre: 'Intrainstitucional', descripcion: 'Entre programas o grupos de la Universidad CESMAG', activo: true },
      { id: 2, nombre: 'Interinstitucional', descripcion: 'Con otras instituciones de educación superior', activo: true },
      { id: 3, nombre: 'Sector externo', descripcion: 'Con empresas o entidades del sector productivo', activo: true },
    ],
    proyectos: [principal, observatorio, red, plataforma],
  }
}

/** Adapta datos guardados con un formato anterior, para no perder lo ya registrado:
 * cada producto tenía un único enlace de soporte y ahora lleva uno por resultado. */
function actualizarFormato(s: EstadoAlmacen): EstadoAlmacen {
  for (const p of s.proyectos) {
    p.productos = p.productos.map((x) => {
      const { soporte, ...resto } = x as typeof x & { soporte?: string }
      return { ...resto, soportes: x.soportes ?? (soporte ? [soporte] : []) }
    })
  }
  return s
}

function cargar(): EstadoAlmacen {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return actualizarFormato(JSON.parse(raw) as EstadoAlmacen)
  } catch {
    // Datos corruptos o storage bloqueado: se arranca con la semilla.
  }
  return semilla()
}

let estado: EstadoAlmacen = cargar()

function persistir(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
  } catch {
    // Sin localStorage los cambios duran solo mientras la pestaña esté abierta.
  }
}

/** Copia del estado actual: quien la reciba puede modificarla sin afectar el almacén. */
export function leerAlmacen(): EstadoAlmacen {
  return structuredClone(estado)
}

/** Aplica un cambio sobre una copia y la guarda solo si el cambio no lanzó error. */
export function modificarAlmacen(cambio: (s: EstadoAlmacen) => void): EstadoAlmacen {
  const copia = structuredClone(estado)
  cambio(copia)
  estado = copia
  persistir()
  return structuredClone(estado)
}

export function reiniciarAlmacen(): void {
  estado = semilla()
  persistir()
}

/** Un acta de inicio legalizada (M-01) deja el proyecto en ejecución: entra a
 * seguimiento con sus vigencias y sus periodos de informe ya programados. */
export function agregarProyectoLegalizado(base: BaseProyecto & { convocatoria: string; participantes: string[] }): void {
  if (estado.proyectos.some((p) => p.id_proyecto === base.id_proyecto)) return
  const { convocatoria, participantes, ...resto } = base
  estado = { ...estado, proyectos: [...estado.proyectos, { ...crearProyecto(resto), convocatoria, participantes }] }
  persistir()
}
