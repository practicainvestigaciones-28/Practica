import { apiFetch, apiFetchFormData, apiFetchBlob } from '../../../shared/api/client'

export interface DatosBancarios {
  id_dato_bancario: number
  id_usuario: number
  banco: string | null
  tipo_cuenta: string | null
  numero_cuenta: string | null
  titular: string | null
  documento_titular: string | null
  rut_path: string | null
  certificacion_bancaria_path: string | null
  cedula_path: string | null
}

export type TipoDocumentoPago = 'rut' | 'certificacion_bancaria' | 'cedula'

export function obtenerMisDatosBancarios(): Promise<{ datos: DatosBancarios | null }> {
  return apiFetch('/pagos/datos-bancarios')
}

export function guardarMisDatosBancarios(datos: {
  banco?: string
  tipo_cuenta?: string
  numero_cuenta?: string
  titular?: string
  documento_titular?: string
}): Promise<{ mensaje: string; datos: DatosBancarios }> {
  return apiFetch('/pagos/datos-bancarios', {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}

export function subirMiDocumentoPago(tipo: TipoDocumentoPago, archivo: File): Promise<{ mensaje: string; datos: DatosBancarios }> {
  const formData = new FormData()
  formData.append('archivo', archivo)
  return apiFetchFormData(`/pagos/datos-bancarios/documentos/${tipo}`, formData)
}

export async function descargarMiDocumentoPago(tipo: TipoDocumentoPago, nombreSugerido: string): Promise<void> {
  const blob = await apiFetchBlob(`/pagos/datos-bancarios/documentos/${tipo}`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreSugerido
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export interface HistorialPagoItem {
  id_evaluacion: number
  proyecto: { id_proyecto: number; titulo: string }
  valor_pago: number | null
  pagado: boolean
  tiene_comprobante: boolean
  id_pago: number | null
}

export function obtenerMiHistorialPagos(): Promise<{ historial: HistorialPagoItem[] }> {
  return apiFetch('/pagos/historial')
}

export async function descargarMiComprobante(id_pago: number, nombreSugerido: string): Promise<void> {
  const blob = await apiFetchBlob(`/pagos/historial/${id_pago}/comprobante`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreSugerido
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Vista del Administrador ("Pagos a pares")
// ---------------------------------------------------------------------------

export interface ParPagoResumen {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  proyectos_evaluados: number
  pagos_pendientes: number
  tiene_datos_bancarios: boolean
  documentos_completos: boolean
}

export function listarParesConPagos(): Promise<{ pares: ParPagoResumen[] }> {
  return apiFetch('/pagos-admin/pares')
}

export function obtenerDatosBancariosDePar(id_usuario: number): Promise<{ datos: DatosBancarios | null }> {
  return apiFetch(`/pagos-admin/pares/${id_usuario}/datos-bancarios`)
}

/** Abre el documento de ese par en una pestaña nueva, sin descargarlo (igual que en los comités). */
export async function verDocumentoDePar(id_usuario: number, tipo: TipoDocumentoPago): Promise<void> {
  const blob = await apiFetchBlob(`/pagos-admin/pares/${id_usuario}/documentos/${tipo}`)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

export async function descargarDocumentoDePar(id_usuario: number, tipo: TipoDocumentoPago, nombreSugerido: string): Promise<void> {
  const blob = await apiFetchBlob(`/pagos-admin/pares/${id_usuario}/documentos/${tipo}`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreSugerido
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export function listarEvaluacionesDePar(id_usuario: number): Promise<{ historial: HistorialPagoItem[] }> {
  return apiFetch(`/pagos-admin/pares/${id_usuario}/evaluaciones`)
}

export function registrarPago(id_evaluacion: number, valor_pago: number): Promise<{ mensaje: string }> {
  return apiFetch(`/pagos-admin/evaluaciones/${id_evaluacion}/pago`, {
    method: 'PUT',
    body: JSON.stringify({ valor_pago }),
  })
}

export function subirComprobantePago(id_pago: number, archivo: File): Promise<{ mensaje: string }> {
  const formData = new FormData()
  formData.append('archivo', archivo)
  return apiFetchFormData(`/pagos-admin/pagos/${id_pago}/comprobante`, formData)
}

export async function descargarComprobanteAdmin(id_pago: number, nombreSugerido: string): Promise<void> {
  const blob = await apiFetchBlob(`/pagos-admin/pagos/${id_pago}/comprobante`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreSugerido
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
