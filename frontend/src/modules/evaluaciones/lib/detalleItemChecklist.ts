// Contenido real del proyecto que corresponde a cada ítem de los checklists
// oficiales (INV-IC-FR-009 Comité de Investigación, INV-IC-FR-020 Comité de
// Ética), para desplegarlo bajo cada fila — igual que ya existía solo para
// "1. Datos Generales". Un ítem sin correspondencia real en el modelo de
// datos (por ejemplo, documentos que todavía no tienen un tipo sembrado en
// el catálogo) simplemente no se digitaliza: no se inventa contenido.

import * as proyectosApi from '../../proyectos/api/proyectos'
import * as documentosApi from '../../proyectos/api/documentos'
import { construirDatosGenerales, formatearMoneda, type CampoDatoGeneral, type ParticipanteDatoGeneral } from './datosGeneralesProyecto'

export interface ContextoDetalleProyecto {
  proyecto: proyectosApi.ProyectoDetalle
  participantes: proyectosApi.ParticipanteProyecto[]
  areas: proyectosApi.AreaDelProyecto[]
  programas: proyectosApi.ProgramaDelProyecto[]
  financiacion: proyectosApi.FinanciacionProyecto | null
  grupos: proyectosApi.GrupoDelProyecto[]
  objetivos: proyectosApi.ObjetivoProyecto[]
  antecedentes: proyectosApi.AntecedenteProyecto[]
  referencias: proyectosApi.ReferenciaProyecto[]
  cronograma: proyectosApi.ActividadCronogramaProyecto[]
  productos: proyectosApi.ProductoDelProyecto[]
  documentos: documentosApi.DocumentoProyecto[]
  /** Catálogo de facultades por id, para resolver `grupo.id_facultad` a un nombre. */
  facultades: Map<number, string>
  /** Por id_usuarioproyecto. Solo para participantes con rol "Co investigador(a) Egresado(a) UNICESMAG". */
  egresados: Map<number, proyectosApi.InformacionEgresado | null>
}

/** Para los encabezados del cuadro de cronograma (ver bloqueCronograma). */
export const MESES_ABREV = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export interface GrupoDetalle {
  nombre: string
  facultad: string
  programa: string
  lider: string
  linea: string
  ods: string
  codigoGruplac: string
  reconocidoMinciencias: string
  categoria: string
}

export interface FilaCronogramaDetalle {
  actividad: string
  resultado: string | null
  responsable: string
  /** 12 posiciones, índice 0 = enero. */
  meses: boolean[]
}

export interface GrupoCronogramaDetalle {
  etiqueta: string
  filas: FilaCronogramaDetalle[]
}

export interface ActividadSinPeriodoDetalle {
  actividad: string
  resultado: string | null
  responsable: string
}

export interface ImpactoPorEspecificoDetalle {
  numero: number
  impacto_esperado: string | null
  beneficiario_potencial: string | null
  indicador_verificable: string | null
}

export interface ProductoDetalle {
  categoria: string
  subcategoria: string
  tipo: string
  cantidad: number
}

export type BloqueDetalle =
  | { tipo: 'campos'; campos: CampoDatoGeneral[] }
  | { tipo: 'datosGenerales'; camposProyecto: CampoDatoGeneral[]; participantes: ParticipanteDatoGeneral[] }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'documento'; documento: documentosApi.DocumentoProyecto | null }
  | { tipo: 'objetivos'; general: string; especificos: string[] }
  | { tipo: 'impactos'; especificos: ImpactoPorEspecificoDetalle[] }
  | { tipo: 'grupos'; grupos: GrupoDetalle[] }
  | { tipo: 'cronograma'; grupos: GrupoCronogramaDetalle[]; sinPeriodo: ActividadSinPeriodoDetalle[] }
  | { tipo: 'productos'; productos: ProductoDetalle[] }

const SIN_DATO = (mensaje: string): BloqueDetalle => ({ tipo: 'texto', texto: mensaje })

function bloqueTexto(valor: string | null, vacio: string): BloqueDetalle {
  return { tipo: 'texto', texto: valor?.trim() || vacio }
}

/** Solo el general y las descripciones de los específicos — los impactos de
 * cada específico se revisan aparte, en el ítem "Impacto" (ver bloqueImpactos). */
function bloqueObjetivos(objetivos: proyectosApi.ObjetivoProyecto[]): BloqueDetalle {
  const general = objetivos.find((o) => o.tipo_objetivo === 'general')
  const especificos = objetivos.filter((o) => o.tipo_objetivo !== 'general')
  if (!general && especificos.length === 0) return SIN_DATO('No se registraron objetivos.')
  return {
    tipo: 'objetivos',
    general: general?.descripcion || 'Sin objetivo general registrado.',
    especificos: especificos.map((o) => o.descripcion),
  }
}

/** Asocia cada objetivo específico (numerado igual que en "Objetivos") con
 * su propio impacto esperado, beneficiario potencial e indicador verificable
 * — antes salían como 2 listas sueltas (ítems 4.7 y 4.8) sin decir a cuál
 * específico correspondía cada uno. */
function bloqueImpactos(objetivos: proyectosApi.ObjetivoProyecto[]): BloqueDetalle {
  const especificos = objetivos.filter((o) => o.tipo_objetivo !== 'general')
  if (especificos.length === 0) return SIN_DATO('No se registraron objetivos específicos.')
  return {
    tipo: 'impactos',
    especificos: especificos.map((o, i) => {
      const impacto = o.impactos[0]
      return {
        numero: i + 1,
        impacto_esperado: impacto?.impacto_esperado ?? null,
        beneficiario_potencial: impacto?.beneficiario_potencial ?? null,
        indicador_verificable: impacto?.indicador_verificable ?? null,
      }
    }),
  }
}

function bloqueGrupos(grupos: proyectosApi.GrupoDelProyecto[], facultades: Map<number, string>): BloqueDetalle {
  if (grupos.length === 0) return SIN_DATO('No se registró un grupo de investigación.')
  return {
    tipo: 'grupos',
    grupos: grupos.map((g) => ({
      nombre: g.grupo.nombre,
      facultad: g.grupo.facultad_otra ?? (g.grupo.id_facultad ? facultades.get(g.grupo.id_facultad) : null) ?? '—',
      programa: g.grupo.programa_otro ?? '—',
      lider: g.grupo.lider_grupo ?? '—',
      linea: g.lineaInvestigacion?.nombre ?? '—',
      ods: g.odsVarios.length > 0 ? g.odsVarios.map((o) => o.ods.nombre).join(', ') : '—',
      codigoGruplac: g.grupo.cod_gruplac ?? '—',
      reconocidoMinciencias: g.grupo.reconocido_minciencias ? 'Sí' : 'No',
      categoria: g.grupo.categoria ?? '—',
    })),
  }
}

function responsableDeActividad(a: proyectosApi.ActividadCronogramaProyecto): string {
  return a.responsable_manual?.trim()
    ? a.responsable_manual.split('\n').filter(Boolean).join(', ')
    : a.responsables.map((r) => `${r.usuario.nombre} ${r.usuario.apellido}`).join(', ') || '—'
}

/**
 * Agrupa por periodo+año (igual que el cuadro de 12 meses con el que el
 * investigador lo diligenció en CrearProyecto) en vez de aplanar cada mes a
 * una entrada de texto repitiendo "Periodo 1" — eso era lo que se veía
 * desordenado.
 */
function bloqueCronograma(cronograma: proyectosApi.ActividadCronogramaProyecto[]): BloqueDetalle {
  if (cronograma.length === 0) return SIN_DATO('No se registraron actividades.')

  const clavesOrden: string[] = []
  const etiquetaPorClave = new Map<string, string>()
  for (const a of cronograma) {
    for (const pm of a.periodos) {
      const clave = `${pm.periodo.nombre}-${pm.año}`
      if (!etiquetaPorClave.has(clave)) {
        clavesOrden.push(clave)
        etiquetaPorClave.set(clave, `${pm.periodo.nombre} - ${pm.año}`)
      }
    }
  }

  const grupos: GrupoCronogramaDetalle[] = clavesOrden.map((clave) => ({
    etiqueta: etiquetaPorClave.get(clave)!,
    filas: cronograma
      .filter((a) => a.periodos.some((pm) => `${pm.periodo.nombre}-${pm.año}` === clave))
      .map((a) => {
        const meses = Array(12).fill(false)
        for (const pm of a.periodos) {
          if (`${pm.periodo.nombre}-${pm.año}` === clave) meses[pm.mes - 1] = true
        }
        return { actividad: a.actividad, resultado: a.resultado, responsable: responsableDeActividad(a), meses }
      }),
  }))

  const sinPeriodo = cronograma
    .filter((a) => a.periodos.length === 0)
    .map((a) => ({ actividad: a.actividad, resultado: a.resultado, responsable: responsableDeActividad(a) }))

  return { tipo: 'cronograma', grupos, sinPeriodo }
}

function bloqueProductos(productos: proyectosApi.ProductoDelProyecto[]): BloqueDetalle {
  if (productos.length === 0) return SIN_DATO('No se registraron productos/resultados esperados.')
  return {
    tipo: 'productos',
    productos: productos.map((p) => ({
      categoria: p.tipoProducto.subcategoria.categoria.nombre,
      subcategoria: p.tipoProducto.subcategoria.nombre,
      tipo: p.tipoProducto.nombre,
      cantidad: p.cantidad,
    })),
  }
}

/** Subtítulos en negrita (reutiliza el mismo renderizado de "campos" que ya usa "Datos Generales"). */
function bloqueFinanciacion(financiacion: proyectosApi.FinanciacionProyecto | null): BloqueDetalle {
  if (!financiacion) return SIN_DATO('Sin financiación registrada.')
  return {
    tipo: 'campos',
    campos: [
      { label: 'Valor solicitado a UNICESMAG', valor: formatearMoneda(financiacion.valor_solicitado_unicesmag) },
      { label: 'Valor contrapartida', valor: formatearMoneda(financiacion.valor_contrapartida) },
      { label: 'Valor total', valor: formatearMoneda(financiacion.valor_total) },
    ],
  }
}

/** Un bloque de texto (no una lista con viñetas) para que cada referencia
 * quede en su propia línea tal como se pegaron en el formulario, sin
 * convertirlas a un formato distinto (viñetas) al que trajeron. */
function bloqueReferencias(referencias: proyectosApi.ReferenciaProyecto[]): BloqueDetalle {
  if (referencias.length === 0) return SIN_DATO('No se registraron referencias.')
  return { tipo: 'texto', texto: referencias.map((r) => r.referencia).join('\n') }
}

function buscarDocumento(documentos: documentosApi.DocumentoProyecto[], ...palabrasClave: string[]): BloqueDetalle {
  const doc = documentos.find((d) =>
    palabrasClave.some((clave) => d.tipoDocumento.nombre.toLowerCase().includes(clave.toLowerCase()))
  )
  return { tipo: 'documento', documento: doc ?? null }
}

/** INV-IC-FR-009 — qué mostrar al desplegar cada ítem, o null si no aplica (fila simple, sin desplegable). */
export function construirDetalleItemInvestigacion(idItem: number, ctx: ContextoDetalleProyecto): BloqueDetalle | null {
  switch (idItem) {
    case 1:
      return { tipo: 'datosGenerales', ...construirDatosGenerales(ctx.proyecto, ctx.participantes, ctx.areas, ctx.programas, ctx.financiacion, ctx.egresados) }
    case 2:
      return bloqueGrupos(ctx.grupos, ctx.facultades)
    case 3:
      return bloqueTexto(ctx.proyecto.resumen, 'Sin resumen registrado.')
    case 4:
      return bloqueTexto(ctx.proyecto.planteamiento_problema, 'Sin planteamiento del problema registrado.')
    case 5:
      return bloqueTexto(ctx.proyecto.justificacion, 'Sin justificación registrada.')
    case 6:
      return bloqueObjetivos(ctx.objetivos)
    case 7: {
      if (ctx.antecedentes.length === 0) return SIN_DATO('No se registraron antecedentes.')
      return {
        tipo: 'lista',
        items: ctx.antecedentes.map((a) =>
          [a.descripcion, a.autor, a.fecha_publicacion].filter(Boolean).join(' — ')
        ),
      }
    }
    case 8:
      return bloqueTexto(ctx.proyecto.marco_teorico, 'Sin marco teórico registrado.')
    case 9:
      return bloqueTexto(ctx.proyecto.metodologia_preliminar, 'Sin metodología registrada.')
    case 10:
      return bloqueImpactos(ctx.objetivos)
    case 11: {
      const indicadores = ctx.objetivos.flatMap((o) => o.impactos.map((i) => i.indicador_verificable).filter((x): x is string => Boolean(x)))
      if (indicadores.length === 0) return SIN_DATO('No se registraron indicadores.')
      return { tipo: 'lista', items: indicadores }
    }
    case 12:
      return bloqueCronograma(ctx.cronograma)
    case 13:
      return bloqueProductos(ctx.productos)
    case 14:
      return bloqueFinanciacion(ctx.financiacion)
    case 15:
      return bloqueReferencias(ctx.referencias)
    case 16:
      return buscarDocumento(ctx.documentos, 'aval')
    case 17:
      return buscarDocumento(ctx.documentos, 'acta de compromiso')
    case 18:
      return buscarDocumento(ctx.documentos, 'carta de intención', 'carta de intencion')
    case 19:
      return buscarDocumento(ctx.documentos, 'solicitud de evaluación', 'solicitud de evaluacion')
    case 20:
      return buscarDocumento(ctx.documentos, 'consentimiento informado')
    case 21:
      return buscarDocumento(ctx.documentos, 'asentimiento informado')
    default:
      return null
  }
}

/** INV-IC-FR-020 — qué mostrar al desplegar cada ítem, o null si no aplica. */
export function construirDetalleItemEtica(idItem: number, ctx: ContextoDetalleProyecto): BloqueDetalle | null {
  switch (idItem) {
    case 1:
      return { tipo: 'datosGenerales', ...construirDatosGenerales(ctx.proyecto, ctx.participantes, ctx.areas, ctx.programas, ctx.financiacion, ctx.egresados) }
    case 2:
      return bloqueObjetivos(ctx.objetivos)
    case 3:
      return bloqueTexto(ctx.proyecto.resumen, 'Sin resumen registrado.')
    case 4:
      return bloqueTexto(ctx.proyecto.componente_etico, 'Sin componente ético registrado.')
    case 5:
      return buscarDocumento(ctx.documentos, 'consentimiento informado')
    case 6:
      return buscarDocumento(ctx.documentos, 'asentimiento informado')
    case 7:
      return bloqueFinanciacion(ctx.financiacion)
    default:
      return null
  }
}

/**
 * Rúbrica de Pares (ver criteriosEvaluacion en lib/parEvaluador.ts) — qué
 * mostrar al desplegar cada criterio para que el par evaluador no solo vea
 * la descripción fija de qué debe calificar, sino también el contenido real
 * del proyecto que le corresponde. Los criterios 9 (Aplicación de normas) y
 * 10 (Redacción) son la excepción: son de apreciación propia del evaluador
 * sobre el documento en general, no hay un campo puntual del proyecto que
 * mostrarles, así que no tienen desplegable.
 */
export function construirDetalleItemPar(
  numeroCriterio: number,
  ctx: Pick<ContextoDetalleProyecto, 'proyecto' | 'objetivos' | 'antecedentes' | 'referencias' | 'cronograma'>
): BloqueDetalle | null {
  switch (numeroCriterio) {
    case 1:
      return bloqueTexto(ctx.proyecto.planteamiento_problema, 'Sin planteamiento del problema registrado.')
    case 2:
      return bloqueTexto(ctx.proyecto.justificacion, 'Sin justificación registrada.')
    case 3:
      return bloqueObjetivos(ctx.objetivos)
    case 4: {
      if (ctx.antecedentes.length === 0) return SIN_DATO('No se registraron antecedentes.')
      return {
        tipo: 'lista',
        items: ctx.antecedentes.map((a) => [a.descripcion, a.autor, a.fecha_publicacion].filter(Boolean).join(' — ')),
      }
    }
    case 5:
      return bloqueTexto(ctx.proyecto.marco_teorico, 'Sin marco teórico registrado.')
    case 6:
      return bloqueTexto(ctx.proyecto.metodologia_preliminar, 'Sin metodología registrada.')
    case 7:
      return bloqueCronograma(ctx.cronograma)
    case 8:
      return bloqueReferencias(ctx.referencias)
    case 11:
      return bloqueImpactos(ctx.objetivos)
    default:
      // 9 (Aplicación de normas) y 10 (Redacción): a criterio propio del par, sin dato del proyecto que mostrar.
      return null
  }
}
