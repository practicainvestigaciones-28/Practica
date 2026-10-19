import type {
  ApoyoInforme,
  EquipoInvestigador,
  Evidencia,
  FirmaSeguimiento,
  PersonaInforme,
  ProyectoSeguimiento,
  RolFirmante,
  TipoArticulacion,
  MetaCronograma,
  TipoNovedad,
} from '../api/tipos'
import { anteriorAprobado, detalleDesde, generarPeriodos, periodoSolicitado } from './reglas'
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
  tipos_novedad: TipoNovedad[]
  tipos_articulacion: TipoArticulacion[]
  /** Los tipos de novedad y de articulación base ya se cargaron una vez (después el Administrador los gestiona). */
  catalogos_base?: boolean
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
      fecha_solicitud: null,
      fecha_habilitacion: null,
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

/** Tipos que traen los catálogos la primera vez; después los gestiona el Administrador en Parámetros. */
const TIPOS_NOVEDAD_BASE: TipoNovedad[] = [
  { id: 1, nombre: 'Prórroga', descripcion: 'Ampliación del plazo de ejecución', afecta_fechas: true, afecta_participantes: false, afecta_productos: false, activo: true },
  { id: 2, nombre: 'Suspensión', descripcion: 'Interrupción temporal del proyecto', afecta_fechas: true, afecta_participantes: false, afecta_productos: false, activo: true },
  { id: 3, nombre: 'Cambio de investigador', descripcion: 'Retiro o reemplazo de un participante', afecta_fechas: false, afecta_participantes: true, afecta_productos: false, activo: true },
  { id: 4, nombre: 'Ajuste de productos', descripcion: 'Modificación de los productos comprometidos', afecta_fechas: false, afecta_participantes: false, afecta_productos: true, activo: true },
  { id: 5, nombre: 'Cancelación', descripcion: 'Terminación anticipada sin cumplimiento', afecta_fechas: true, afecta_participantes: true, afecta_productos: true, activo: true },
]
const TIPOS_ARTICULACION_BASE: TipoArticulacion[] = [
  { id: 1, nombre: 'Intrainstitucional', descripcion: 'Entre programas o grupos de la Universidad CESMAG', activo: true },
  { id: 2, nombre: 'Interinstitucional', descripcion: 'Con otras instituciones de educación superior', activo: true },
  { id: 3, nombre: 'Sector externo', descripcion: 'Con empresas o entidades del sector productivo', activo: true },
]

/** Estado inicial: sin proyectos. Los tipos de novedad y de articulación arrancan con los tipos base y los gestiona
 * el Administrador en Parámetros. */
function estadoInicial(): EstadoAlmacen {
  return {
    tipos_novedad: structuredClone(TIPOS_NOVEDAD_BASE),
    tipos_articulacion: structuredClone(TIPOS_ARTICULACION_BASE),
    catalogos_base: true,
    proyectos: [],
  }
}

function cargar(): EstadoAlmacen {
  try {
    // Datos de ejemplo de versiones anteriores: se descartan para que no se mezclen con lo real.
    CLAVES_ANTERIORES.forEach((k) => localStorage.removeItem(k))
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const guardado = JSON.parse(raw) as EstadoAlmacen
      // Evidencias guardadas antes como solo el nombre del archivo: quedan como archivo sin contenido.
      for (const p of guardado.proyectos ?? []) {
        // Soportes de resultados guardados antes como enlaces de texto: pasan a ser soportes de tipo enlace.
        for (const x of p.productos) {
          x.soportes = (x.soportes as unknown[])
            .map((sop) => (typeof sop === 'string' ? (sop.trim() ? { tipo: 'enlace' as const, url: sop.trim() } : null) : (sop as Evidencia)))
            .filter((sop): sop is Evidencia => sop !== null)
        }
        for (const pe of p.periodos)
          for (const d of pe.detalle)
            d.evidencias = (d.evidencias as unknown[]).map((ev) =>
              typeof ev === 'string' ? { tipo: 'archivo' as const, id: '', nombre: ev, tamano: 0, mime: '' } : (ev as Evidencia)
            )
      }
      // Un almacén anterior con los catálogos vacíos recibe los tipos base una sola vez.
      if (!guardado.catalogos_base) {
        if (guardado.tipos_novedad.length === 0) guardado.tipos_novedad = structuredClone(TIPOS_NOVEDAD_BASE)
        if (guardado.tipos_articulacion.length === 0) guardado.tipos_articulacion = structuredClone(TIPOS_ARTICULACION_BASE)
        guardado.catalogos_base = true
      }
      return guardado
    }
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
  for (const pe of p.periodos) {
    if (pe.detalle.length === 0) pe.detalle = detalleDesde(anteriorAprobado(p.periodos, pe.numero), metas.length)
  }
  persistir()
}

/** Lo que la formulación ya sabe del numeral 1 del informe técnico final (INV-IC-FR-019). */
export interface DatosInformacionGeneral {
  area_conocimiento: string
  investigador_principal: PersonaInforme
  co_investigador_interno: PersonaInforme | null
  co_investigador_externo: PersonaInforme | null
  apoyos: ApoyoInforme[]
  ciudad: string
  departamento: string
  /** Resumen del proyecto de la formulación: numeral 2 del informe final. */
  resumen: string
}

const CIUDAD_POR_DEFECTO = 'San Juan de Pasto'
const DEPARTAMENTO_POR_DEFECTO = 'Nariño'

/** Completa el numeral 1 del informe final con los datos de la formulación: solo llena lo que está vacío, así que
 * nunca pisa lo que el investigador ya escribió. Con el informe radicado o aprobado no se toca. */
export function completarInformacionGeneral(id_proyecto: number, datos: DatosInformacionGeneral): void {
  const p = estado.proyectos.find((x) => x.id_proyecto === id_proyecto)
  if (!p || (p.informe_final.estado !== 'Borrador' && p.informe_final.estado !== 'Devuelto')) return
  const copia = structuredClone(p.informe_final.info)
  const vacio = (v: string) => !v.trim()
  const llenar = (actual: PersonaInforme, nuevo: PersonaInforme | null): PersonaInforme => {
    if (!nuevo) return actual
    // Si la persona del formulario es otra, no se mezclan sus datos.
    if (!vacio(actual.nombre) && actual.nombre.trim().toLowerCase() !== nuevo.nombre.trim().toLowerCase()) return actual
    return {
      nombre: vacio(actual.nombre) ? nuevo.nombre : actual.nombre,
      grupo: vacio(actual.grupo) ? nuevo.grupo : actual.grupo,
      programa: vacio(actual.programa) ? nuevo.programa : actual.programa,
      correo: vacio(actual.correo) ? nuevo.correo : actual.correo,
      telefono: vacio(actual.telefono) ? nuevo.telefono : actual.telefono,
    }
  }
  if (vacio(copia.area_conocimiento)) copia.area_conocimiento = datos.area_conocimiento
  copia.investigador_principal = llenar(copia.investigador_principal, datos.investigador_principal)
  copia.co_investigador_interno = llenar(copia.co_investigador_interno, datos.co_investigador_interno)
  copia.co_investigador_externo = llenar(copia.co_investigador_externo, datos.co_investigador_externo)
  for (const a of datos.apoyos) {
    const i = copia.apoyos.findIndex((x) => x.nombre.trim().toLowerCase() === a.nombre.trim().toLowerCase())
    if (i < 0) copia.apoyos.push(a)
    else copia.apoyos[i] = { ...copia.apoyos[i], codigo_estudiantil: copia.apoyos[i].codigo_estudiantil || a.codigo_estudiantil, correo: copia.apoyos[i].correo || a.correo }
  }
  // La ciudad y el departamento arrancan con los valores por defecto: se reemplazan por los del proyecto.
  if (datos.ciudad && (vacio(copia.ciudad) || copia.ciudad === CIUDAD_POR_DEFECTO)) copia.ciudad = datos.ciudad
  if (datos.departamento && (vacio(copia.departamento) || copia.departamento === DEPARTAMENTO_POR_DEFECTO)) copia.departamento = datos.departamento
  // El resumen del informe final arranca con el de la formulación; si el investigador ya escribió el suyo, no se toca.
  const resumen = vacio(p.informe_final.resumen) && datos.resumen.trim() ? datos.resumen.trim() : p.informe_final.resumen
  if (JSON.stringify(copia) === JSON.stringify(p.informe_final.info) && resumen === p.informe_final.resumen) return
  estado = {
    ...estado,
    proyectos: estado.proyectos.map((x) => (x.id_proyecto === id_proyecto ? { ...x, informe_final: { ...x.informe_final, info: copia, resumen } } : x)),
  }
  persistir()
}

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim()

/** Los resultados proyectados (numeral 4 del informe final) salen de lo que el proyecto comprometió en la formulación:
 * se suman las cantidades de cada concepto del formato. Con el informe radicado o aprobado no se toca. */
export function completarResultadosProyectados(id_proyecto: number, comprometidos: { concepto: string; cantidad: number }[]): void {
  const p = estado.proyectos.find((x) => x.id_proyecto === id_proyecto)
  if (!p || (p.informe_final.estado !== 'Borrador' && p.informe_final.estado !== 'Devuelto')) return
  const total = new Map<string, number>()
  for (const c of comprometidos) {
    const n = normalizar(c.concepto)
    // El nombre del concepto del formato puede ser más corto o más largo que el del catálogo.
    const producto = p.productos.find((x) => {
      const m = normalizar(x.nombre)
      return m === n || m.startsWith(n) || n.startsWith(m)
    })
    if (producto) total.set(producto.nombre, (total.get(producto.nombre) ?? 0) + c.cantidad)
  }
  const productos = p.productos.map((x) => (total.has(x.nombre) ? { ...x, proyectado: total.get(x.nombre) as number } : x))
  if (JSON.stringify(productos) === JSON.stringify(p.productos)) return
  estado = { ...estado, proyectos: estado.proyectos.map((x) => (x.id_proyecto === id_proyecto ? { ...x, productos } : x)) }
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
      existente.periodos.every((pe) => !periodoSolicitado(pe) && !pe.observacion_solicitud) &&
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
