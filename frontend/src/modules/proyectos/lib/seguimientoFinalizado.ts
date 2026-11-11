import type { SeguimientoHistoricoEntrada } from '../api/historicos'
import type { ResultadoLecturaSeguimiento } from './importar/pdf/leerDocumentos'

/** Datos del seguimiento de un proyecto finalizado, editables en la revisión (las fechas como "AAAA-MM-DD"). */
export interface SeguimientoFinalizadoForm {
  numeroActa: string
  fechaActa: string
  centroCostos: string
  tipoProyecto: string
  fechaInicio: string
  duracionMeses: string
  fechaEntregaFinal: string
  resumenEjecucion: string
  observacionesObjetivos: string
  fechaFinalizacion: string
  ciudadFirma: string
  fechaActaCierre: string
}

export const seguimientoFinalizadoVacio = (): SeguimientoFinalizadoForm => ({
  numeroActa: '',
  fechaActa: '',
  centroCostos: '',
  tipoProyecto: '',
  fechaInicio: '',
  duracionMeses: '',
  fechaEntregaFinal: '',
  resumenEjecucion: '',
  observacionesObjetivos: '',
  fechaFinalizacion: '',
  ciudadFirma: '',
  fechaActaCierre: '',
})

/** Valores de partida: lo leído de los PDF y, si no hay acta de inicio, la duración que dice el proyecto (en periodos de 6 meses). */
export function seguimientoFinalizadoInicial(lectura: ResultadoLecturaSeguimiento | null, duracionPeriodos?: number): SeguimientoFinalizadoForm {
  const b = lectura?.borrador
  const duracion = b?.acta_inicio?.duracion_meses ?? (duracionPeriodos ? duracionPeriodos * 6 : undefined)
  return {
    numeroActa: b?.acta_inicio?.numero_acta_aprobacion ?? '',
    fechaActa: b?.acta_inicio?.fecha_acta_aprobacion ?? '',
    centroCostos: b?.acta_inicio?.centro_costos ?? '',
    tipoProyecto: b?.acta_inicio?.tipo_proyecto ?? '',
    fechaInicio: b?.acta_inicio?.fecha_inicio ?? b?.acta_cierre?.fecha_inicio_real ?? '',
    duracionMeses: duracion ? String(duracion) : '',
    fechaEntregaFinal: b?.informe_final?.fecha_radicacion ?? '',
    resumenEjecucion: b?.informe_final?.resumen_ejecucion ?? '',
    observacionesObjetivos: b?.informe_final?.observaciones_objetivos ?? '',
    fechaFinalizacion: b?.acta_cierre?.fecha_finalizacion_real ?? '',
    ciudadFirma: b?.acta_cierre?.ciudad_firma ?? '',
    fechaActaCierre: b?.acta_cierre?.fecha_acta ?? '',
  }
}

const opcional = (v: string) => v.trim() || undefined

/** Arma lo que recibe el backend; si falta algo indispensable devuelve el mensaje que hay que mostrar. */
export function armarEntradaSeguimiento(f: SeguimientoFinalizadoForm, periodosConInforme: number[]): SeguimientoHistoricoEntrada | string {
  const duracion = Number(f.duracionMeses)
  if (!f.fechaInicio) return 'Falta la fecha de inicio del proyecto (en "Firmas y anexos").'
  if (!Number.isInteger(duracion) || duracion <= 0) return 'Falta la duración del proyecto en meses (en "Firmas y anexos").'
  return {
    acta_inicio: {
      fecha_inicio: f.fechaInicio,
      duracion_meses: duracion,
      numero_acta_aprobacion: opcional(f.numeroActa),
      fecha_acta_aprobacion: opcional(f.fechaActa),
      tipo_proyecto: opcional(f.tipoProyecto),
      centro_costos: opcional(f.centroCostos),
    },
    informes_avance: periodosConInforme.map((numero_periodo) => ({ numero_periodo })),
    informe_final: {
      resumen_ejecucion: opcional(f.resumenEjecucion),
      observaciones_objetivos: opcional(f.observacionesObjetivos),
      fecha_radicacion: opcional(f.fechaEntregaFinal),
    },
    acta_cierre: {
      fecha_inicio_real: f.fechaInicio,
      fecha_finalizacion_real: opcional(f.fechaFinalizacion),
      duracion_real_meses: duracion,
      ciudad_firma: opcional(f.ciudadFirma),
      fecha_acta: opcional(f.fechaActaCierre),
    },
  }
}
