// Contenido real del proyecto que corresponde a cada ítem de los checklists
// oficiales (INV-IC-FR-009 Comité de Investigación, INV-IC-FR-020 Comité de
// Ética), para desplegarlo bajo cada fila — igual que ya existía solo para
// "1. Datos Generales". Un ítem sin correspondencia real en el modelo de
// datos (por ejemplo, documentos que todavía no tienen un tipo sembrado en
// el catálogo) simplemente no se digitaliza: no se inventa contenido.

import * as proyectosApi from '../../proyectos/api/proyectos'
import * as documentosApi from '../../proyectos/api/documentos'
import { construirCamposDatosGenerales, formatearMoneda, type CampoDatoGeneral } from './datosGeneralesProyecto'

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
}

export type BloqueDetalle =
  | { tipo: 'campos'; campos: CampoDatoGeneral[] }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'documento'; documento: documentosApi.DocumentoProyecto | null }

const SIN_DATO = (mensaje: string): BloqueDetalle => ({ tipo: 'texto', texto: mensaje })

function bloqueTexto(valor: string | null, vacio: string): BloqueDetalle {
  return { tipo: 'texto', texto: valor?.trim() || vacio }
}

function bloqueObjetivos(objetivos: proyectosApi.ObjetivoProyecto[]): BloqueDetalle {
  if (objetivos.length === 0) return SIN_DATO('No se registraron objetivos.')
  return { tipo: 'lista', items: objetivos.map((o) => `${o.tipo_objetivo}: ${o.descripcion}`) }
}

function bloqueFinanciacion(financiacion: proyectosApi.FinanciacionProyecto | null): BloqueDetalle {
  if (!financiacion) return SIN_DATO('Sin financiación registrada.')
  return {
    tipo: 'texto',
    texto: `Solicitado a UNICESMAG: ${formatearMoneda(financiacion.valor_solicitado_unicesmag)} — Contrapartida: ${formatearMoneda(financiacion.valor_contrapartida)} — Total: ${formatearMoneda(financiacion.valor_total)}`,
  }
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
      return { tipo: 'campos', campos: construirCamposDatosGenerales(ctx.proyecto, ctx.participantes, ctx.areas, ctx.programas, ctx.financiacion) }
    case 2: {
      if (ctx.grupos.length === 0) return SIN_DATO('No se registró un grupo de investigación.')
      return {
        tipo: 'lista',
        items: ctx.grupos.map((g) =>
          [
            g.grupo.nombre,
            g.grupo.lider_grupo && `Líder: ${g.grupo.lider_grupo}`,
            g.lineaInvestigacion && `Línea: ${g.lineaInvestigacion.nombre}`,
            g.odsVarios.length > 0 && `ODS: ${g.odsVarios.map((o) => o.ods.nombre).join(', ')}`,
          ]
            .filter(Boolean)
            .join(' — ')
        ),
      }
    }
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
    case 10: {
      const impactos = ctx.objetivos.flatMap((o) => o.impactos.map((i) => i.impacto_esperado))
      if (impactos.length === 0) return SIN_DATO('No se registraron impactos.')
      return { tipo: 'lista', items: impactos }
    }
    case 11: {
      const indicadores = ctx.objetivos.flatMap((o) => o.impactos.map((i) => i.indicador_verificable).filter((x): x is string => Boolean(x)))
      if (indicadores.length === 0) return SIN_DATO('No se registraron indicadores.')
      return { tipo: 'lista', items: indicadores }
    }
    case 12: {
      if (ctx.cronograma.length === 0) return SIN_DATO('No se registraron actividades.')
      return { tipo: 'lista', items: ctx.cronograma.map((a) => [a.actividad, a.resultado && `Resultado: ${a.resultado}`].filter(Boolean).join(' — ')) }
    }
    case 13: {
      if (ctx.productos.length === 0) return SIN_DATO('No se registraron productos/resultados esperados.')
      return { tipo: 'lista', items: ctx.productos.map((p) => `${p.tipoProducto.nombre} (${p.cantidad})`) }
    }
    case 14:
      return bloqueFinanciacion(ctx.financiacion)
    case 15: {
      if (ctx.referencias.length === 0) return SIN_DATO('No se registraron referencias.')
      return { tipo: 'lista', items: ctx.referencias.map((r) => r.referencia) }
    }
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
      return { tipo: 'campos', campos: construirCamposDatosGenerales(ctx.proyecto, ctx.participantes, ctx.areas, ctx.programas, ctx.financiacion) }
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
