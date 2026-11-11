import { apiFetch, apiFetchBlob, apiFetchFormData, ApiError, descargarBlobComoArchivo } from '../../../shared/api/client'
import { abrirVisor } from '../../../shared/lib/visorDocumento'

export type TipoDocumentoHistorico = 'proyecto' | 'acta_inicio' | 'informe_avance' | 'informe_final' | 'acta_cierre'

export interface DocumentoHistorico {
  id_documento_historico: number
  tipo: TipoDocumentoHistorico
  numero_periodo: number | null
  nombre_original: string
  fecha_carga: string
}

/** Lo que se registra de un proyecto finalizado (las fechas como "AAAA-MM-DD"). */
export interface SeguimientoHistoricoEntrada {
  acta_inicio: {
    fecha_inicio: string
    duracion_meses: number
    numero_acta_aprobacion?: string
    fecha_acta_aprobacion?: string
    tipo_proyecto?: string
    centro_costos?: string
  }
  informes_avance?: { numero_periodo: number; fecha_radicacion?: string; porcentaje_avance?: number; observaciones_generales?: string }[]
  informe_final?: {
    resumen_ejecucion?: string
    observaciones_objetivos?: string
    area_conocimiento?: string
    ciudad?: string
    departamento?: string
    porcentaje_cumplimiento?: number
    fecha_radicacion?: string
  }
  acta_cierre?: {
    fecha_inicio_real?: string
    fecha_finalizacion_real?: string
    duracion_real_meses?: number
    observaciones?: string
    ciudad_firma?: string
    fecha_acta?: string
  }
}

/** POST /proyectos/:id/historico/seguimiento — un 409 "ya registrado" se toma como hecho (sirve para reintentar). */
export async function registrarSeguimientoHistorico(id_proyecto: number, datos: SeguimientoHistoricoEntrada): Promise<void> {
  try {
    await apiFetch(`/proyectos/${id_proyecto}/historico/seguimiento`, { method: 'POST', body: JSON.stringify(datos) })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && /ya tiene su seguimiento/i.test(err.message)) return
    throw err
  }
}

/** POST /proyectos/:id/historico/documentos — sube el PDF original (si ya había uno del mismo tipo y periodo, lo reemplaza). */
export function subirDocumentoHistorico(
  id_proyecto: number,
  tipo: TipoDocumentoHistorico,
  archivo: File,
  numero_periodo?: number
): Promise<unknown> {
  const formData = new FormData()
  formData.append('tipo', tipo)
  if (numero_periodo !== undefined) formData.append('numero_periodo', String(numero_periodo))
  formData.append('archivo', archivo)
  return apiFetchFormData(`/proyectos/${id_proyecto}/historico/documentos`, formData)
}

export function listarDocumentosHistoricos(id_proyecto: number): Promise<DocumentoHistorico[]> {
  return apiFetch(`/proyectos/${id_proyecto}/historico/documentos`)
}

const ruta = (id_proyecto: number, id_documento: number) => `/proyectos/${id_proyecto}/historico/documentos/${id_documento}/descarga`

export async function descargarDocumentoHistorico(id_proyecto: number, doc: DocumentoHistorico): Promise<void> {
  descargarBlobComoArchivo(await apiFetchBlob(ruta(id_proyecto, doc.id_documento_historico)), doc.nombre_original)
}

/** Muestra el PDF en el visor de la aplicación (con la misma autenticación). */
export async function verDocumentoHistorico(id_proyecto: number, doc: DocumentoHistorico): Promise<void> {
  abrirVisor(await apiFetchBlob(ruta(id_proyecto, doc.id_documento_historico)), doc.nombre_original)
}

export const ETIQUETA_TIPO_HISTORICO: Record<TipoDocumentoHistorico, string> = {
  proyecto: 'Proyecto',
  acta_inicio: 'Acta de inicio',
  informe_avance: 'Informe de avance',
  informe_final: 'Informe final',
  acta_cierre: 'Acta de cierre',
}
