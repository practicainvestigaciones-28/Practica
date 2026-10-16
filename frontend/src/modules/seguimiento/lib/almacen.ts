import type {
  ConceptoRubro,
  EquipoInvestigador,
  FirmaSeguimiento,
  ProyectoSeguimiento,
  RolFirmante,
  TipoArticulacion,
  MetaCronograma,
  TipoNovedad,
} from '../api/tipos'
import { detalleVacio, generarPeriodos } from './reglas'
import { CATEGORIAS_RESULTADOS } from './resultados'

// Almacenamiento local provisional de la etapa de seguimiento (M-02 a M-08).
// El backend aún no expone /api/seguimiento, así que lo que se registre se
// guarda solo en el navegador de quien lo diligencia: no es compartido ni
// definitivo. La capa api/ es la única que lee este almacén, así que conectar
// el backend solo implica cambiar esa capa.

// v5: sin datos de ejemplo. Las claves anteriores se borran al cargar.
const STORAGE_KEY = 'sgpvie_seguimiento_v5'
const CLAVES_ANTERIORES = ['sgpvie_seguimiento_v1', 'sgpvie_seguimiento_v2', 'sgpvie_seguimiento_v3', 'sgpvie_seguimiento_v4']

export interface EstadoAlmacen {
  conceptos: ConceptoRubro[]
  tipos_novedad: TipoNovedad[]
  tipos_articulacion: TipoArticulacion[]
  proyectos: ProyectoSeguimiento[]
}

const firmas = (...roles: RolFirmante[]): FirmaSeguimiento[] => roles.map((rol) => ({ rol, firmado: false, fecha: null }))

// Los resultados proyectados salen de la formulación del proyecto; mientras no
// estén disponibles, todos los conceptos del formato INV-IC-FR-019 quedan en cero.
const PRODUCTOS_BASE = CATEGORIAS_RESULTADOS.flatMap((c) =>
  c.conceptos.map((nombre) => ({ categoria: c.nombre, nombre, proyectado: 0 }))
)

export type BaseProyecto = Pick<
  ProyectoSeguimiento,
  | 'id_proyecto'
  | 'titulo'
  | 'investigador_principal'
  | 'grupo'
  | 'modalidad'
  | 'articulacion'
  | 'centro_costos'
  | 'fecha_inicio'
  | 'duracion_meses'
  | 'vigencias'
  | 'convocatoria'
  | 'participantes'
> & {
  objetivo_general: string
  objetivos_especificos: string[]
  programa_academico?: string
  equipo?: Partial<EquipoInvestigador>
  /** Cronograma de la formulación: objetivo específico, meta, actividad y responsable. */
  metas?: MetaCronograma[]
}

function crearProyecto(base: BaseProyecto): ProyectoSeguimiento {
  const { objetivo_general, objetivos_especificos, programa_academico, equipo, metas, ...resto } = base
  const programa = programa_academico ?? ''
  const equipoFinal: EquipoInvestigador = {
    co_investigadores_internos: [],
    co_investigadores_externos: [],
    auxiliares: [],
    asistentes: [],
    ...equipo,
  }
  const persona = (nombre: string, interna: boolean) => ({ nombre, grupo: interna ? base.grupo : '', programa: interna ? programa : '', correo: '', telefono: '' })
  const p: ProyectoSeguimiento = {
    ...resto,
    programa_academico: programa,
    equipo: equipoFinal,
    prorroga_meses: 0,
    solicitudes: [],
    // Las actividades del cronograma vienen de la formulación del proyecto.
    metas: metas ?? [],
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
        ...objetivos_especificos.map((descripcion, i) => ({ titulo: `OE ${i + 1}`, descripcion, cumplimiento: '', cumplido: false })),
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

/** Estado inicial: sin proyectos. Los conceptos de rubro son los del numeral 6 del
 * formato INV-IC-FR-017 (antelación mínima con que se debe presentar cada solicitud);
 * los tipos de novedad y de articulación los define el Administrador en Parámetros. */
function estadoInicial(): EstadoAlmacen {
  return {
    conceptos: [
      { id: 1, nombre: 'Compra y suministro de elementos', antelacion_valor: 8, antelacion_unidad: 'días', descripcion: '', activo: true },
      { id: 2, nombre: 'Salidas de campo', antelacion_valor: 8, antelacion_unidad: 'días', descripcion: '', activo: true },
      { id: 3, nombre: 'Participación en eventos a nivel nacional e internacional', antelacion_valor: 2, antelacion_unidad: 'meses', descripcion: '', activo: true },
      { id: 4, nombre: 'Solicitud de contratación de servicios por honorarios', antelacion_valor: 1, antelacion_unidad: 'meses', descripcion: '', activo: true },
    ],
    tipos_novedad: [],
    tipos_articulacion: [],
    proyectos: [],
  }
}

function cargar(): EstadoAlmacen {
  try {
    // Datos de ejemplo de versiones anteriores: se descartan para que no se mezclen con lo real.
    CLAVES_ANTERIORES.forEach((k) => localStorage.removeItem(k))
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as EstadoAlmacen
  } catch {
    // Datos corruptos o storage bloqueado: se arranca vacío.
  }
  return estadoInicial()
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

/** Un proyecto que ya está en seguimiento sin cronograma lo recibe de la formulación: las actividades
 * quedan en los periodos que aún no tienen trabajo y en los ya abiertos sin detalle. */
export function completarMetas(id_proyecto: number, metas: MetaCronograma[]): void {
  const p = estado.proyectos.find((x) => x.id_proyecto === id_proyecto)
  if (!p || p.metas.length > 0 || metas.length === 0) return
  p.metas = metas
  p.periodos = generarPeriodos(p)
  for (const pe of p.periodos) if (pe.detalle.length === 0) pe.detalle = metas.map(() => detalleVacio())
  persistir()
}

/** Un acta de inicio legalizada (M-01) deja el proyecto en ejecución: entra a
 * seguimiento con sus vigencias y sus periodos de informe ya programados. */
export function agregarProyectoLegalizado(base: BaseProyecto): void {
  const existente = estado.proyectos.find((p) => p.id_proyecto === base.id_proyecto)
  if (existente) {
    // Si el acta se hizo de nuevo y el proyecto aún no tiene trabajo registrado, se rehace con los datos
    // vigentes (fecha de inicio, vigencias...). Con trabajo ya diligenciado no se toca.
    const sinTrabajo =
      existente.periodos.every((pe) => pe.estado === 'Programado') &&
      existente.solicitudes.length === 0 &&
      existente.novedades.length === 0 &&
      existente.informe_final.estado === 'Borrador' &&
      !existente.cierre.finalizado
    if (!sinTrabajo) return
    estado = { ...estado, proyectos: estado.proyectos.map((p) => (p.id_proyecto === base.id_proyecto ? crearProyecto(base) : p)) }
    persistir()
    return
  }
  estado = { ...estado, proyectos: [...estado.proyectos, crearProyecto(base)] }
  persistir()
}
