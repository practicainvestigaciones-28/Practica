/**
 * Lee, uno por uno, los PDF de seguimiento anexados (acta de inicio, informes de avance, informe final y acta de
 * cierre) y reúne lo leído en un borrador del seguimiento histórico y en un resumen para mostrar en pantalla.
 */
import type { SeleccionCargaHistorica } from '../../cargaHistorica'
import { leerLineasDePdf } from './leerPdf'
import {
  ETIQUETA_DOCUMENTO,
  detectarTipoDocumento,
  leerActaCierre,
  leerActaInicio,
  leerInformeAvance,
  leerInformeFinal,
  type LecturaActaCierre,
  type LecturaActaInicio,
  type LecturaInformeFinal,
  type TipoDocumentoSeguimiento,
} from './extraerSeguimientoPdf'

export interface LecturaDocumento {
  tipo: TipoDocumentoSeguimiento
  /** Ej. "Informe de avance, periodo 2". */
  etiqueta: string
  nombreArchivo: string
  /** Lo que se reconoció, en frases cortas para mostrar. */
  resumen: string[]
  /** Un problema con este documento (no se pudo leer, o parece de otro tipo). */
  advertencia?: string
}

/** Borrador del seguimiento histórico con lo leído de los PDF (fechas como "AAAA-MM-DD"). */
export interface BorradorSeguimientoHistorico {
  acta_inicio?: LecturaActaInicio
  informes_avance: { numero_periodo: number; anio?: number }[]
  informe_final?: LecturaInformeFinal
  acta_cierre?: LecturaActaCierre
}

export interface ResultadoLecturaSeguimiento {
  borrador: BorradorSeguimientoHistorico
  lecturas: LecturaDocumento[]
}

const aFechaLegible = (iso: string | undefined) => (iso ? iso.split('-').reverse().join('/') : '')

/** "Dos periodos" / "2 periodos" → 12 meses (cada periodo dura 6 meses). */
export function duracionEnMeses(duracionTexto: string): number | undefined {
  const NUMEROS: Record<string, number> = { UN: 1, UNO: 1, DOS: 2, TRES: 3, CUATRO: 4, CINCO: 5, SEIS: 6 }
  const t = duracionTexto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const m = /(\d+)|\b(UNO?|DOS|TRES|CUATRO|CINCO|SEIS)\b/.exec(t)
  if (!m) return undefined
  const periodos = m[1] ? Number(m[1]) : NUMEROS[m[2]]
  return periodos ? periodos * 6 : undefined
}

async function leer(archivo: File, esperado: TipoDocumentoSeguimiento, etiqueta: string) {
  try {
    const lineas = await leerLineasDePdf(archivo)
    const detectado = detectarTipoDocumento(lineas)
    const advertencia =
      detectado && detectado !== esperado
        ? `Este PDF parece ser ${ETIQUETA_DOCUMENTO[detectado].toLowerCase()}, no ${ETIQUETA_DOCUMENTO[esperado].toLowerCase()}. Revisa que lo hayas puesto en el espacio correcto.`
        : !detectado
          ? `No se reconoció el formato de ${ETIQUETA_DOCUMENTO[esperado].toLowerCase()}: los datos se completan a mano.`
          : undefined
    return { lineas, advertencia, reconocido: detectado === esperado }
  } catch (err) {
    return { lineas: null, advertencia: err instanceof Error ? err.message : `No se pudo leer ${etiqueta}.`, reconocido: false }
  }
}

export async function leerDocumentosDeSeguimiento(sel: SeleccionCargaHistorica): Promise<ResultadoLecturaSeguimiento> {
  const borrador: BorradorSeguimientoHistorico = { informes_avance: [] }
  const lecturas: LecturaDocumento[] = []
  const agregar = (l: LecturaDocumento) => lecturas.push(l)

  if (sel.actaInicio) {
    const etiqueta = ETIQUETA_DOCUMENTO.acta_inicio
    const r = await leer(sel.actaInicio, 'acta_inicio', etiqueta)
    const resumen: string[] = []
    if (r.lineas && r.reconocido) {
      const a = leerActaInicio(r.lineas)
      borrador.acta_inicio = a
      if (a.numero_acta_aprobacion) resumen.push(`Acta No. ${a.numero_acta_aprobacion}${a.fecha_acta_aprobacion ? ` del ${aFechaLegible(a.fecha_acta_aprobacion)}` : ''}`)
      if (a.fecha_inicio) resumen.push(`Inicio: ${aFechaLegible(a.fecha_inicio)}`)
      if (a.duracion_meses) resumen.push(`Duración: ${a.duracion_meses} meses`)
      if (a.centro_costos) resumen.push(`Centro de costos: ${a.centro_costos}`)
      if (a.tipo_proyecto) resumen.push(`Tipo: ${a.tipo_proyecto}`)
    }
    agregar({ tipo: 'acta_inicio', etiqueta, nombreArchivo: sel.actaInicio.name, resumen, advertencia: r.advertencia })
  }

  for (let i = 0; i < sel.informesAvance.length; i++) {
    const archivo = sel.informesAvance[i]
    if (!archivo) continue
    const etiqueta = `${ETIQUETA_DOCUMENTO.informe_avance}, periodo ${i + 1}`
    const r = await leer(archivo, 'informe_avance', etiqueta)
    const resumen: string[] = []
    let advertencia = r.advertencia
    if (r.lineas && r.reconocido) {
      const v = leerInformeAvance(r.lineas)
      if (v.numero_periodo) {
        resumen.push(`Periodo ${v.numero_periodo}${v.anio ? `, año ${v.anio}` : ''}`)
        borrador.informes_avance.push({ numero_periodo: v.numero_periodo, anio: v.anio })
        if (v.numero_periodo !== i + 1) {
          advertencia = `El PDF dice periodo ${v.numero_periodo}, pero está en el espacio del periodo ${i + 1}. Revisa el orden.`
        }
      }
    }
    agregar({ tipo: 'informe_avance', etiqueta, nombreArchivo: archivo.name, resumen, advertencia })
  }

  if (sel.informeFinal) {
    const etiqueta = ETIQUETA_DOCUMENTO.informe_final
    const r = await leer(sel.informeFinal, 'informe_final', etiqueta)
    const resumen: string[] = []
    if (r.lineas && r.reconocido) {
      const f = leerInformeFinal(r.lineas)
      borrador.informe_final = f
      if (f.resumen_ejecucion) resumen.push('Resumen de la ejecución')
      if (f.observaciones_objetivos) resumen.push('Observaciones sobre los objetivos')
      if (f.actividades_estudiantes || f.evidencias_estudiantes) resumen.push('Actividades y evidencias de los estudiantes')
      if (f.fecha_radicacion) resumen.push(`Entregado el ${aFechaLegible(f.fecha_radicacion)}`)
    }
    agregar({ tipo: 'informe_final', etiqueta, nombreArchivo: sel.informeFinal.name, resumen, advertencia: r.advertencia })
  }

  if (sel.actaCierre) {
    const etiqueta = ETIQUETA_DOCUMENTO.acta_cierre
    const r = await leer(sel.actaCierre, 'acta_cierre', etiqueta)
    const resumen: string[] = []
    if (r.lineas && r.reconocido) {
      const c = leerActaCierre(r.lineas)
      borrador.acta_cierre = c
      if (c.fecha_finalizacion_real) resumen.push(`Finalización: ${aFechaLegible(c.fecha_finalizacion_real)}`)
      if (c.ciudad_firma || c.fecha_acta) resumen.push(`Firmada${c.ciudad_firma ? ` en ${c.ciudad_firma}` : ''}${c.fecha_acta ? ` el ${aFechaLegible(c.fecha_acta)}` : ''}`)
      if (c.libros !== undefined || c.capitulos !== undefined) resumen.push(`Libros: ${c.libros ?? 0} · Capítulos: ${c.capitulos ?? 0}`)
    }
    agregar({ tipo: 'acta_cierre', etiqueta, nombreArchivo: sel.actaCierre.name, resumen, advertencia: r.advertencia })
  }

  return { borrador, lecturas }
}
